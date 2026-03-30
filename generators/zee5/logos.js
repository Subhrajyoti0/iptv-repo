const BASE = 'https://akamaividz2.zee5.com/image/upload'

export function resolveChannelLogo(channel) {
  const img =
    channel.image?.channel_square ||
    channel.image?.channel_list ||
    channel.image?.square

  return img ? `${BASE}/${img}.png` : null
}
