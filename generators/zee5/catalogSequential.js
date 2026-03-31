const CATALOG_URL = 'https://catalogapi.zee5.com/v1/channel'
const PAGE_SIZE = 25

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

export async function* fetchChannelsSequentially() {
  let page = 1
  let index = 0
  let total = Infinity

  while (index < total) {
    console.log('📡 Loading Zee5 channels (catalog)...')

    const url = new URL(CATALOG_URL)
    url.searchParams.set('page', page)
    url.searchParams.set('page_size', PAGE_SIZE)

    const res = await fetch(url.toString(), {
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0',
        origin: 'https://www.zee5.com',
        referer: 'https://www.zee5.com/',
      },
    })

    if (!res.ok) throw new Error(`Catalog failed ${res.status}`)

    const data = await res.json()
    const items = data.items || []
    total = data.total || total

    for (const ch of items) {
      index++
      yield {
        index,
        total,
        channel: {
          id: ch.id,
          name: ch.title || ch.original_title || ch.id,
          image: ch.image || {},
          languages: ch.languages || [],
        },
      }
      await sleep(800) // human pause
    }

    page++
    await sleep(1800)
  }
}
