import { create } from 'xmlbuilder2'

function xmlTime(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('.000Z', ' +0000')
}

export function generateXMLTV(channels, programmesByChannel) {
  const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('tv')

  for (const ch of channels) {
    const c = root
      .ele('channel', { id: ch.id })
      .ele('display-name')
      .txt(ch.name)
      .up()

    if (ch.logo) c.ele('icon', { src: ch.logo })
  }

  for (const [cid, progs] of Object.entries(programmesByChannel)) {
    for (const p of progs) {
      const pr = root.ele('programme', {
        channel: cid,
        start: xmlTime(p.start),
        stop: xmlTime(p.stop),
      })

      pr.ele('title').txt(p.title)
      if (p.desc) pr.ele('desc').txt(p.desc)
      p.categories.forEach(cat => pr.ele('category').txt(cat))
    }
  }

  return root.end({ prettyPrint: true })
}
