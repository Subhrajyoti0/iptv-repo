export function inferMetadata(name) {
  const n = name.toLowerCase()

  // ---- BRAND ----
  let brand = null
  if (n.includes('zee')) brand = 'zee'
  else if (n.includes('tv9')) brand = 'tv9'
  else if (n.includes('asianet')) brand = 'asianet'
  else if (n.includes('news')) brand = 'news-network'

  // ---- LANGUAGE ----
  let language = null
  if (/tamil|tam|ta\b/.test(n)) language = 'ta'
  else if (/telugu|tel|te\b/.test(n)) language = 'te'
  else if (/marathi|mr\b/.test(n)) language = 'mr'
  else if (/bangla|bengal|bn\b/.test(n)) language = 'bn'
  else if (/hindi|hin|\bhi\b/.test(n)) language = 'hi'
  else if (/kannada|kan|kn\b/.test(n)) language = 'kn'

  // ---- GENRE ----
  let genre = 'general'
  if (/news/.test(n)) genre = 'news'
  else if (/cinema|movies|films/.test(n)) genre = 'movies'
  else if (/music|zing|mtv|9xm/.test(n)) genre = 'music'
  else if (/kids|cartoon|junior/.test(n)) genre = 'kids'

  return { brand, language, genre }
}
