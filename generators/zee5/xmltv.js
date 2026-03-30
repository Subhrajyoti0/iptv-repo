function esc(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function xmlTime(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('.000Z', ' +0000')
}

export function generateXMLTV(channels, programmesByChannel) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
  xml += `<tv>\n`

  // Channels
  for (const ch of channels) {
    xml += `  <channel id="${esc(ch.id)}">\n`
    xml += `    <display-name>${esc(ch.name)}</display-name>\n`
    if (ch.logo) {
      xml += `    <icon src="${esc(ch.logo)}"/>\n`
    }
    xml += `  </channel>\n`
  }

  // Programmes
  for (const [cid, progs] of Object.entries(programmesByChannel)) {
    for (const p of progs) {
      xml += `  <programme channel="${esc(cid)}" start="${xmlTime(p.start)}" stop="${xmlTime(p.stop)}">\n`
      xml += `    <title>${esc(p.title)}</title>\n`
      if (p.desc) {
        xml += `    <desc>${esc(p.desc)}</desc>\n`
      }
      for (const cat of p.categories || []) {
        xml += `    <category>${esc(cat)}</category>\n`
      }
      xml += `  </programme>\n`
    }
  }

  xml += `</tv>\n`
  return xml
}
