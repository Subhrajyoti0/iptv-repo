import fs from "fs";
import path from "path";

import { fetchChannels } from "./channels.js";
import { fetchEPGForChannel } from "./epg.js";
import { sleep } from "./rateLimit.js";

const OUT_DIR = "output";

const CHANNEL_JSON = path.join(OUT_DIR, "jio_channels.json");
const EPG_JSON_SUMMARY = path.join(OUT_DIR, "jio_epg.json");
const EPG_JSONL = path.join(OUT_DIR, "jio_epg.jsonl");
const XML_FILE = path.join(OUT_DIR, "jio_epg.xml");
const STATS_FILE = path.join(OUT_DIR, "jio_epg_stats.json");

const LIMIT = Number(process.env.JIO_LIMIT || 0);
const START_OFFSET = Number(process.env.JIO_START_OFFSET || 0);
const END_OFFSET = Number(process.env.JIO_END_OFFSET || 5);

export async function generateJio() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log("📡 Fetching JioTV channels...");

  let channels = await fetchChannels({
    cacheFile: CHANNEL_JSON,
    allowEmpty: true
  });

  channels = channels.filter(ch => !ch.hidden);

  if (LIMIT > 0) {
    channels = channels.slice(0, LIMIT);
    console.log(`⚙️ Test mode enabled: JIO_LIMIT=${LIMIT}`);
  }

  console.log(`✅ Jio channels available: ${channels.length}`);
  console.log(`📅 Jio EPG offset range: ${START_OFFSET} → ${END_OFFSET}`);

  fs.writeFileSync(CHANNEL_JSON, JSON.stringify(channels, null, 2));

  const jsonlStream = fs.createWriteStream(EPG_JSONL, { encoding: "utf8" });
  const xmlStream = fs.createWriteStream(XML_FILE, { encoding: "utf8" });

  xmlStream.write(`<?xml version="1.0" encoding="UTF-8"?>\n`);
  xmlStream.write(`<tv generator-info-name="iptv-repo-jio">\n`);

  for (const ch of channels) {
    writeXmlChannel(xmlStream, ch);
  }

  const epgStats = [];
  let totalProgrammes = 0;

  if (channels.length === 0) {
    console.warn("⚠️ No Jio channels available. Writing empty Jio EPG files and continuing.");
  }

  for (const [i, channel] of channels.entries()) {
    console.log(`📺 [${i + 1}/${channels.length}] Fetching Jio EPG: ${channel.name}`);

    try {
      const programmes = await fetchEPGForChannel(channel, START_OFFSET, END_OFFSET);

      for (const p of programmes) {
        jsonlStream.write(JSON.stringify(p) + "\n");
        writeXmlProgramme(xmlStream, p);
      }

      totalProgrammes += programmes.length;

      epgStats.push({
        channel: channel.id,
        name: channel.name,
        programmes: programmes.length
      });

      console.log(`   ✅ programmes: ${programmes.length}`);
    } catch (err) {
      epgStats.push({
        channel: channel.id,
        name: channel.name,
        programmes: 0,
        error: err.message
      });

      console.warn(`   ⚠️ skipped ${channel.name}: ${err.message}`);
    }

    await sleep(500);
  }

  xmlStream.write(`</tv>\n`);

  await closeStream(jsonlStream);
  await closeStream(xmlStream);

  fs.writeFileSync(STATS_FILE, JSON.stringify(epgStats, null, 2));

  fs.writeFileSync(
    EPG_JSON_SUMMARY,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        status: channels.length === 0 ? "jio_unavailable" : "ok",
        format: "jsonl",
        full_epg_jsonl: "output/jio_epg.jsonl",
        xmltv: "output/jio_epg.xml",
        channels: channels.length,
        total_programmes: totalProgrammes,
        offset_start: START_OFFSET,
        offset_end: END_OFFSET
      },
      null,
      2
    )
  );

  console.log("✅ JioTV generation step complete");
  console.log(`✅ Channels      : ${CHANNEL_JSON}`);
  console.log(`✅ EPG JSONL     : ${EPG_JSONL}`);
  console.log(`✅ EPG Summary   : ${EPG_JSON_SUMMARY}`);
  console.log(`✅ XMLTV         : ${XML_FILE}`);
  console.log(`✅ Stats         : ${STATS_FILE}`);
  console.log(`✅ Total programmes: ${totalProgrammes}`);

  if (totalProgrammes === 0) {
    console.warn("⚠️ Jio EPG produced zero programmes. Build will continue.");
  }
}

function closeStream(stream) {
  return new Promise((resolve, reject) => {
    stream.end(() => resolve());
    stream.on("error", reject);
  });
}

function escapeXml(value = "") {
  return String(value).replace(/[<>&'"]/g, char => {
    return {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "'": "&apos;",
      '"': "&quot;"
    }[char];
  });
}

function formatXMLTVTime(value) {
  if (!value) return "";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(d);

  const get = type => parts.find(p => p.type === type)?.value || "00";

  return (
    `${get("year")}${get("month")}${get("day")}` +
    `${get("hour")}${get("minute")}${get("second")} +0530`
  );
}

function writeXmlChannel(stream, ch) {
  stream.write(`  <channel id="${escapeXml(ch.id)}">\n`);
  stream.write(`    <display-name>${escapeXml(ch.name)}</display-name>\n`);

  if (ch.logo) {
    stream.write(`    <icon src="${escapeXml(ch.logo)}" />\n`);
  }

  stream.write(`  </channel>\n`);
}

function writeXmlProgramme(stream, p) {
  const start = formatXMLTVTime(p.start);
  const stop = formatXMLTVTime(p.stop);

  if (!start || !stop) return;

  stream.write(`  <programme start="${start}" stop="${stop}" channel="${escapeXml(p.channel)}">\n`);
  stream.write(`    <title lang="en">${escapeXml(p.title)}</title>\n`);

  if (p.subtitle) {
    stream.write(`    <sub-title lang="en">${escapeXml(p.subtitle)}</sub-title>\n`);
  }

  if (p.desc) {
    stream.write(`    <desc lang="en">${escapeXml(p.desc)}</desc>\n stream.write(`    <category lang="en">${escapeXml(p.category)}</category>\n`);
  }

  if (Array.isArray(p.genre)) {
    for (const g of p.genre) {
      if (g && g !== p.category) {
        stream.write(`    <category lang="en">${escapeXml(g)}</category>\n`);
      }
    }
  }

  if (p.image) {
    stream.write(`    " />\n`);
  }

  if (p.director || p.actors) {
    stream.write(`    <credits>\n`);

    if (p.director) {
      for (const d of String(p.director).split(",").map(x => x.trim()).filter(Boolean)) {
        stream.write(`      <director>${escapeXml(d)}</director>\n`);
      }
    }

    if (p.actors) {
      for (const a of String(p.actors).split(",").map(x => x.trim()).filter(Boolean)) {
        stream.write(`      <actor>${escapeXml(a)}</actor>\n`);
      }
    }

    stream.write(`    </credits>\n`);
  }

  if (p.rating) {
    stream.write(`    <rating system="JioTV"><value>${escapeXml(p.rating)}</value></rating>\n`);
  }

  if (p.repeat) {
    stream.write(`    <previously-shown />\n`);
  }

  stream.write(`  </programme>\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateJio().catch(err => {
    console.error("❌ Jio generator failed:", err);
    process.exit(1);
  });
}
