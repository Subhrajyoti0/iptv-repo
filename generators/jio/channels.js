import fs from "fs";
import path from "path";
import { mapLang, mapCategory } from "./maps.js";

const CHANNEL_API =
  "https://jiotv.data.cdn.jio.com/apis/v3.0/getMobileChannelList/get/?os=android&devicetype=phone&usertype=tvYR7NSNn7rymo3F";

const LOGO_BASE = "https://jiotvimages.cdn.jio.com/dare_images/images/";

export async function fetchChannels() {
  const res = await fetch(CHANNEL_API, {
    headers: {
      "user-agent": "Mozilla/5.0",
      accept: "application/json"
    }
  });

  if (!res.ok) {
    throw new Error(`JioTV channel list failed: ${res.status}`);
  }

  const json = await res.json();

  if (!json || !Array.isArray(json.result)) {
    throw new Error("Invalid JioTV channel list response");
  }

  return json.result
    .filter(ch => ch && ch.channel_id && ch.channel_name)
    .map(ch => normalizeJioChannel(ch));
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

export async function saveJioChannels(outFile = "output/jio_channels.json") {
  const channels = await fetchChannels();

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(channels, null, 2));

  return channels;
}
