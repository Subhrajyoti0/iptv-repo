import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

import pLimit from "p-limit";
import xmlbuilder from "xmlbuilder";

import { createClient } from "../_shared/http.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
const PLAYLIST_DIR = path.join(REPO_ROOT, "playlists");
const EPG_DIR = path.join(REPO_ROOT, "epg");

const client = createClient();
const limitEPG = pLimit(5);

const COUNTRIES = ["IN", "US", "GB"];
const EPG_DAYS = 7;

function xmlTime(d) {
  return new Date(d)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "")
    .split(".")[0] + " +0000";
}

function ensureDirs() {
  fs.mkdirSync(PLAYLIST_DIR, { recursive: true });
  fs.mkdirSync(EPG_DIR, { recursive: true });
}

function normalizeImage(_ch) {
  // Keep blank unless you have a confirmed image host mapping.
  return "";
}

/**
 * SAFE PLACEHOLDER:
 * Return your own authorized/licensed stream URL here if you have one.
 * Returning null keeps the playlist metadata-only.
 */
function resolveAuthorizedStreamUrl(_ch, _country) {
  return null;
}

/* ---------------- PAGINATED CATALOG ---------------- */

async function fetchAllChannels(country) {
  let page = 1;
  let allChannels = [];

  while (true) {
    const res = await client.get("https://catalogapi.zee5.com/v1/channel/", {
      params: {
        limit: 25,
        page,
        country
      }
    });

    if (res.status === 403) {
      throw new Error(`Catalog blocked with HTTP 403 for country ${country}`);
    }

    if (res.status !== 200) {
      throw new Error(`Catalog request failed for ${country} with HTTP ${res.status}`);
    }

    const items = res.data.items || [];
    const total = res.data.total || 0;
    const pageSize = res.data.page_size || 25;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    allChannels.push(...items);

    console.log(`Catalog ${country}: page ${page}/${totalPages}, fetched ${items.length}`);

    if (page >= totalPages || items.length === 0) break;
    page++;
  }

  return allChannels;
}

/* ---------------- NESTED EPG (7 days) ---------------- */

async function fetchEPG7Days(channelId, country) {
  let allPrograms = [];

  for (let dayOffset = 0; dayOffset < EPG_DAYS; dayOffset++) {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() + dayOffset);

    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    let page = 1;

    while (true) {
      const res = await client.get("https://gwapi.zee5.com/v1/epg", {
        params: {
          channels: channelId,
          country,
          translation: "en",
          start: start.toISOString(),
          end: end.toISOString(),
          page,
          limit: 25
        }
      });

      if (res.status === 403) {
        console.log(`⚠ EPG blocked (403) for ${channelId} (${country}) on day ${dayOffset + 1}`);
        break;
      }

      if (res.status !== 200) {
        console.log(`⚠ EPG failed (${res.status}) for ${channelId} (${country})`);
        break;
      }

      const total = res.data.total || 0;
      const pageSize = res.data.page_size || 25;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      const channelNodes = res.data.items || [];
      let pagePrograms = [];

      for (const node of channelNodes) {
        if (node.id === channelId && Array.isArray(node.items)) {
          pagePrograms.push(...node.items);
        }
      }

      allPrograms.push(...pagePrograms);

      console.log(
        `EPG ${country} ${channelId}: day ${dayOffset + 1}/${EPG_DAYS}, page ${page}/${totalPages}, programmes ${pagePrograms.length}`
      );

      if (page >= totalPages || pagePrograms.length === 0) break;
      page++;
    }
  }

  // de-duplicate by programme id
  const seen = new Set();
  const deduped = [];

  for (const p of allPrograms) {
    if (!p?.id || seen.has(p.id)) continue;
    seen.add(p.id);
    deduped.push(p);
  }

  return deduped;
}

/* ---------------- MAIN ---------------- */

async function main() {
  ensureDirs();

  const xml = xmlbuilder.create("tv", { encoding: "UTF-8" });
  let programmeCount = 0;

  for (const country of COUNTRIES) {
    console.log(`▶ Processing country: ${country}`);

    let channels = [];
    try {
      channels = await fetchAllChannels(country);
    } catch (err) {
      console.log(`⚠ Skipping country ${country}: ${err.message}`);
      continue;
    }

    console.log(`Country ${country}: total channels ${channels.length}`);

    let m3u = '#EXTM3U x-tvg-url="../epg/zee5_epg.xml.gz"\n';

    for (const ch of channels) {
      const cid = `${ch.id}.${country}`;
      const title = ch.title || ch.id;
      const genre = ch.genres?.[0]?.value || "General";
      const lang = ch.languages?.[0] || "Unknown";
      const logo = normalizeImage(ch);

      // Channel node
      const chNode = xml.ele("channel", { id: cid });
      chNode.ele("display-name", title).up();
      if (logo) {
        chNode.ele("icon", { src: logo }).up();
      }

      // Programme nodes
      const programs = await limitEPG(() => fetchEPG7Days(ch.id, country));

      if (programs.length > 0) {
        for (const p of programs) {
          if (!p.start_time || !p.end_time) continue;

          const prog = xml.ele("programme", {
            start: xmlTime(p.start_time),
            stop: xmlTime(p.end_time),
            channel: cid
          });

          prog.ele("title", p.title || `${title} Live`).up();
          prog.ele("desc", p.description || "").up();
          prog.ele("category", p.genres?.[0]?.value || genre).up();

          programmeCount++;
        }
      } else {
        // Per-channel fallback EPG
        const now = Date.now();
        for (let i = 0; i < 6; i++) {
          const prog = xml.ele("programme", {
            start: xmlTime(new Date(now + i * 3600000)),
            stop: xmlTime(new Date(now + (i + 1) * 3600000)),
            channel: cid
          });

          prog.ele("title", `${title} Live`).up();
          prog.ele("desc", "EPG fallback").up();
          prog.ele("category", genre).up();

          programmeCount++;
        }
      }

      // Metadata playlist entry only if you have an authorized URL
      const authorizedUrl = resolveAuthorizedStreamUrl(ch, country);
      if (authorizedUrl) {
        const group = `${genre} | ${lang} (${country}) | ZEE5`;
        m3u += `#EXTINF:-1 tvg-id="${cid}" tvg-logo="${logo}" group-title="${group}",${title}\n`;
        m3u += `${authorizedUrl}\n`;
      }
    }

    fs.writeFileSync(path.join(PLAYLIST_DIR, `zee5_${country}.m3u`), m3u);
  }

  if (programmeCount === 0) {
    const prog = xml.ele("programme", {
      start: xmlTime(new Date()),
      stop: xmlTime(new Date(Date.now() + 3600000)),
      channel: "fallback"
    });
    prog.ele("title", "Live TV").up();
    prog.ele("desc", "Global fallback EPG").up();
  }

  fs.writeFileSync(
    path.join(EPG_DIR, "zee5_epg.xml.gz"),
    zlib.gzipSync(xml.end({ pretty: true }))
  );

  console.log("✅ ZEE5 metadata playlists & EPG generated");
}

main().catch(err => {
  console.error("❌ ZEE5 generator failed:", err.message);
  process.exit(1);
});
