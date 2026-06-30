import fs from "fs";
import readline from "readline";

const IPTV_ORG_IN_URL = "https://iptv-org.github.io/iptv/countries/in.m3u";

const OUT_DIR = "output";
const DOCS_DIR = "docs";

const IPTV_SNAPSHOT = "output/iptv_org_in.m3u";
const IPTV_PARSED = "output/in_parsed.json";

const JIO_CHANNELS = "output/jio_channels.json";
const JIO_EPG_JSONL = "output/jio_epg.jsonl";
const ZEE5_XML = "output/zee5.xml";

const OUT_XML = "output/kodi_master.xml";
const DOCS_XML = "docs/kodi_master.xml";
const SUMMARY_JSON = "output/kodi_master_summary.json";

const MATCHES_JSON = "output/jio_iptv_matches.json";
const REVIEW_JSON = "output/jio_iptv_review.json";
const MATCHES_TSV = "output/jio_iptv_matches.tsv";

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

function decodeBasicXml(value = "") {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function normalizeName(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/&/g, "and")
    .replace(/\b(hd|sd|uhd|fhd|4k)\b/g, "")
    .replace(/\b(india|in|usa|us|uk|intl|international)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function qualityFromText(value = "") {
  const v = String(value).toLowerCase();

  if (/\b4k\b/.test(v)) return "4K";
  if (/\buhd\b/.test(v)) return "UHD";
  if (/\bfhd\b/.test(v)) return "FHD";
  if (/\bhd\b/.test(v)) return "HD";
  if (/\bsd\b/.test(v)) return "SD";

  return null;
}

function tvgBase(id = "") {
  return String(id)
    .replace(/\.[a-z]{2}(@[a-z0-9]+)?$/i, "")
    .replace(/@[a-z0-9]+$/i, "");
}

function formatXMLTVTime(value) {
  if (!value) return "";

  if (/^\d{14}\s[+-]\d{4}$/.test(String(value))) {
    return String(value);
  }

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

function loadJson(file, fallback = []) {
  if (!fs.existsSync(file)) {
    console.warn(`⚠️ Missing ${file}; using fallback`);
    return fallback;
  }

  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept": "text/plain,application/x-mpegurl,*/*"
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }

  return await res.text();
}

function parseM3U(text) {
  const lines = text.split(/\r?\n/);
  const channels = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line.startsWith("#EXTINF")) continue;

    const url = lines[i + 1]?.trim();
    if (!url || url.startsWith("#")) continue;

    const tvgId = line.match(/tvg-id="([^"]*)"/)?.[1] || "";
    const tvgName = line.match(/tvg-name="([^"]*)"/)?.[1] || "";
    const tvgLogo = line.match(/tvg-logo="([^"]*)"/)?.[1] || "";
    const group = line.match(/group-title="([^"]*)"/)?.[1] || "";
    const label = line.split(",").slice(1).join(",").trim();

    channels.push({
      tvg_id: tvgId,
      tvg_name: tvgName,
      name: tvgName || label || tvgId,
      label,
      logo: tvgLogo,
      group,
      url,
      quality: qualityFromText(`${tvgId} ${tvgName} ${label}`)
    });
  }

  return channels;
}

function fallbackChannelId(ch, index) {
  const base =
    normalizeName(ch.tvg_id) ||
    normalizeName(ch.tvg_name) ||
    normalizeName(ch.name) ||
    normalizeName(ch.label) ||
    `channel${index + 1}`;

  return `${base}.in`;
}

function buildIptvIndex(iptvChannels) {
  const index = new Map();

  for (const entry of iptvChannels) {
    const keys = [
      entry.tvg_name,
      entry.label,
      entry.name,
      tvgBase(entry.tvg_id),
      entry.tvg_id
    ]
      .map(normalizeName)
      .filter(Boolean);

    for (const key of keys) {
      if (!index.has(key)) {
        index.set(key, []);
      }

      index.get(key).push(entry);
    }
  }

  return index;
}

function chooseBestCandidate(jio, candidates) {
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const jioQuality = jio.quality || qualityFromText(jio.name);

  if (jioQuality) {
    const qualityMatch = candidates.find(c => c.quality === jioQuality);
    if (qualityMatch) return qualityMatch;
  }

  const indiaMatch = candidates.find(c => /\.in(@|$)/i.test(c.tvg_id));
  if (indiaMatch) return indiaMatch;

  return candidates[0];
}

function buildJioMatches(jioChannels, iptvChannels) {
  const index = buildIptvIndex(iptvChannels);
  const matches = [];
  const review = [];
  const map = new Map();

  for (const ch of jioChannels) {
    const name = ch.name || ch.channel_name || "";
    const key = normalizeName(name);
    const candidates = index.get(key);
    const selected = chooseBestCandidate(ch, candidates);

    if (selected && selected.tvg_id) {
      const match = {
        jio_id: String(ch.id || ch.channel_id),
        jio_name: name,
        jio_language: ch.language || ch.lang || null,
        jio_category: ch.category || ch.group || null,
        jio_quality: ch.quality || qualityFromText(name),
        tvg_id: selected.tvg_id,
        iptv_name: selected.name,
        iptv_label: selected.label,
        iptv_group: selected.group,
        iptv_quality: selected.quality,
        iptv_url: selected.url,
        match_key: key,
        method: "normalized-exact"
      };

      matches.push(match);
      map.set(match.jio_id, match.tvg_id);
    } else {
      review.push({
        jio_id: String(ch.id || ch.channel_id),
        jio_name: name,
        jio_language: ch.language || ch.lang || null,
        jio_category: ch.category || ch.group || null,
        jio_quality: ch.quality || qualityFromText(name),
        match_key: key,
        reason: "No normalized exact match in iptv-org M3U"
      });
    }
  }

  return { matches, review, map };
}

function writeChannel(stream, ch, index) {
  const id = ch.tvg_id || fallbackChannelId(ch, index);
  const name = ch.tvg_name || ch.name || ch.label || id;

  stream.write(`  <channel id="${escapeXml(id)}">\n`);
  stream.write(`    <display-name>${escapeXml(name)}</display-name>\n`);

  if (ch.logo) {
    stream.write(`    " />\n`);
  }

  if (ch.group) {
    stream.write(`    <category>${escapeXml(ch.group)}</category>\n`);
  }

  stream.write(`  </channel>\n`);
}

function writeProgramme(stream, programme) {
  const start = formatXMLTVTime(programme.start);
  const stop = formatXMLTVTime(programme.stop);
  const channel = programme.channel;
  const title = programme.title;

  if (!start || !stop || !channel || !title) return false;

  stream.write(`  <programme start="${start}" stop="${stop}" channel="${escapeXml(channel)}">\n`);
  stream.write(`    <title lang="en">${escapeXml(title)}</title>\n`);

  if (programme.subtitle) {
    stream.write(`    <sub-title lang="en">${escapeXml(programme.subtitle)}</sub-title>\n`);
  }

  if (programme.desc) {
    stream.write(`    <desc lang="en">${escapeXml(programme.desc)}</desc>\n`);
  }

  if (programme.category) {
    stream.write(`    <category lang="en">${escapeXml(programme.category)}</category>\n`);
  }

  if (Array.isArray(programme.genre)) {
    for (const g of programme.genre) {
      if (g && g !== programme.category) {
        stream.write(`    <category lang="en">${escapeXml(g)}</category>\n`);
      }
    }
  }

  if (programme.image) {
    stream.write(`    " />\n`);
  }

  if (programme.director || programme.actors) {
    stream.write(`    <credits>\n`);

    if (programme.director) {
      const directors = String(programme.director)
        .split(",")
        .map(x => x.trim())
        .filter(Boolean);

      for (const d of directors) {
        stream.write(`      <director>${escapeXml(d)}</director>\n`);
      }
    }

    if (programme.actors) {
      const actors = String(programme.actors)
        .split(",")
        .map(x => x.trim())
        .filter(Boolean);

      for (const a of actors) {
        stream.write(`      <actor>${escapeXml(a)}</actor>\n`);
      }
    }

    stream.write(`    </credits>\n`);
  }

  if (programme.rating) {
    stream.write(`    <rating system="JioTV"><value>${escapeXml(programme.rating)}</value></rating>\n`);
  }

  if (programme.repeat) {
    stream.write(`    <previously-shown />\n`);
  }

  stream.write(`  </programme>\n`);

  return true;
}

async function writeJioProgrammes(stream, jioToTvg) {
  if (!fs.existsSync(JIO_EPG_JSONL)) {
    console.warn(`⚠️ Missing ${JIO_EPG_JSONL}; skipping Jio programmes`);
    return 0;
  }

  let count = 0;

  const rl = readline.createInterface({
    input: fs.createReadStream(JIO_EPG_JSONL),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const p = JSON.parse(line);
      const tvgId = jioToTvg.get(String(p.channel));

      if (!tvgId) continue;

      const ok = writeProgramme(stream, {
        ...p,
        channel: tvgId
      });

      if (ok) count++;
    } catch (err) {
      console.warn(`⚠️ Bad Jio JSONL line skipped: ${err.message}`);
    }
  }

  return count;
}

function extractXmlAttr(tag, attr) {
  const re = new RegExp(`${attr}="([^"]*)"`);
  return tag.match(re)?.[1] || "";
}

function extractXmlText(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? decodeBasicXml(m[1].trim()) : "";
}

function extractXmlIcon(block) {
  return block.match(/<icon[^>]*src="([^"]+)"/i)?.[1] || "";
}

function parseZeeProgrammes(xml) {
  const programmes = [];
  const re = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi;

  let match;

  while ((match = re.exec(xml)) !== null) {
    const attrs = match[1];
    const body = match[2];

    programmes.push({
      source: "zee",
      originalChannel: extractXmlAttr(attrs, "channel"),
      start: extractXmlAttr(attrs, "start"),
      stop: extractXmlAttr(attrs, "stop"),
      title: extractXmlText(body, "title"),
      subtitle: extractXmlText(body, "sub-title"),
      desc: extractXmlText(body, "desc"),
      category: extractXmlText(body, "category"),
      image: extractXmlIcon(body)
    });
  }

  return programmes;
}

async function writeZeeProgrammes(stream, validTvgIds) {
  if (!fs.existsSync(ZEE5_XML)) {
    console.warn(`⚠️ Missing ${ZEE5_XML}; skipping Zee5 programmes`);
    return 0;
  }

  const xml = fs.readFileSync(ZEE5_XML, "utf8");
  const programmes = parseZeeProgrammes(xml);

  let count = 0;

  for (const p of programmes) {
    if (!validTvgIds.has(p.originalChannel)) continue;

    const ok = writeProgramme(stream, {
      ...p,
      channel: p.originalChannel
    });

    if (ok) count++;
  }

  return count;
}

function writeMatchTsv(matches) {
  const header = [
    "jio_id",
    "jio_name",
    "jio_language",
    "jio_category",
    "jio_quality",
    "tvg_id",
    "iptv_name",
    "iptv_group",
    "iptv_quality"
  ].join("\t");

  const rows = matches.map(m =>
    [
      m.jio_id,
      m.jio_name,
      m.jio_language || "",
      m.jio_category || "",
      m.jio_quality || "",
      m.tvg_id,
      m.iptv_name,
      m.iptv_group || "",
      m.iptv_quality || ""
    ].join("\t")
  );

  fs.writeFileSync(MATCHES_TSV, [header, ...rows].join("\n"));
}

async function generateKodiMaster() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(DOCS_DIR, { recursive: true });

  console.log(`📡 Fetching iptv-org India playlist: ${IPTV_ORG_IN_URL}`);

  const m3u = await fetchText(IPTV_ORG_IN_URL);

  fs.writeFileSync(IPTV_SNAPSHOT, m3u);

  const iptvChannels = parseM3U(m3u);

  if (iptvChannels.length === 0) {
    throw new Error("iptv-org India playlist parsed zero channels");
  }

  fs.writeFileSync(IPTV_PARSED, JSON.stringify(iptvChannels, null, 2));

  const validTvgIds = new Set(
    iptvChannels.map((ch, i) => ch.tvg_id || fallbackChannelId(ch, i))
  );

  const jioChannels = loadJson(JIO_CHANNELS, []);
  const { matches, review, map: jioToTvg } = buildJioMatches(jioChannels, iptvChannels);

  fs.writeFileSync(MATCHES_JSON, JSON.stringify(matches, null, 2));
  fs.writeFileSync(REVIEW_JSON, JSON.stringify(review, null, 2));
  writeMatchTsv(matches);

  console.log(`📦 iptv-org channels : ${iptvChannels.length}`);
  console.log(`📦 Jio channels      : ${jioChannels.length}`);
  console.log(`📦 Jio matches       : ${matches.length}`);
  console.log(`⚠️ Jio review        : ${review.length}`);

  const stream = fs.createWriteStream(OUT_XML, { encoding: "utf8" });

  stream.write(`<?xml version="1.0" encoding="UTF-8"?>\n`);
  stream.write(
    `<tv generator-info-name="iptv-repo-kodi-master" generator-info-url="https://github.com/Subhrajyoti0/iptv-repo">\n`
  );

  let channelCount = 0;

  for (let i = 0; i < iptvChannels.length; i++) {
    writeChannel(stream, iptvChannels[i], i);
    channelCount++;
  }

  const jioProgrammeCount = await writeJioProgrammes(stream, jioToTvg);
  const zeeProgrammeCount = await writeZeeProgrammes(stream, validTvgIds);

  stream.write(`</tv>\n`);

  await new Promise((resolve, reject) => {
    stream.end(resolve);
    stream.on("error", reject);
  });

  fs.copyFileSync(OUT_XML, DOCS_XML);

  const totalProgrammes = jioProgrammeCount + zeeProgrammeCount;

  const summary = {
    generated_at: new Date().toISOString(),
    iptv_org_source: IPTV_ORG_IN_URL,
    iptv_snapshot: IPTV_SNAPSHOT,
    output_xml: OUT_XML,
    docs_xml: DOCS_XML,
    kodi_epg_url: "https://subhrajyoti0.github.io/iptv-repo/docs/kodi_master.xml",
    iptv_org_channels: iptvChannels.length,
    xml_channels: channelCount,
    jio_channels: jioChannels.length,
    jio_matched_channels: matches.length,
    jio_review_channels: review.length,
    jio_programmes: jioProgrammeCount,
    zee_programmes: zeeProgrammeCount,
    total_programmes: totalProgrammes,
    compatibility:
      "Every iptv-org India M3U entry is written as an XMLTV channel. Programme records are written only when matched to an iptv-org tvg-id."
  };

  fs.writeFileSync(SUMMARY_JSON, JSON.stringify(summary, null, 2));

  console.log(`✅ Kodi master XMLTV saved: ${OUT_XML}`);
  console.log(`✅ Docs copy saved        : ${DOCS_XML}`);
  console.log(`✅ Channels written      : ${channelCount}`);
  console.log(`✅ Jio programmes        : ${jioProgrammeCount}`);
  console.log(`✅ Zee programmes        : ${zeeProgrammeCount}`);
  console.log(`✅ Total programmes      : ${totalProgrammes}`);

  if (totalProgrammes === 0) {
    throw new Error("Kodi master XMLTV has zero programmes. Matching/input EPG failed.");
  }
}

generateKodiMaster().catch(err => {
  console.error("❌ Kodi master XMLTV generation failed:", err.message);
  process.exit(1);
});
