export function normalizeJio(ch) {
  return {
    source: "jio",
    id: ch.id || String(ch.channel_id),
    name: ch.name || ch.channel_name,
    language: ch.language || ch.lang || null,
    group: ch.category || ch.group || null,
    quality: ch.quality || (ch.isHD ? "HD" : "SD"),
    logo: ch.logo || null,
    premium: Boolean(ch.premium || ch.is_premium),
    catchup: Boolean(ch.catchup || ch.isCatchupAvailable),
    raw: ch
  };
}

export function normalizeZee(ch) {
  return {
    source: "zee",
    id: ch.id || ch.channelId,
    name: ch.name || ch.title || ch.original_title,
    language: Array.isArray(ch.languages) ? ch.languages[0] : ch.language || null,
    group: Array.isArray(ch.genres) ? ch.genres[0]?.value : ch.genre || null,
    quality: inferQuality(ch.name || ch.title || ""),
    logo: ch.logo || ch.image || null,
    raw: ch
  };
}

export function normalizeIPTV(ch) {
  return {
    source: "iptv",
    id: ch.tvg_id || ch.id,
    name: ch.name || ch.tvg_name || ch.label,
    group: ch.group || ch.group_title || null,
    quality: inferQuality(`${ch.name || ""} ${ch.tvg_id || ""}`),
    url: ch.url || null,
    raw: ch
  };
}

function inferQuality(name = "") {
  const n = String(name).toLowerCase();
  if (/\b4k\b/.test(n)) return "4K";
  if (/\bhd\b/.test(n)) return "HD";
  if (/\bsd\b/.test(n)) return "SD";
  return null;
}
