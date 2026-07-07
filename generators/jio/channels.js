import fs from "fs";
import path from "path";
import { initIndianProxy } from "./proxy.js";
import { mapLang, mapCategory } from "./maps.js";

const CHANNEL_API =
  "https://jiotv.data.cdn.jio.com/apis/v3.0/getMobileChannelList/get/?os=android&devicetype=phone&usertype=tvYR7NSNn7rymo3F";

const LOGO_BASE = "https://jiotvimages.cdn.jio.com/dare_images/images/";
const DEFAULT_CACHE = "output/jio_channels.json";

export async function fetchChannels(options = {}) {
  const {
    cacheFile = DEFAULT_CACHE,
    allowEmpty = process.env.JIO_ALLOW_EMPTY !== "0",
    strict = process.env.JIO_STRICT === "1"
  } = options;

  // Await working proxy before dispatching downstream network calls
  await initIndianProxy();

  try {
    const res = await fetch(CHANNEL_API, {
      headers: {
        "user-agent": "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36",
        accept: "application/json,text/plain,*/*"
      }
    });

    if (!res.ok) {
      const body = await safeText(res);
      throw new Error(
        `JioTV channel list failed: ${res.status}${body ? ` body=${body.slice(0, 180)}` : ""}`
      );
    }

    const json = await res.json();

    if (!json || !Array.isArray(json.result)) {
      throw new Error("Invalid JioTV channel list response: missing result[]");
    }

    const channels = json.result
      .filter(ch => ch && ch.channel_id && ch.channel_name)
      .map(ch => normalizeJioChannel(ch));

    return channels;
  } catch (err) {
    console.warn(`⚠️ Jio channel fetch unavailable: ${err.message}`);

    if (strict) {
      throw err;
    }

    if (fs.existsSync(cacheFile)) {
      try {
        const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
        if (Array.isArray(cached)) {
          console.warn(`⚠️ Using cached Jio channels: ${cacheFile}`);
          return cached;
        }
      } catch (cacheErr) {
        console.warn(`⚠️ Cached Jio channel file is invalid: ${cacheErr.message}`);
      }
    }

    if (allowEmpty) {
      console.warn("⚠️ Continuing with empty Jio channel list. Zee5 + iptv-org pipeline can still run.");
      return [];
    }

    throw err;
  }
}

export function normalizeJioChannel(ch) {
  return {
    source: "jio",
    id: String(ch.channel_id),
    channel_id: ch.channel_id,
    order: Number(ch.channel_order || 0),
    name: ch.channel_name,
    langId: ch.channelLanguageId,
    language: mapLang(ch.channelLanguageId),
    categoryId: ch.channelCategoryId,
    category: mapCategory(ch.channelCategoryId),
    broadcasterId: ch.broadcasterId,
    quality: ch.isHD ? "HD" : "SD",
    isHD: Boolean(ch.isHD),
    logo: ch.logoUrl ? `${LOGO_BASE}${ch.logoUrl}` : null,
    logoFile: ch.logoUrl || null,
    premium: Boolean(ch.is_premium),
    catchup: Boolean(ch.isCatchupAvailable),
    stbCatchup: Boolean(ch.stbCatchup),
    businessType: ch.business_type || null,
    planType: ch.plan_type || null,
    price: ch.channelPrice || null,
    hidden: Boolean(ch.isHidden),
    fast: Boolean(ch.isFast),
    raw: ch
  };
}

export async function saveJioChannels(outFile = DEFAULT_CACHE) {
  const channels = await fetchChannels({ cacheFile: outFile });

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(channels, null, 2));

  return channels;
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
