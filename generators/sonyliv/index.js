console.log("ℹ️ SonyLIV generator disabled (API blocked upstream)");
process.exit(0);
import fs from "fs";
import zlib from "zlib";
import xmlbuilder from "xmlbuilder";
import pLimit from "p-limit";

import { createClient } from "../_shared/http.js";
import { formatDate } from "../_shared/utils.js";
import { resolveGenres } from "../_shared/genreResolver.js";

const client = createClient();
const limit = pLimit(3);

const COUNTRY = "IN";
const PLATFORM = "SonyLIV";
const CATCHUP_DAYS = 1;

console.log("▶ Fetching SonyLIV catalog…");

/* ---------------- FETCH CATALOG ---------------- */

async function getCatalog() {
  const res = await client.get(
    "https://apiv2.sonyliv.com/AGL/1.4/IN/ENG/WEB/LIVETV-CATALOG"
  );
  return res.data?.containers || [];
}

async function getStream(id) {
  try {
    const res = await client.get(
      `https://apiv2.sonyliv.com/AGL/1.4/IN/ENG/WEB/DETAILS/${id}`
    );
    return res.data?.videos?.[0]?.url || null;
  } catch {
    return null;
  }
}

/* ---------------- MAIN ---------------- */

const containers = await getCatalog();

let m3u = '#EXTM3U x-tvg-url="../epg/sonyliv_epg.xml.gz"\n';
const xml = xmlbuilder.create("tv", { encoding: "UTF-8" });

for (const block of containers) {
  for (const ch of block.items || []) {
    if (!ch.id || ch.isPremium) continue;

    const streamUrl = await limit(() => getStream(ch.id));
    if (!streamUrl) continue;

    const cid = `${ch.id}.${COUNTRY}`;
    const title = ch.title;
    const lang = ch.language || "Unknown";
    const logo = ch.image?.logo || "";

    const genres = resolveGenres(ch.genres || []);
    const stream =
      `${streamUrl}|User-Agent=${encodeURIComponent(
        client.defaults.headers["User-Agent"]
      )}`;

    const catchupAttr =
      `catchup="append" catchup-days="${CATCHUP_DAYS}"`;

    /* M3U (multi-genre support) */
    genres.forEach(genre => {
      const group =
        `${genre} | ${lang} (${COUNTRY}) | ${PLATFORM}`;

      m3u += `#EXTINF:-1 tvg-id="${cid}" tvg-logo="${logo}" group-title="${group}" ${catchupAttr},${title}\n`;
      m3u += `${stream}\n`;
    });

    /* XMLTV CHANNEL */
    xml.ele("channel", { id: cid })
      .ele("display-name", title).up()
      .ele("icon", { src: logo });

    /* Basic rolling EPG (catch‑up aligned) */
    const now = Date.now();
    for (let i = 0; i < 24; i++) {
      const start = new Date(now + i * 3600000);
      const end = new Date(now + (i + 1) * 3600000);

      xml.ele("programme", {
        start: formatDate(start),
        stop: formatDate(end),
        channel: cid
      })
        .ele("title", `${title} Live`).up()
        .ele("desc", "Catch‑up supported");
    }

    console.log(`✓ ${title}`);
  }
}

/* ---------------- WRITE FILES ---------------- */

fs.mkdirSync("playlists", { recursive: true });
fs.mkdirSync("epg", { recursive: true });

fs.writeFileSync("playlists/sonyliv_IN.m3u", m3u);
fs.writeFileSync(
  "epg/sonyliv_epg.xml.gz",
  zlib.gzipSync(xml.end({ pretty: true }))
);

console.log("✅ SonyLIV playlists & EPG generated");
``
