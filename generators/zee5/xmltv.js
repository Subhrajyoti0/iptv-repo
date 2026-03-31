const TIMEZONE_OFFSET = '+0530'

function escText(str = '') {
  return str.replace(/[<>&"']/g, c => ({
    '<': '&lt;', 
    '>': '&gt;', 
    '&': '&amp;', 
    '"': '&quot;', 
    "'": '&apos;'
  }[c]))
}

function pad(n) { return String(n).padStart(2, '0') }

function xmlTime(date) {
  // Logic: Adjust UTC to IST string format for Kodi
  const offsetDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
  return (
    offsetDate.getUTCFullYear() +
    pad(offsetDate.getUTCMonth() + 1) +
    pad(offsetDate.getUTCDate()) +
    pad(offsetDate.getUTCHours()) +
    pad(offsetDate.getUTCMinutes()) +
    pad(offsetDate.getUTCSeconds()) +
    ' ' + TIMEZONE_OFFSET
  )
}

export function generateXMLTV(channels, programmesByChannel) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<tv generator-info-name="zee5-epg">\n'

  channels.forEach(ch => {
    xml += `  <channel id="${ch.id}">\n`
    xml += `    <display-name lang="en">${escText(ch.name)}</display-name>\n`
    if (ch.image?.channel_square) {
      xml += `    <icon src="https://akamaividz2.zee5.com/image/upload/${ch.image.channel_square}.png"/>\n`
    }
    xml += `  </channel>\n`
  })

  for (const [channelId, progs] of Object.entries(programmesByChannel)) {
    progs.forEach(p => {
      xml += `  <programme channel="${channelId}" start="${xmlTime(new Date(p.start))}" stop="${xmlTime(new Date(p.stop))}">\n`
      xml += `    <title lang="en">${escText(p.title)}</title>\n`
      if (p.desc) xml += `    <desc lang="en">${escText(p.desc)}</desc>\n`
      xml += `  </programme>\n`
    })
  }

  xml += '</tv>'
  return xml
}
