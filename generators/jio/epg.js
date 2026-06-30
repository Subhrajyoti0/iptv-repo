import { sleep, retryFetch } from "./rateLimit.js";

const EPG_API = "https://jiotv.data.cdn.jio.com/apis/v1.3/getepg/get";
const POSTER_BASE = "https://jiotv.catchup.cdn.jio.com/dare_images/shows/";

export async function fetchEPG(channelId, offset = 0, langId = 6) {
  const url =
    `${EPG_API}?channel_id=${encodeURIComponent(channelId)}` +
    `&offset=${encodeURIComponent(offset)}` +
    `&langId=${encodeURIComponent(langId)}`;

  return retryFetch(async () => {
    const res = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0",
        "accept": "application/json"
      }
    });

    if (res.status === 404) {
      console.warn(`   ⚠️ no EPG for channel=${channelId}, offset=${offset}`);
      return [];
    }

    if (!res.ok) {
      throw new Error(`JioTV EPG failed for ${channelId} offset ${offset}: ${res.status}`);
    }

    const json = await res.json();

    if (Array.isArray(json.epg)) return json.epg;
    if (Array.isArray(json.result)) return json.result;

    return [];
  }, 2, 700);
}

export async function fetchEPGForChannel(channel, startOffset = 0, endOffset = 5) {
  const all = [];

  for (let offset = startOffset; offset <= endOffset; offset++) {
    try {
      const data = await fetchEPG(channel.id, offset, channel.langId || 6);

      for (const item of data) {
        const normalized = normalizeJioProgramme(item, channel, offset);

        if (normalized.start && normalized.stop && normalized.title) {
          all.push(normalized);
        }
      }

      console.log(`   ✅ offset=${offset}, programmes=${data.length}`);
      await sleep(250);
    } catch (err) {
      console.warn(`   ⚠️ offset ${offset} failed for ${channel.name}: ${err.message}`);
    }
  }

  return dedupeProgrammes(all);
}

export function normalizeJioProgramme(raw, channel, offset) {
  const image =
    raw.assets?.["16:9"]?.episode ||
    raw.assets?.["16:9"]?.program ||
    raw.episodeThumbnail ||
    raw.episodePoster ||
    "";

  return {
    source: "jio",
    channel: String(raw.channel_id || channel.id),
    channelName: raw.channel_name || channel.name,
    offset,
    start: normalizeEpoch(raw.startEpoch || raw.serverEpoch),
    stop: normalizeEpoch(raw.endEpoch),
    title: raw.showname || raw.showName || raw.title || "Unknown Programme",
    subtitle: raw.episode_num ? `Episode ${raw.episode_num}` : "",
    desc: raw.episode_desc || raw.description || "",
    category: raw.showCategory || raw.showGenre?.[0] || channel.category || "",
    genre: Array.isArray(raw.showGenre) ? raw.showGenre : [],
    image: normalizeImage(image),
    director: raw.director || "",
    actors: raw.starCast || "",
    rating: raw.pcr || "",
    repeat: Boolean(raw.willRepeat || raw.isRepeat),
    showId: raw.showId || "",
    srno: raw.srno || null,
    duration: raw.duration || null,
    isCatchupAvailable: Boolean(raw.isCatchupAvailable),
    isLiveAvailable: Boolean(raw.isLiveAvailable),
    premium: Boolean(raw.is_premium)
  };
}

function normalizeEpoch(value) {
  if (!value) return null;

  const n = Number(value);

  if (!Number.isFinite(n)) return null;

  const millis = n > 9999999999 ? n : n * 1000;

  return new Date(millis).toISOString();
}

function normalizeImage(value) {
  if (!value) return "";
  if (String(value).startsWith("http")) return value;

  return `${POSTER_BASE}${value}`;
}

function dedupeProgrammes(items) {
  const seen = new Set();
  const out = [];

  for (const p of items) {
    const key = `${p.channel}|${p.start}|${p.stop}|${p.title}`;

    if (seen.has(key)) continue;

    seen.add(key);
    out.push(p);
  }

  out.sort((a, b) => {
    return new Date(a.start).getTime() - new Date(b.start).getTime();
  });

  return out;
}
