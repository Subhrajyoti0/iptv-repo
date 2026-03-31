import fs from 'fs'
import { fetchZee5EPG } from './epg.js'
import { normalizeProgrammes } from './normalize.js'
import { resolveChannelLogo } from './logos.js'
import { generateXMLTV } from './xmltv.js'
import { fetchZee5Channels } from './channels.js'
import { createLimiter } from '../../utils/rateLimit.js'

const limiter = createLimiter(3)
const DAYS = 2

export async function generateZee5() {
  console.log('📡 Fetching Zee5 channels...')
  const channels = await fetchZee5Channels()

  console.log(`✅ Found ${channels.length} channels`)

  const programmesByChannel = {}

  await Promise.all(
    channels.map(ch =>
      limiter(async () => {
        ch.logo = resolveChannelLogo(ch)
        const all = []

        for (let d = 0; d < DAYS; d++) {
          const from = new Date()
          from.setUTCHours(0, 0, 0, 0)
          from.setUTCDate(from.getUTCDate() + d)

          const to = new Date(from)
          to.setUTCDate(to.getUTCDate() + 1)

          const epg = await fetchZee5EPG(ch.id, from, to)
          all.push(...epg)
        }

        programmesByChannel[ch.id] = normalizeProgrammes(all)
      })
    )
  )

  const xml = generateXMLTV(channels, programmesByChannel)
  fs.writeFileSync('zee5.xml', xml)

  console.log('✅ zee5.xml generated successfully')
}

/* ✅ Auto-run when executed directly */
if (import.meta.url === `file://${process.argv[1]}`) {
  generateZee5().catch(err => {
    console.error('❌ Zee5 EPG generation failed:', err)
    process.exit(1)
  })
}
