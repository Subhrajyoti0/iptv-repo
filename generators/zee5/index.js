import fs from 'fs'
import path from 'path'

import { fetchChannelsSequentially } from './catalogSequential.js'
import { fetchZee5EPG } from './epg.js'
import { normalizeProgramme } from './normalizeProgramme.js'
import { generateXMLTV } from './xmltv.js'

const DAYS = 2

const OUT_DIR = 'output'
const XML_FILE = path.join(OUT_DIR, 'zee5.xml')
const RAW_JSON = path.join(OUT_DIR, 'zee5_raw_epg.json')
const NORM_JSON = path.join(OUT_DIR, 'zee5_normalized_epg.json')
const PROGRESS_FILE = path.join(OUT_DIR, 'zee5_progress.json')

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE))
  }
  return { lastIndex: 0 }
}

function saveProgress(index) {
  fs.writeFileSync(
    PROGRESS_FILE,
    JSON.stringify({ lastIndex: index, updatedAt: new Date().toISOString() }, null, 2)
  )
}

export async function generateZee5() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const progress = loadProgress()
  let processedAnyChannel = false

  const rawStore = { generated_at: new Date().toISOString(), days: DAYS, channels: {} }
  const normalizedStore = {}
  const channelList = []

  for await (const { index, channel } of fetchChannelsSequentially()) {
    if (index <= progress.lastIndex) continue

    processedAnyChannel = true
    console.log(`✅ ${index} channel fetched from catalog: ${channel.name} (${channel.id})`)

    channelList.push(channel)
    rawStore.channels[channel.id] = { meta: channel, epg: {} }
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

      for (const p of rawEPG) {
        normalizedStore[channel.id].push(normalizeProgramme(p, channel))
      }

      await sleep(1200)
    }

    console.log(`   ✅ Stored ${normalizedStore[channel.id].length} programmes\n`)
    saveProgress(index)
    await sleep(2200)
  }

  /* ✅ CRON SAFETY: all skipped */
  if (!processedAnyChannel) {
    console.log('ℹ️ All channels skipped due to resume → resetting progress')
    fs.unlinkSync(PROGRESS_FILE)
    process.exit(0)
  }

  const totalProgrammes = Object.values(normalizedStore)
    .reduce((sum, arr) => sum + arr.length, 0)

  if (channelList.length === 0 || totalProgrammes === 0) {
    throw new Error('❌ Empty EPG — refusing to write XML')
  }

  fs.writeFileSync(RAW_JSON, JSON.stringify(rawStore, null, 2))
  fs.writeFileSync(NORM_JSON, JSON.stringify(normalizedStore, null, 2))

  const xml = generateXMLTV(channelList, normalizedStore)

  if (xml.includes('&lt;programme')) {
    throw new Error('❌ Escaped XML detected — abort write')
  }

  fs.writeFileSync(XML_FILE, xml)

  console.log('✅ Zee5 EPG safely generated')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateZee5().catch(err => {
    console.error('❌ FATAL:', err.message)
    process.exit(1)
  })
}
