/**
 * Kodi-safe XMLTV generator
 * ✅ Correct timestamp format (NO 'T')
 * ✅ Proper <icon> tags
 * ✅ channel-number support
 * ✅ Strict XML escaping
 */

function escapeXml(str = '') {
  return str.replace(/[<>&'"]/g, ch => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
  }[ch]))
}

/**
 * Kodi-required time format:
 * YYYYMMDDHHMMSS +0000
 */
function xmlTime(date) {
  const pad = n => String(n).padStart(2, '0')

  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    ' +0000'
  )
}

export function generateXMLTV(channels, programmesByChannel) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<tv generator-info-name="zee5-epg">\n'

  /* Channels */
  channels.forEach((ch, index) => {
    xml += `  <channel id="${escapeXml(ch.id)}">\n`
    xml += `    <display-name>${escapeXml(ch.name)}</display-name>\n`
    xml += `    <channel-number>${index + 1}</channel-number>\n`

    if (ch.image?.channel_square) {
      xml += `    <icon src="https://akamaividz2.zee5.com/image/upload/${escapeXml(
        ch.image.channel_square
      )}.png"/>\n`
    }

    xml += '  </channel>\n'
  })

  /* Programmes */
  for (const [channelId, programmes] of Object.entries(programmesByChannel)) {
    for (const p of programmes) {
      xml += `  <programme channel="${escapeXml(
        channelId
      )}" start="${xmlTime(p.start)}" stop="${xmlTime(p.stop)}">\n`

      xml += `    <title>${escapeXml(p.title)}</title>\n`

      if (p.desc) {
        xml += `    <desc>${escapeXml(p.desc)}</desc>\n`
      }

      for (const cat of p.categories || []) {
        xml += `    <category>${escapeXml(cat)}</category>\n`
      }

      xml += '  </programme>\n'
    }
  }

  xml += '</tv>\n'
  return xml
}
