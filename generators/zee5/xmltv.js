const TIMEZONE_OFFSET = '+0530'

function escText(str = '') {
  return str.replace(/[<>&"']/g, c => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
  }[c]))
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function xmlTime(date) {
  // Fix: Offset the UTC date to match IST for the string output
  const offsetDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
  return (
    offsetDate.getUTCFullYear() +
    pad(offsetDate.getUTCMonth() + 1) +
    pad(offsetDate.getUTCDate()) +
    pad(offsetDate.getUTCHours()) +
    pad(offsetDate.getUTCMinutes()) +
    pad(offsetDate.getUTCSeconds()) +
    ' ' +
    TIMEZONE_OFFSET
  )
}

export function generateXMLTV(channels, programmesByChannel) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<tv generator-info-name="zee5-epg">\n'

  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i]
    xml += `  <channel id="${ch.id}">\n`
    xml += `    <display-name lang="en">${escText(ch.name)}</display-name>\n`
    if (ch.image?.channel_square) {
      xml += `    <icon src="https://akamaividz2.zee5.com/image/upload/${ch.image.channel_square}.png"/>\n`
    }
    xml += `  </channel>\n`
  }

  for (const [channelId, progs] of Object.entries(programmesByChannel)) {
    for (const p of progs) {
      xml += `  <programme channel="${channelId}" start="${xmlTime(new Date(p.start))}" stop="${xmlTime(new Date(p.stop))}">\n`
      xml += `    <title lang="en">${escText(p.title)}</title>\n`
      if (p.desc) xml += `    <desc lang="en">${escText(p.desc)}</desc>\n`
      if (p.categories) {
        p.categories.forEach(cat => {
          xml += `    <category lang="en">${escText(cat)}</category>\n`
        })
      }
      xml += `  </programme>\n`
    }
  }

  xml += '</tv>'
  return xml
}
