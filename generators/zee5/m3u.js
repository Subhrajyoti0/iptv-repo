export function generateM3U(channels) {
  let m3u = '#EXTM3U url-tvg="https://subhrajyoti0.github.io/iptv-repo/zee5.xml"\n'

  channels.forEach((ch, index) => {
    const logo = ch.image?.channel_square 
      ? `https://akamaividz2.zee5.com/image/upload/${ch.image.channel_square}.png` 
      : ''
    const group = ch.languages?.[0]?.toUpperCase() || 'ZEE5'

    m3u += `#EXTINF:-1 tvg-id="${ch.id}" tvg-logo="${logo}" group-title="${group}",${ch.name}\n`
    m3u += `https://your-proxy-domain.com/play/${ch.id}.m3u8\n`
  })
  return m3u
}
