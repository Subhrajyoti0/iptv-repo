import fs from 'fs'
import path from 'path'

import { fetchChannelsSequentially } from './catalogSequential.js'
import { fetchZee5EPG } from './epg.js'
import { normalizeProgramme } from './normalizeProgramme.js'
import { generateXMLTV } from './xmltv.js'

/* ===================== CONFIG ===================== */

const OUT_DIR = 'output'

const XML_FILE = path.join(OUT_DIR, 'zee5.xml')
const RAW_JSON = path.join(OUT_DIR, 'zee5_raw_epg.json')
const NORM_JSON = path.join(OUT_DIR, 'zee5_normalized_epg.json')
const PROGRESS_FILE = path.join(OUT_DIR, 'zee5_progress.json')

/**
 * We are using GWAPI day-bucket mode:
 *   start=0
 *   end=5
 *
 * This means:
 *   today + next 5 day buckets
 *
 * We still call this "5-day+" coverage in practice.
 */
const EXPECTED_DAYS = 5

/* ===================== HELPERS ===================== */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'))
  }
  return { lastIndex: 0 }
}

function saveProgress(index) {
  fs.writeFileSync(
    PROGRESS_FILE,
    JSON.stringify(
      {
        lastIndex: index,
        updatedAt: new Date().toISOString()
      },
      null,
      2
    )
  )
}

/**
 * Validate that the EPG:
 * 1. Has programmes
 * 2. Covers "now" (or very close to now)
 * 3. Extends sufficiently into the future
 *
 * IMPORTANT:
 * Since Zee5 GWAPI with start=0&end=5 is day-bucket based,
 * future coverage from "now" may naturally be less than a literal
 * 5 * 24 hours if the current time is later in the day.
 *
 * Therefore we allow a relaxed buffer.
 */
function validateEPGCoverage(programmesByChannel, expectedDays = 5) {
  const now = Date.now()

  let earliestStart = Infinity
  let latestStop = 0
  let total = 0

  Object.values(programmesByChannel).forEach(programmes => {
    programmes.forEach(p => {
      const start = new Date(p.schedule.start).getTime()
      const stop = new Date(p.schedule.stop).getTime()

      if (!Number.isFinite(start) || !Number.isFinite(stop)) return

      if (start < earliestStart) earliestStart = start
      if (stop > latestStop) latestStop = stop
      total++
    })
  })

  if (total === 0) {
    throw new Error('❌ No programmes found in EPG')
  }

  /**
   * The guide should not start far in the future.
   * Allow up to 1 hour tolerance.
   */
  if (earliestStart > now + 60 * 60 * 1000) {
    throw new Error('❌ EPG does not cover current time (starts too far in future)')
  }

  /**
   * Relaxed expected future coverage:
   * expectedDays * 24 - 18 hours
   *
   * Why 18?
   * Because day-bucket APIs can lose most of "today" depending on current time.
   * This still guarantees strong future coverage without false failures.
   */
  const futureCoverageHours = (latestStop - now) / (1000 * 60 * 60)
  const minimumExpectedCoverage = expectedDays * 24 - 18

  if (futureCoverageHours < minimumExpectedCoverage) {
    throw new Error(
      `❌ EPG future coverage too short (${futureCoverageHours.toFixed(1)}h, expected ~${expectedDays * 24}h)`
    )
  }
}

/* ===================== MAIN ===================== */

export async function generateZee5() {
  console.log('🚀 Starting Zee5 generator...')
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const progress = loadProgress()
  let processedAnyChannel = false

  const rawStore = {
    generated_at: new Date().toISOString(),
    mode: 'gwapi-start-end',
    start: 0,
    end: 5,
    days: EXPECTED_DAYS,
    channels: {}
  }

  const normalizedStore = {}
  const channelList = []

  for await (const { index, channel } of fetchChannelsSequentially()) {
    /**
     * Resume guard:
     * skip channels already processed in previous run
     */
    if (index <= progress.lastIndex) continue

    processedAnyChannel = true

    console.log(`✅ Channel ${index}: ${channel.name} (${channel.id})`)
    console.log('   📅 Fetching EPG with start=0 end=5')

    channelList.push(channel)

    rawStore.channels[channel.id] = {
      meta: channel,
      epg: []
    }

    normalizedStore[channel.id] = []

    /**
     * IMPORTANT:
     * fetchZee5EPG() must be the updated version that uses:
     * start=0&end=5&page_size=550&translation=en&country=IN&time_offset=+05:30
     */
    const rawEPG = await fetchZee5EPG(channel.id)

    rawStore.channels[channel.id].epg = rawEPG

    for (const item of rawEPG) {
      normalizedStore[channel.id].push(
        normalizeProgramme(item, channel)
      )
    }

    console.log(`   ✅ Stored ${normalizedStore[channel.id].length} programmes\n`)

    saveProgress(index)

    // human-like pacing between channels
    await sleep(1500)
  }

  /**
   * Cron safety:
   * If all channels were skipped because of resume,
   * reset progress and exit without overwriting XML.
   */
  if (!processedAnyChannel) {
    console.log('ℹ️ All channels skipped due to resume → resetting progress')
    if (fs.existsSync(PROGRESS_FILE)) {
      fs.unlinkSync(PROGRESS_FILE)
    }
    process.exit(0)
  }

  /**
   * Hard guard: refuse to write empty EPG
   */
  const totalProgrammes = Object.values(normalizedStore)
    .reduce((sum, arr) => sum + arr.length, 0)

  if (channelList.length === 0 || totalProgrammes === 0) {
    throw new Error('❌ Empty EPG — refusing to write XML')
  }

  /**
   * Validate EPG window quality
   */
  validateEPGCoverage(normalizedStore, EXPECTED_DAYS)

  /**
   * Write RAW + NORMALIZED JSON
   */
  fs.writeFileSync(RAW_JSON, JSON.stringify(rawStore, null, 2))
  fs.writeFileSync(NORM_JSON, JSON.stringify(normalizedStore, null, 2))

  /**
   * Generate XMLTV
   */
  const xml = generateXMLTV(channelList, normalizedStore)

  /**
   * Safety guard: never write escaped or empty XML
   */
  if (xml.includes('&lt;programme') || xml.includes('&lt;channel')) {
    throw new Error('❌ Escaped XML detected — aborting write')
  }

  if (!xml.includes('<programme')) {
    throw new Error('❌ XML contains no <programme> entries')
  }

  fs.writeFileSync(XML_FILE, xml)

  console.log('✅ Zee5 EPG generated successfully')
  console.log(`✅ XML : ${XML_FILE}`)
  console.log(`✅ RAW : ${RAW_JSON}`)
  console.log(`✅ NORM: ${NORM_JSON}`)
}

/* ===================== AUTO RUN ===================== */

console.log('📄 index.js loaded')

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('▶ Running generateZee5()...')
  generateZee5().catch(err => {
    console.error('❌ FATAL:', err)
    process.exit(1)
  })
}
