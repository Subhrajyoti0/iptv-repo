import fs from "fs";
import zlib from "zlib";
import xmlbuilder from "xmlbuilder";
import pLimit from "p-limit";

import { createClient } from "../_shared/http.js";
import { formatDate } from "../_shared/utils.js";
import { resolveGenres } from "../_shared/genreResolver.js";

const client = createClient();
const limit = pLimit(5);

const COUNTRY = "IN";
const PLATFORM = "JioTV";
const CATCHUP_DAYS = 7;

console.log("▶ Fetching JioTV channel list…");

/* ---------------- CHANNEL LIST ---------------- */

const channelRes = await client.get(
  "https://jiotvapi.media.jio.com/apis/v1/getMobileChannelList"
);

const channels = channelRes.data?.result || [];

let m3u = '#EXTM3U x-tvg-url="../epg/jiotv_epg.xml.gz"\n';
const xml = xmlbuilder.create("tv", { encoding: "UTF-8" });

/* ---------------- MAIN LOOP ---------------- */

for (const ch of channels) {
  if (!ch.playback_url) continue;

  const cid = `${ch.channel_id}.${COUNTRY}`;
  const title = ch.channel_name;
  const logo = ch.logo || "";
  const lang = ch.language || "Unknown";

  const genres = resolveGenres(
    [ch.channelCategory, ch.genre].filter(Boolean)
  );

  const stream = `${ch.playback_url}|User-Agent=${encodeURIComponent(
    client.defaults.headers["User-Agent"]
  )}`;

  const catchupAttr = `catchup="default" catchup-days="${CATCHUP_DAYS}"`;

  /* M3U (one entry per genre for filtering) */
  genres.forEach(genre => {
    const group = `${genre} | ${lang} (${COUNTRY}) | ${PLATFORM}`;

    m3u += `#EXTINF:-1 tvg-id="${cid}" tvg-logo="${logo}" group-title="${group}" ${catchupAttr},${title}\n`;
    m3u += `${stream}\n`;
  });

  /* XMLTV CHANNEL */
  xml.ele("channel", { id: cid })
    .ele("display-name", title).up()
    .ele("icon", { src: logo });

  /* JioTV EPG (simplified, guide-only placeholder) */
  // JioTV EPG endpoints are inconsistent; players rely on catch‑up time range.
  // We place a rolling guide so catch‑up seeking works correctly.

  const now = Date.now();
  for (let i = 0; i < 24; i++) {
    const start = new Date(now + i * 60 * 60 * 1000);
    const end = new Date(now + (i + 1) * 60 * 60 * 1000);

    xml.ele("programme", {
      start: formatDate(start),
      stop: formatDate(end),
      channel: cid
    })
      .ele("title", title + " Live").up()
      .ele("desc", "Catch‑up enabled");
  }

  console.log(`✓ ${title}`);
}

/* ---------------- WRITE FILES ---------------- */

fs.mkdirSync("playlists", { recursive: true });
fs.mkdirSync("epg", { recursive: true });

fs.writeFileSync("playlists/jiotv_IN.m3u", m3u);
fs.writeFileSync(
  "epg/jiotv_epg.xml.gz",
  zlib.gzipSync(xml.end({ pretty: true }))
);

console.log("✅ JioTV playlists & EPG generated");
