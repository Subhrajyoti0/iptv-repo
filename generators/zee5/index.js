import fs from 'fs'
import path from 'path'

import { fetchChannelsSequentially } from './catalogSequential.js'
import { fetchZee5EPG } from './epg.js'
import { normalizeProgramme } from './normalizeProgramme.js'
import { generateXMLTV } from './xmltv.js'

/* ================= CONFIG ================= */

const DAYS = 2

const OUTPUT_DIR = 'output'
const RAW_JSON = path.join(OUTPUT_DIR, 'zee5_raw_epg.json')
const NORMALIZED_JSON = path.join(OUTPUT_DIR, 'zee5_normalized_epg.json')
const XML_FILE = path.join(OUTPUT_DIR, 'zee5.xml')
const PROGRESS_FILE = path.join(OUTPUT_DIR, 'zee5_progress.json')

/* ========================================== */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}

/* ============ RESUME SUPPORT ============ */

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
      { lastIndex: index, updatedAt: new Date().toISOString() },
      null,
      2
    )
  )
}

/* ============ MAIN GENERATOR ============ */

export async function generateZee5() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const progress = loadProgress()

  const rawStore = {
    generated_at: new Date().toISOString(),
    days: DAYS,
    channels: {}
  }

  const normalizedStore = {}
  const channelList = []

  for await (const { index, channel } of fetchChannelsSequentially()) {

    /* ✅ RESUME: skip already processed channels */
    if (index <= progress.lastIndex) {
      continue
    }

    console.log(
      `✅ ${ordinal(index)} channel fetched from catalog: ${channel.name} (${channel.id})`
    )

    channelList.push(channel)

    rawStore.channels[channel.id] = {
      meta: channel,
      epg: {}
    }

    normalizedStore[channel.id] = []

    for (let day = 0; day < DAYS; day++) {
      console.log(`   📅 Fetching EPG day ${day + 1}`)

      const from = new Date()
      from.setUTCHours(0, 0, 0, 0)
      from.setUTCDate(from.getUTCDate() + day)

      const to = new Date(from)
      to.setUTCDate(to.getUTCDate() + 1)

      const rawEPG = await fetchZee5EPG(channel.id, from, to)

      rawStore.channels[channel.id].epg[`day_${day + 1}`] = rawEPG

      for (const item of rawEPG) {
        normalizedStore[channel.id].push(
          normalizeProgramme(item, channel)
        )
      }

      // Human‑like pause between days
      await sleep(1200)
    }

    console.log(
      `   ✅ Stored ${normalizedStore[channel.id].length} programmes\n`
    )

    /* ✅ SAVE RESUME CHECKPOINT AFTER SUCCESS */
    saveProgress(index)

    // Human‑like pause before next channel
    await sleep(2200)
  }

  /* ============ WRITE OUTPUT FILES ============ */

  // ✅ Write RAW JSON (EVERY SINGLE DETAIL)
  fs.writeFileSync(RAW_JSON, JSON.stringify(rawStore, null, 2))

  // ✅ Write NORMALIZED JSON
  fs.writeFileSync(NORMALIZED_JSON, JSON.stringify(normalizedStore, null, 2))

  // ✅ Generate XMLTV
  const xml = generateXMLTV(channelList, normalizedStore)

  /* ✅ VALIDATION: ABORT IF ESCAPED XML DETECTED */
  if (xml.includes('&lt;programme')) {
    throw new Error('❌ Escaped XML detected, aborting write')
  }

  fs.writeFileSync(XML_FILE, xml)

  console.log('\n✅ Zee5 EPG generation completed safely')
  console.log(`✅ Raw JSON       : ${RAW_JSON}`)
  console.log(`✅ Normalized JSON: ${NORMALIZED_JSON}`)
  console.log(`✅ XMLTV          : ${XML_FILE}`)
}

/* ============ AUTO RUN ============ */

if (import.meta.url === `file://${process.argv[1]}`) {
  generateZee5().catch(err => {
    console.error('\n❌ FATAL ERROR:', err.message)
    process.exit(1)
  })
}
``
