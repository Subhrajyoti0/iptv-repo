import fs from "fs";

export function loadJSON(file, fallback = []) {
  if (!fs.existsSync(file)) {
    console.warn(`⚠️ Missing ${file}, using fallback`);
    return fallback;
  }

  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function loadAllSources() {
  return {
    jio: loadJSON("output/jio_channels.json", []),
    zee: loadZeeChannels(),
    iptv: loadJSON("output/in_parsed.json", [])
  };
}

function loadZeeChannels() {
  const raw = loadJSON("output/zee5_raw_epg.json", null);

  if (!raw || !raw.channels) {
    return [];
  }

  return Object.values(raw.channels)
    .map(entry => entry.meta)
    .filter(Boolean);
}
