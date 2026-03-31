export function generateM3U(channels) {
  // The cache-buster (?v=) is the secret to 110% success
  const v = Date.now();
  let m3u = `#EXTM3U url-tvg="https://subhrajyoti0.github.io/iptv-repo/zee5.xml?v=${v}"\n`;

  channels.forEach(ch => {
    const logo = ch.image?.channel_square ? `https://akamaividz2.zee5.com/image/upload/${ch.image.channel_square}.png` : '';
    m3u += `#EXTINF:-1 tvg-id="${ch.id}" tvg-logo="${logo}" group-title="ZEE5",${ch.name}\n`;
    m3u += `http://127.0.0.1/play/${ch.id}.m3u8\n`; // Ensure it ends in .m3u8
  });
  return m3u;
}
