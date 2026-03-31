const TIMEZONE_OFFSET = ' +0530';

function esc(str = '') {
  return str.replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":"&apos;"}[c]));
}

function pad(n) { return String(n).padStart(2, '0'); }

function formatKodiTime(date) {
  // ISO strings are UTC. We need to extract the UTC components to match the +0530 suffix.
  return date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    TIMEZONE_OFFSET;
}

export function generateXMLTV(channels, programmesByChannel) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<tv generator-info-name="Zee5-Kodi">\n';

  channels.forEach(ch => {
    xml += `  <channel id="${ch.id}">\n    <display-name lang="en">${esc(ch.name)}</display-name>\n  </channel>\n`;
  });

  for (const [chId, progs] of Object.entries(programmesByChannel)) {
    progs.forEach(p => {
      const start = formatKodiTime(new Date(p.start));
      const stop = formatKodiTime(new Date(p.stop));
      xml += `  <programme start="${start}" stop="${stop}" channel="${chId}">\n`;
      xml += `    <title lang="en">${esc(p.title)}</title>\n`;
      if (p.desc) xml += `    <desc lang="en">${esc(p.desc)}</desc>\n`;
      xml += `  </programme>\n`;
    });
  }
  return xml + '</tv>';
}
