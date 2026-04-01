import fs from 'fs';
import path from 'path';

import { fetchChannelsSequentially } from './catalogSequential.js';
import { fetchZee5EPG } from './epg.js';
import { normalizeProgramme } from './normalizeProgramme.js';
import { generateXMLTV } from './xmltv.js';

/* ===================== CONFIG ===================== */

const OUT_DIR = 'output';

const XML_FILE = path.join(OUT_DIR, 'zee5.xml');
const RAW_JSON = path.join(OUT_DIR, 'zee5_raw_epg.json');
const NORM_JSON = path.join(OUT_DIR, 'zee5_normalized_epg.json');
const PROGRESS_FILE = path.join(OUT_DIR, 'zee5_progress.json');

/**
 * ✅ 5 DAYS = 120 HOURS
 * Rolling window from NOW → NOW + 5 days
 */
const ROLLING_HOURS = 120;

/**
 * EPG must not be older than this
 * (prevents stale guide from being published)
 */
const MAX_STALE_HOURS = 6;

/* ===================== HELPERS ===================== */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  }
  return { lastIndex: 0 };
}

function saveProgress(index) {
  fs.writeFileSync(
    PROGRESS_FILE,
    JSON.stringify(
      { lastIndex: index, updatedAt: new Date().toISOString() },
      null,
      2
    )
  );
}

/**
 * ✅ Validate that EPG timestamps are recent (NOW window)
 */
function validateEPGIsRecent(programmesByChannel) {
  const now = Date.now();
  let newestTimestamp = 0;

  Object.values(programmesByChannel).forEach(programmes => {
    programmes.forEach(p => {
      const startMs = new Date(p.schedule.start).getTime();
      if (startMs > newestTimestamp) {
        newestTimestamp = startMs;
      }
    });
  });

  if (!newestTimestamp) {
    throw new Error('❌ No programme timestamps found');
  }

  const ageHours = Math.abs(now - newestTimestamp) / (1000 * 60 * 60);

  if (ageHours > MAX_STALE_HOURS) {
    throw new Error(
      `❌ EPG too old (${ageHours.toFixed(1)}h) — refusing to write XML`
    );
  }
}

/* ===================== MAIN ===================== */

export async function generateZee5() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const progress = loadProgress();
  let processedAnyChannel = false;

  const rawStore = {
    generated_at: new Date().toISOString(),
    window_hours: ROLLING_HOURS,
    channels: {}
  };

  const normalizedStore = {};
  const channelList = [];

  for await (const { index, channel } of fetchChannelsSequentially()) {

    /**
     * ✅ Resume logic
     * Skip channels already processed in previous run
     */
    if (index <= progress.lastIndex) continue;

    processedAnyChannel = true;

    console.log(`✅ Channel: ${channel.name} (${channel.id})`);
    console.log(`   📅 Fetching rolling EPG (next ${ROLLING_HOURS}h)`);

    channelList.push(channel);

    rawStore.channels[channel.id] = {
      meta: channel,
      epg: []
    };

    normalizedStore[channel.id] = [];

    /**
     * ✅ Fetch rolling EPG (NOW → NOW + 5 days)
     * API uses UTC (Z)
     */
    const rawEPG = await fetchZee5EPG(channel.id, ROLLING_HOURS);
    rawStore.channels[channel.id].epg = rawEPG;

    for (const item of rawEPG) {
      normalizedStore[channel.id].push(
        normalizeProgramme(item, channel)
      );
    }

    console.log(
      `   ✅ Stored ${normalizedStore[channel.id].length} programmes\n`
    );

    saveProgress(index);
    await sleep(1500); // human‑like pacing
  }

  /**
   * ✅ Cron safety:
   * If everything was skipped because resume was complete,
   * reset progress and exit cleanly.
   */
  if (!processedAnyChannel) {
    console.log('ℹ️ All channels skipped due to resume → resetting progress');
    if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
    process.exit(0);
  }

  /**
   * ✅ Hard guards — NEVER write empty XML
   */
  const totalProgrammes = Object.values(normalizedStore)
    .reduce((sum, arr) => sum + arr.length, 0);

  if (channelList.length === 0 || totalProgrammes === 0) {
    throw new Error('❌ Empty EPG — refusing to write XML');
  }

  /**
   * ✅ Validate timestamps are recent (real‑time)
   */
  validateEPGIsRecent(normalizedStore);

  /**
   * ✅ Write RAW + NORMALIZED JSON
   */
  fs.writeFileSync(RAW_JSON, JSON.stringify(rawStore, null, 2));
  fs.writeFileSync(NORM_JSON, JSON.stringify(normalizedStore, null, 2));

  /**
   * ✅ Generate Kodi‑correct XMLTV
   * (UTC → IST +0530 conversion happens inside xmltv.js)
   */
  const xml = generateXMLTV(channelList, normalizedStore);

  if (!xml.includes('<programme')) {
    throw new Error('❌ XML contains no <programme> entries');
  }

  fs.writeFileSync(XML_FILE, xml);

  console.log('✅ Zee5 real‑time 5‑day EPG generated successfully');
}

/* ===================== RUN ===================== */

if (import.meta.url === `file://${process.argv[1]}`) {
  generateZee5().catch(err => {
    console.error('❌ FATAL:', err.message);
    process.exit(1);
  });
}
