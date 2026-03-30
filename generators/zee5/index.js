import fs from 'fs'
import { fetchZee5EPG } from './epg.js'
import { normalizeProgrammes } from './normalize.js'
import { resolveChannelLogo } from './logos.js'
import { generateXMLTV } from './xmltv.js'
import { createLimiter } from '../../utils/rateLimit.js'

const limiter = createLimiter(3)
const DAYS = 2

export async function generateZee5(channels) {
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

          all.push(...await fetchZee5EPG(ch.id, from, to))
        }

        programmesByChannel[ch.id] = normalizeProgrammes(all)
      })
    )
  )

  const xml = generateXMLTV(channels, programmesByChannel)
  fs.writeFileSync('zee5.xml', xml)
}
