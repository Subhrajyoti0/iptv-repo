import fs from 'fs'
import { fetchZee5EPG } from './epg.js'
import { normalizeProgrammes } from './normalize.js'
import { generateXMLTV } from './xmltv.js'
import { generateM3U } from './m3u.js'
import { fetchChannelsFromCatalog } from './catalogChannels.js'
import { createLimiter } from '../../utils/rateLimit.js'

/**
 * CONFIGURATION
 */
const DAYS = 2
const SEED_FILE = './generators/zee5/seedChannels.json'

/**
 * IMPORTANT:
 * Zee5 blocks aggressive EPG requests.
 * EPG MUST be fetched very slowly.
 */
const epgLimiter = createLimiter(1)

/**
 * Load seed channel IDs (auto-expanding)
 */
function loadSeedIds() {
  if (!fs.existsSync(SEED_FILE)) {
    return new Set()
  }
  try {
    const json = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'))
    return new Set(json.channels || [])
  } catch {
    return new Set()
  }
}

/**
 * Save expanded seed channel IDs
 */
function saveSeedIds(seedSet) {
  fs.writeFileSync(
    SEED_FILE,
    JSON.stringify({ channels: [...seedSet].sort() }, null, 2)
  )
}

/**
 * Load channels:
 * 1) Try Zee5 catalog API (all pages)
 * 2) Fallback to seed list if catalog is blocked
 */
async function loadChannels(seedIds) {
  try {
    console.log('📡 Loading channels from Zee5 catalog...')
    const channels = await fetchChannelsFromCatalog()
    console.log(`✅ ${channels.length} channels loaded from catalog`)
    return channels
  } catch (err) {
    console.warn(`⚠ Catalog API failed: ${err.message}`)
    console.warn('➡ Falling back to seed channel IDs')
    return [...seedIds].map(id => ({
      id,
      name: id,
      image: {},
      languages: [],
    }))
  }
}

/**
 * MAIN GENERATOR
 */
export async function generateZee5() {
  const seedIds = loadSeedIds()
  const channels = await loadChannels(seedIds)
  const programmesByChannel = {}

  console.log('📡 Fetching Zee5 EPG data (slow & human-like)...')

  await Promise.all(
    channels.map(channel =>
      epgLimiter(async () => {
        const collected = []

        for (let day = 0; day < DAYS; day++) {
          const from = new Date()
          from.setUTCHours(0, 0, 0, 0)
          from.setUTCDate(from.getUTCDate() + day)

          const to = new Date(from)
          to.setUTCDate(to.getUTCDate() + 1)

          const epg = await fetchZee5EPG(channel.id, from, to)
          collected.push(...epg)

          // ✅ Auto-discover channels from EPG itself
          for (const p of epg) {
            if (p.channel?.id) {
              seedIds.add(p.channel.id)
            }
          }

          // ✅ Human-like delay between days
          await new Promise(r => setTimeout(r, 1200))
        }

        if (collected.length) {
          programmesByChannel[channel.id] =
            normalizeProgrammes(collected)
        }
      })
    )
  )

  // ✅ Persist auto-expanded seeds
  saveSeedIds(seedIds)

  // ✅ Generate XMLTV
  const xml = generateXMLTV(channels, programmesByChannel)
  fs.writeFileSync('zee5.xml', xml)

  // ✅ Generate M3U playlist
  const m3u = generateM3U(channels)
  fs.writeFileSync('zee5.m3u', m3u)

  console.log(
    `✅ Generated zee5.xml + zee5.m3u | Channels: ${channels.length} | Seeds: ${seedIds.size}`
  )
}

/**
 * AUTO-RUN WHEN EXECUTED DIRECTLY
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  generateZee5().catch(err => {
    console.error('❌ Zee5 generation failed:', err)
    process.exit(1)
  })
}
