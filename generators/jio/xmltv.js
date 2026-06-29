function escapeXml(value = "") {
  return String(value).replace(/[<>&'"]/g, char => {
    return {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "'": "&apos;",
      '"': "&quot;"
    }[char];
  });
}

function formatXMLTVTime(value) {
  if (!value) return "";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(d);

  const get = type => parts.find(p => p.type === type)?.value || "00";

  return (
    `${get("year")}${get("month")}${get("day")}` +
    `${get("hour")}${get("minute")}${get("second")} +0530`
  );
}

export function buildXMLTV(channels, programmes) {
  let xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<tv generator-info-name="iptv-repo-jio">\n`;

  for (const ch of channels) {
    xml += `  <channel id="${escapeXml(ch.id)}">\n`;
    xml += `    <display-name>${escapeXml(ch.name)}</display-name>\n`;

    if (ch.logo) {
      xml += `    <icon src="${escapeXml(ch.logo)}" />\n`;
    }

    xml += `  </channel>\n`;
  }

  for (const p of programmes) {
    const start = formatXMLTVTime(p.start);
    const stop = formatXMLTVTime(p.stop);

    if (!start || !stop) continue;

    xml += `  <programme start="${start}" stop="${stop}" channel="${escapeXml(p.channel)}">\n`;
    xml += `    <title lang="en">${escapeXml(p.title)}</title>\n`;

    if (p.subtitle) {
      xml += `    <sub-title lang="en">${escapeXml(p.subtitle)}</sub-title>\n`;
    }

    if (p.desc) {
      xml += `    <desc lang="en">${escapeXml(p.desc)}</desc>\n`;
    }

    if (p.category) {
      xml += `    <category lang="en">${escapeXml(p.category)}</category>\n`;
    }

    if (Array.isArray(p.genre)) {
      for (const g of p.genre) {
        xml += `    <category lang="en">${escapeXml(g)}</category>\n`;
      }
    }

    if (p.image) {
      xml += `    <icon src="${escapeXml(p.image)}" />\n`;
    }

    if (p.director || p.actors) {
      xml += `    <credits>\n`;

      if (p.director) {
        for (const d of String(p.director).split(",").map(x => x.trim()).filter(Boolean)) {
          xml += `      <director>${escapeXml(d)}</director>\n`;
        }
      }

      if (p.actors) {
        for (const a of String(p.actors).split(",").map(x => x.trim()).filter(Boolean)) {
          xml += `      <actor>${escapeXml(a)}</actor>\n`;
        }
      }

      xml += `    </credits>\n`;
    }

    if (p.rating) {
      xml += `    <rating system="JioTV"><value>${escapeXml(p.rating)}</value></rating>\n`;
    }

    if (p.repeat) {
      xml += `    <previously-shown />\n`;
    }

    xml += `  </programme>\n`;
  }

  xml += `</tv>\n`;
  return xml;
}
