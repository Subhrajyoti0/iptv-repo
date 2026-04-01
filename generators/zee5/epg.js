/**
 * Fetch Zee5 EPG using GWAPI day-bucket parameters
 *
 * API pattern:
 *   /v1/epg
 *     ?channels=<CHANNEL_ID>
 *     &start=0
 *     &end=5
 *     &page_size=550
 *     &translation=en
 *     &country=IN
 *     &time_offset=+05:30
 *
 * IMPORTANT:
 * - Programmes are nested in data.items[0].items
 * - Uses built-in fetch (Node 18+ / Node 22 compatible)
 */

export async function fetchZee5EPG(channelId) {
  const params = new URLSearchParams({
    channels: channelId,
    start: '0',
    end: '5',
    page_size: '550',
    translation: 'en',
    country: 'IN',
    time_offset: '+05:30'
  })

  const url = `https://gwapi.zee5.com/v1/epg?${params.toString()}`

  const res = await fetch(url, {
    headers: {
      origin: 'https://www.zee5.com',
      referer: 'https://www.zee5.com',
      'user-agent': 'Mozilla/5.0',
      accept: 'application/json'
    }
  })

  if (!res.ok) {
    throw new Error(`Zee5 EPG failed (${res.status})`)
  }

  const data = await res.json()

  /**
   * Expected response shape:
   * {
   *   items: [
   *     {
   *       id: "0-9-zeetvapac",
   *       title: "...",
   *       items: [ programme, programme, programme ... ]
   *     }
   *   ]
   * }
   */
  if (
    !data ||
    !Array.isArray(data.items) ||
    data.items.length === 0
  ) {
    return []
  }

  const channelEntry = data.items[0]

  if (!channelEntry || !Array.isArray(channelEntry.items)) {
    return []
  }

  return channelEntry.items
}
