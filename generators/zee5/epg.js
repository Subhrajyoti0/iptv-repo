const ZEE5_EPG_URL = 'https://gwapi.zee5.com/v1/epg'

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

export async function fetchZee5EPG(channelId, from, to, attempt = 1) {
  try {
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
      throw new Error(`HTTP ${res.status}`)
    }

    const data = await res.json()
    return data?.items?.flatMap(ch => ch.items ?? []) ?? []

  } catch (err) {
    if (attempt < 3) {
      const delay = 2000 * attempt
      console.warn(
        `⚠ EPG retry ${attempt} for ${channelId} (waiting ${delay}ms)`
      )
      await sleep(delay)
      return fetchZee5EPG(channelId, from, to, attempt + 1)
    }

    console.warn(`⛔ Skipping ${channelId} (EPG blocked)`)
    return []     // ✅ DO NOT THROW
  }
}
