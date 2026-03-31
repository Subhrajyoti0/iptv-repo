/**
 * Generate M3U playlist for Zee5 channels
 * ✅ Kodi-compatible
 * ✅ Binds EPG automatically via url-tvg
 * ✅ tvg-id matches XMLTV channel id
 * ✅ Supports logos, groups, channel numbers
 */

export function generateM3U(channels) {
  // 🔴 CRITICAL: Kodi EPG binding
  let m3u =
    '#EXTM3U url-tvg="https://subhrajyoti0.github.io/iptv-repo/zee5.xml"\n'

  channels.forEach((ch, index) => {
    const logo = ch.image?.channel_square
      ? `https://akamaividz2.zee5.com/image/upload/${ch.image.channel_square}.png`
      : ''

    const group =
      ch.languages?.length > 0
        ? ch.languages[0].toUpperCase()
        : 'ZEE5'

    // ✅ tvg-chno matches <channel-number> in XML
    m3u += `#EXTINF:-1 tvg-id="${ch.id}" tvg-name="${ch.name}" tvg-logo="${logo}" tvg-chno="${index + 1}" group-title="${group}",${ch.name}\n`

    // ✅ Placeholder stream URL (expected)
    m3u += `http://example.com/stream/${ch.id}\n`
  })

  return m3u
}
