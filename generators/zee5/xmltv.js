/**
 * Kodi‑optimized XMLTV generator
 *
 * ✅ Proper <icon> tags (Kodi requires this)
 * ✅ channel-number tags (LCN support)
 * ✅ Correct UTC time format (YYYYMMDDhhmmss +0000)
 * ✅ Strict XML escaping
 * ✅ Compatible with Kodi PVR IPTV Simple Client
 */

/* Escape XML special characters */
function escapeXml(str = '') {
  return str.replace(/[<>&'"]/g, ch => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
  }[ch]))
}

/* Kodi requires this exact time format */
function xmlTime(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('.000Z', ' +0000')
}

/**
 * Generate XMLTV
 *
 * @param {Array} channels - channel metadata
 * @param {Object} programmesByChannel - EPG data mapped by channel id
 */
export function generateXMLTV(channels, programmesByChannel) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
  xml += `<tv generator-info-name="zee5-epg">\n`

  /* ✅ CHANNEL DEFINITIONS */
  channels.forEach((ch, index) => {
    const channelNumber = index + 1  // ✅ LCN / channel-number

    xml += `  <channel id="${escapeXml(ch.id)}">\n`
    xml += `    <display-name>${escapeXml(ch.name)}</display-name>\n`
    xml += `    <channel-number>${channelNumber}</channel-number>\n`

    if (ch.image?.channel_square) {
      xml += `    <icon src="https://akamaividz2.zee5.com/image/upload/${escapeXml(ch.image.channel_square)}.png"/>\n`
    }

    xml += `  </channel>\n`
  })

  /* ✅ PROGRAMME LISTINGS */
  for (const [channelId, programmes] of Object.entries(programmesByChannel)) {
    for (const p of programmes) {
      xml += `  <programme channel="${escapeXml(channelId)}" start="${xmlTime(p.start)}" stop="${xmlTime(p.stop)}">\n`
      xml += `    <title>${escapeXml(p.title)}</title>\n`

      if (p.desc) {
        xml += `    <desc>${escapeXml(p.desc)}</desc>\n`
      }

      /* Kodi accepts multiple category tags */
      for (const cat of p.categories || []) {
        xml += `    <category>${escapeXml(cat)}</category>\n`
      }

      xml += `  </programme>\n`
    }
  }

  xml += `</tv>\n`
  return xml
}
