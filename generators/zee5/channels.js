const CHANNELS_API =
  'https://gwapi.zee5.com/content/tvshow?assetSubtype=channel&limit=200'

export async function fetchZee5Channels() {
  const res = await fetch(CHANNELS_API, {
    headers: {
      accept: 'application/json',
      'user-agent': 'Mozilla/5.0',
    },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch Zee5 channels: ${res.status}`)
  }

  const data = await res.json()

  return (data?.items || []).map(ch => ({
    id: ch.id,
    name: ch.title || ch.original_title,
    image: ch.image || {},
    languages: ch.languages || [],
  }))
}
