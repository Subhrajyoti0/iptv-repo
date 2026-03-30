import fs from "fs";
import zlib from "zlib";
import axios from "axios";
import pLimit from "p-limit";
import xmlbuilder from "xmlbuilder";

import { createClient } from "../_shared/http.js";
import { formatDate } from "../_shared/utils.js";
import { resolveGenres } from "../_shared/genreResolver.js";

const limitHLS = pLimit(3);
const limitEPG = pLimit(5);

const COUNTRY = "IN";
const PLATFORM = "ZEE5";
const CATCHUP_DAYS = 2;

const client = createClient();

/* ---------------- TOKEN CACHE ---------------- */

let tokenCache = null;
let tokenExpiry = 0;

async function getToken() {
  if (tokenCache && Date.now() < tokenExpiry) return tokenCache;

  const res = await client.get(
    "https://useraction.zee5.com/token/platform_tokens.php?platform_name=web-app"
  );

  tokenCache = res.data.token;
  tokenExpiry = Date.now() + 25 * 60 * 1000;
  return tokenCache;
}

/* ---------------- STREAM ---------------- */

async function getHLS(id) {
  try {
    const token = await getToken();
    const res = await client.get(
      "https://allowance.zee5.com/v1/get_hls_url",
      {
        params: {
          content_id: id,
          platform: "web",
          device_id: Math.random().toString(36).slice(2)
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!res.data?.hls_url) return null;

    return `${res.data.hls_url}|User-Agent=${encodeURIComponent(
      client.defaults.headers["User-Agent"]
    )}`;
  } catch {
    return null;
  }
}

/* ---------------- EPG ---------------- */

async function getEPG(id) {
  try {
    const now = new Date();
    const end = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const res = await client.get("https://gwapi.zee5.com/v1/epg", {
      params: {
        channels: id,
        start: now.toISOString(),
        end: end.toISOString(),
        country: COUNTRY,
        translation: "en"
      }
    });

    return res.data.items || [];
  } catch {
    return [];
  }
}

/* ---------------- MAIN ---------------- */

console.log("▶ Fetching ZEE5 catalog…");

const catalog = await client.get(
  `https://catalogapi.zee5.com/v1/channel?limit=200&country=${COUNTRY}`
);

const channels = catalog.data.items || [];

let m3u = '#EXTM3U x-tvg-url="../epg/zee5_epg.xml.gz"\n';
const xml = xmlbuilder.create("tv", { encoding: "UTF-8" });

for (const ch of channels) {
  if (ch.business_type === "premium") continue;

  const stream = await limitHLS(() => getHLS(ch.id));
  if (!stream) continue;

  const cid = `${ch.id}.${COUNTRY}`;
  const title = ch.title;
  const lang = ch.languages?.[0] || "Unknown";
  const logo = ch.image?.cover || "";

  const genres = resolveGenres(
    ch.genres?.map(g => g.value) || []
  );

  const catchupAttr = `catchup="append" catchup-days="${CATCHUP_DAYS}"`;

  /* M3U ENTRY (one per genre for filtering) */
  genres.forEach(genre => {
    const group = `${genre} | ${lang} (${COUNTRY}) | ${PLATFORM}`;

    m3u += `#EXTINF:-1 tvg-id="${cid}" tvg-logo="${logo}" group-title="${group}" ${catchupAttr},${title}\n`;
    m3u += `${stream}\n`;
  });

  /* XMLTV CHANNEL */
  xml.ele("channel", { id: cid })
    .ele("display-name", title).up()
    .ele("icon", { src: logo });

  /* XMLTV PROGRAMS */
  const programs = await limitEPG(() => getEPG(ch.id));
  programs.forEach(p => {
    const prog = xml.ele("programme", {
      start: formatDate(p.start_time),
      stop: formatDate(p.end_time),
      channel: cid
    });
    prog.ele("title", p.title);
    prog.ele("desc", p.description || "");
  });

  console.log(`✓ ${title}`);
}

/* ---------------- WRITE OUTPUT ---------------- */

fs.mkdirSync("playlists", { recursive: true });
fs.mkdirSync("epg", { recursive: true });

fs.writeFileSync("playlists/zee5_IN.m3u", m3u);
fs.writeFileSync(
  "epg/zee5_epg.xml.gz",
  zlib.gzipSync(xml.end({ pretty: true }))
);

console.log("✅ ZEE5 playlists & EPG generated");
``
