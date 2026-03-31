const TZ = '+0530'

function esc(s = '') {
  return String(s).replace(/[<>&"']/g, c => ({
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

function xmlTime(d) {
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds()) +
    ' ' +
    TZ
  )
}

export function generateXMLTV(channels, programmesByChannel) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<tv generator-info-name="zee5-epg">\n'

  channels.forEach((ch, i) => {
    xml += `<channel id="${ch.id}">\n`
    xml += `  <display-name>${esc(ch.name)}</display-name>\n`
    xml += `  <display-name>${i + 1}</display-name>\n`
    if (ch.image?.channel_square) {
      xml += `  https://akamaividz2.zee5.com/image/upload/${ch.image.channel_square}.png\n`
    }
    xml += '</channel>\n'
  })

  for (const [cid, progs] of Object.entries(programmesByChannel)) {
    progs.forEach(p => {
      xml += `<programme channel="${cid}" start="${xmlTime(p.schedule.start)}" stop="${xmlTime(p.schedule.stop)}">\n`
      xml += `  <title>${esc(p.titles.main)}</title>\n`

      if (p.titles.episode) {
        xml += `  <sub-title>${esc(p.titles.episode)}</sub-title>\n`
      }

      if (p.description.long) {
        xml += `  <desc>${esc(p.description.long)}</desc>\n`
      }

      p.categories.forEach(c => {
        xml += `  <category>${esc(c)}</category>\n`
      })

      if (p.media.poster) {
        xml += `  ${esc(p.media.poster)}\n`
      }

      xml += '</programme>\n'
    })
  }

  xml += '</tv>\n'
  return xml
}
``
