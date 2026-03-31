/**
 * Kodi‑optimized XMLTV generator
 * ✅ Correct timestamp format (NO 'T')
 * ✅ Regional timezone support (default: Asia/Kolkata)
 * ✅ Episode & subtitle support
 * ✅ channel-number (LCN)
 * ✅ Strict XML escaping
 */

/* ===== CONFIG ===== */

// Timezone offset (India = +0530)
// You can change this to:
//   +0000  (UTC)
//   +0100  (CET)
//   -0500  (EST)
const TIMEZONE_OFFSET = '+0530'

/* ================== */

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
 * Convert Date to Kodi‑supported XMLTV time
 * Format: YYYYMMDDHHMMSS ±ZZZZ
 */
function xmlTime(date) {
  const pad = n => String(n).padStart(2, '0')

  const year = date.getUTCFullYear()
  const month = pad(date.getUTCMonth() + 1)
  const day = pad(date.getUTCDate())
  const hour = pad(date.getUTCHours())
  const min = pad(date.getUTCMinutes())
  const sec = pad(date.getUTCSeconds())

  return `${year}${month}${day}${hour}${min}${sec} ${TIMEZONE_OFFSET}`
}

export function generateXMLTV(channels, programmesByChannel) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<tv generator-info-name="zee5-epg">\n'

  /* ===== CHANNEL DEFINITIONS ===== */
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

  /* ===== PROGRAMME LISTINGS ===== */
  for (const [channelId, programmes] of Object.entries(programmesByChannel)) {
    for (const p of programmes) {
      xml += `  <programme channel="${escapeXml(
        channelId
      )}" start="${xmlTime(p.start)}" stop="${xmlTime(p.stop)}">\n`

      /* Title */
      xml += `    <title>${escapeXml(p.title)}</title>\n`

      /* Subtitle / episode title */
      if (p.subTitle) {
        xml += `    <sub-title>${escapeXml(p.subTitle)}</sub-title>\n`
      }

      /* Description */
      if (p.desc) {
        xml += `    <desc>${escapeXml(p.desc)}</desc>\n`
      }

      /* Episode number (onscreen) */
      if (p.episode) {
        xml += `    <episode-num system="onscreen">${escapeXml(
          p.episode
        )}</episode-num>\n`
      }

      /* Episode number (xmltv_ns) — season/episode indexing */
      if (
        Number.isInteger(p.season) &&
        Number.isInteger(p.episodeNumber)
      ) {
        // xmltv_ns is zero‑based
        xml += `    <episode-num system="xmltv_ns">${
          p.season - 1
        }.${p.episodeNumber - 1}.</episode-num>\n`
      }

      /* Categories / genres */
      for (const cat of p.categories || []) {
        xml += `    <category>${escapeXml(cat)}</category>\n`
      }

      xml += '  </programme>\n'
    }
  }

  xml += '</tv>\n'
  return xml
}
