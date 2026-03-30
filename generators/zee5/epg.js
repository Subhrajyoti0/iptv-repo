const ZEE5_EPG_URL = 'https://gwapi.zee5.com/v1/epg'

export async function fetchZee5EPG(channelId, from, to) {
  const url = new URL(ZEE5_EPG_URL)
  url.searchParams.set('channels', channelId)
  url.searchParams.set('from', from.toISOString())
  url.searchParams.set('to', to.toISOString())

  const res = await fetch(url.toString(), {
    headers: {
      accept: 'application/json',
      'user-agent': 'Mozilla/5.0',
    },
  })

  if (!res.ok) {
    throw new Error(`EPG fetch failed: ${res.status}`)
  }

  const data = await res.json()
  return data?.items?.flatMap(c => c.items || []) ?? []
}
``
