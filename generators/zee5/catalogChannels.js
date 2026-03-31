/**
 * Zee5 Catalog channel fetcher (CORRECT pagination)
 * Uses page + page_size
 * Fetches 25 channels per page
 * Human-like delay between pages
 */

const BASE_URL = 'https://catalogapi.zee5.com/v1/channel'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function fetchChannelsFromCatalog() {
  const channels = []
  let page = 1
  const pageSize = 25
  let total = Infinity

  while ((page - 1) * pageSize < total) {
    const url = new URL(BASE_URL)
    url.searchParams.set('page', page)
    url.searchParams.set('page_size', pageSize)

    console.log(`📡 Catalog fetch → page ${page}`)

    const res = await fetch(url.toString(), {
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0',
        origin: 'https://www.zee5.com',
        referer: 'https://www.zee5.com/',
      },
    })

    if (!res.ok) {
      throw new Error(`Catalog API blocked (${res.status})`)
    }

    const data = await res.json()

    if (!Array.isArray(data.items) || data.items.length === 0) {
      console.log('✅ No more catalog pages')
      break
    }

    total = data.total ?? total

    for (const ch of data.items) {
      channels.push({
        id: ch.id,
        name: ch.title || ch.original_title || ch.id,
        image: ch.image || {},
        languages: ch.languages || [],
      })
    }

    page++

    // ✅ Human-like delay: 1.5–2.5 sec
    const delay = 1500 + Math.floor(Math.random() * 1000)
    console.log(`⏳ Waiting ${delay} ms before next page`)
    await sleep(delay)
  }

  console.log(`✅ Total catalog channels fetched: ${channels.length}`)
  return channels
}
