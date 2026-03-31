import fs from 'fs'
import { fetchZee5EPG } from './epg.js'
import { normalizeProgrammes } from './normalize.js'
import { generateXMLTV } from './xmltv.js'
import { generateM3U } from './m3u.js'
import { fetchChannelsFromCatalog } from './catalogChannels.js'
import { createLimiter } from '../../utils/rateLimit.js'

const DAYS = 2
const epgLimiter = createLimiter(1)

export async function generateZee5() {
  const channels = await fetchChannelsFromCatalog()
  const programmesByChannel = {}

  for (const channel of channels) {
    await epgLimiter(async () => {
      const collected = []
      for (let day = 0; day < DAYS; day++) {
        const from = new Date()
        from.setUTCHours(0, 0, 0, 0)
        from.setUTCDate(from.getUTCDate() + day)
        const to = new Date(from)
        to.setUTCDate(to.getUTCDate() + 1)

        try {
          const epg = await fetchZee5EPG(channel.id, from, to)
          collected.push(...epg)
        } catch (e) {
          console.error(`Error fetching ${channel.id}: ${e.message}`)
        }
        await new Promise(r => setTimeout(r, 1000))
      }
      if (collected.length) {
        programmesByChannel[channel.id] = normalizeProgrammes(collected)
      }
    })
  }

  // Write both files using the exact same 'channels' source
  fs.writeFileSync('zee5.xml', generateXMLTV(channels, programmesByChannel))
  fs.writeFileSync('zee5.m3u', generateM3U(channels))
  
  console.log('✅ Update complete: IDs synced and Timezone fixed.')
}
