import fs from "fs";

const JIO_FILE = process.argv[2] || "output/jio_channels.json";
const M3U_FILE = process.argv[3] || "output/iptv_org_in.m3u";

const OUT_MATCHES = process.argv[4] || "output/jio_iptv_matches.json";
const OUT_REVIEW = "output/jio_iptv_review.json";
const OUT_TSV = "output/jio_iptv_matches.tsv";

function normalize(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/&/g, "and")
    .replace(/\b(hd|sd|uhd|fhd|4k)\b/g, "")
    .replace(/\b(india|in|usa|us|uk|intl|international)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function tvgBase(id = "") {
  return String(id)
    .replace(/\.[a-z]{2}(@[a-z0-9]+)?$/i, "")
    .replace(/@[a-z0-9]+$/i, "");
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

function parseM3U(text) {
  const lines = text.split(/\r?\n/);
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line.startsWith("#EXTINF")) continue;

    const url = lines[i + 1]?.trim();

    if (!url || url.startsWith("#")) continue;

    const tvgId = line.match(/tvg-id="([^"]*)"/)?.[1] || "";
    const tvgName = line.match(/tvg-name="([^"]*)"/)?.[1] || "";
    const logo = line.match(/tvg-logo="([^"]*)"/)?.[1] || "";
    const group = line.match(/group-title="([^"]*)"/)?.[1] || "";
    const label = line.split(",").slice(1).join(",").trim();

    out.push({
      tvg_id: tvgId,
      tvg_name: tvgName,
      label,
      name: tvgName || label || tvgId,
      logo,
      group,
      url,
      quality: qualityFromText(`${tvgId} ${tvgName} ${label}`)
    });
  }

  return out;
}

function buildIptvIndex(entries) {
  const index = new Map();

  for (const entry of entries) {
    const keys = [
      entry.tvg_name,
      entry.label,
      entry.name,
      tvgBase(entry.tvg_id),
      entry.tvg_id
    ]
      .map(normalize)
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

function main() {
  if (!fs.existsSync(JIO_FILE)) {
    throw new Error(`Missing ${JIO_FILE}`);
  }

  if (!fs.existsSync(M3U_FILE)) {
    throw new Error(`Missing ${M3U_FILE}`);
  }

  const jio = JSON.parse(fs.readFileSync(JIO_FILE, "utf8"));
  const m3u = fs.readFileSync(M3U_FILE, "utf8");
  const iptv = parseM3U(m3u);

  const iptvIndex = buildIptvIndex(iptv);

  const matches = [];
  const review = [];

  for (const ch of jio) {
    const jioName = ch.name || ch.channel_name;
    const key = normalize(jioName);

    const candidates = iptvIndex.get(key);
    const selected = chooseBestCandidate(ch, candidates);

    if (selected && selected.tvg_id) {
      matches.push({
        jio_id: String(ch.id || ch.channel_id),
        jio_name: jioName,
        jio_language: ch.language || ch.lang || null,
        jio_category: ch.category || ch.group || null,
        jio_quality: ch.quality || qualityFromText(jioName),
        tvg_id: selected.tvg_id,
        iptv_name: selected.name,
        iptv_label: selected.label,
        iptv_group: selected.group,
        iptv_quality: selected.quality,
        iptv_url: selected.url,
        match_key: key,
        method: "normalized-exact"
      });
    } else {
      review.push({
        jio_id: String(ch.id || ch.channel_id),
        jio_name: jioName,
        jio_language: ch.language || ch.lang || null,
        jio_category: ch.category || ch.group || null,
        jio_quality: ch.quality || qualityFromText(jioName),
        match_key: key,
        reason: "No normalized exact match in iptv-org M3U"
      });
    }
  }

  fs.mkdirSync("output", { recursive: true });

  fs.writeFileSync(OUT_MATCHES, JSON.stringify(matches, null, 2));
  fs.writeFileSync(OUT_REVIEW, JSON.stringify(review, null, 2));

  const tsv = [
    [
      "jio_id",
      "jio_name",
      "jio_language",
      "jio_category",
      "jio_quality",
      "tvg_id",
      "iptv_name",
      "iptv_group",
      "iptv_quality"
    ].join("\t"),
    ...matches.map(m =>
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
    )
  ].join("\n");

  fs.writeFileSync(OUT_TSV, tsv);

  console.log(`✅ Jio channels: ${jio.length}`);
  console.log(`✅ IPTV entries: ${iptv.length}`);
  console.log(`✅ Matches: ${matches.length}`);
  console.log(`⚠️ Review: ${review.length}`);
  console.log(`✅ ${OUT_MATCHES}`);
  console.log(`✅ ${OUT_REVIEW}`);
  console.log(`✅ ${OUT_TSV}`);
}

main();
