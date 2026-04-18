import fs from 'fs'
import stringSimilarity from 'string-similarity'

/* ===================== CONFIG ===================== */

const XML_PATH = './output/zee5.xml'
const LOCAL_M3U_PATH = './in.m3u'

// Default to the real upstream India playlist from iptv-org
const M3U_URL =
  process.env.M3U_URL ||
  'https://raw.githubusercontent.com/iptv-org/iptv/refs/heads/master/streams/in.m3u'

const REVIEW_FILE = './patcher/review.json'
const PATCH_LOG_FILE = './patcher/patch_log.json'
const HISTORY_FILE = './patcher/channel_rename_history.json'

/* ===================== LOW-LEVEL HELPERS ===================== */

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function decodeAmpersands(str = '') {
  let out = String(str)
  while (out.includes('&amp;')) {
    out = out.replace(/&amp;/g, '&')
  }
  return out
}

function stripNoiseForCore(name = '') {
  let n = decodeAmpersands(name)

  n = n.replace(/&/g, 'and')
  n = n.toLowerCase()
  n = n.replace(/\(.*?\)/g, '')

  // remove only obvious quality/region noise from the core string
  n = n.replace(/\b(hd|sd|uhd|fhd|4k|usa|us|uk|apac|me|middleeast|intl|international|canada|ca|india|in)\b/g, '')
  n = n.replace(/[^a-z0-9]/g, '')

  return n.trim()
}

function normalizeRegion(region) {
  if (!region) return null
  const r = String(region).toLowerCase()

  if (['in', 'india'].includes(r)) return 'in'
  if (['us', 'usa'].includes(r)) return 'us'
  if (['uk', 'gb'].includes(r)) return 'uk'
  if (['apac'].includes(r)) return 'apac'
  if (['me', 'middleeast', 'ae'].includes(r)) return 'me'
  if (['ca', 'canada'].includes(r)) return 'ca'
  if (['de', 'germany', 'german'].includes(r)) return 'de'
  if (['fr', 'france', 'french'].includes(r)) return 'fr'
  if (['intl', 'international'].includes(r)) return 'intl'

  return r
}

function normalizeQuality(q) {
  if (!q) return null
  const s = String(q).toLowerCase()
  if (s.includes('4k')) return '4k'
  if (s.includes('uhd')) return 'uhd'
  if (s.includes('fhd')) return 'fhd'
  if (s.includes('hd')) return 'hd'
  if (s.includes('sd')) return 'sd'
  return s
}

function inferQualityFromName(name = '') {
  const n = decodeAmpersands(name).toLowerCase()
  if (/\b4k\b/.test(n)) return '4k'
  if (/\buhd\b/.test(n)) return 'uhd'
  if (/\bfhd\b/.test(n)) return 'fhd'
  if (/\bhd\b/.test(n)) return 'hd'
  if (/\bsd\b/.test(n)) return 'sd'
  return null
}

function inferRegionFromName(name = '') {
  const n = decodeAmpersands(name).toLowerCase()

  if (/\busa\b|\bus\b/.test(n)) return 'us'
  if (/\buk\b/.test(n)) return 'uk'
  if (/\bapac\b/.test(n)) return 'apac'
  if (/\bme\b|\bmiddle east\b/.test(n)) return 'me'
  if (/\bcanada\b|\bca\b/.test(n)) return 'ca'
  if (/\binternational\b|\bintl\b/.test(n)) return 'intl'
  if (/\bindia\b/.test(n)) return 'in'
  if (/\bgerman\b|\bde\b/.test(n)) return 'de'
  if (/\bfrench\b|\bfr\b/.test(n)) return 'fr'

  return null
}

function parseTvgId(id = '') {
  const m = String(id).match(/^(.+?)\.([a-zA-Z]+)@([a-zA-Z0-9]+)$/)
  if (!m) {
    return {
      raw: id,
      baseId: id,
      region: null,
      quality: null
    }
  }

  return {
    raw: id,
    baseId: m[1],
    region: normalizeRegion(m[2]),
    quality: normalizeQuality(m[3])
  }
}

/* ===================== STRONG METADATA INFERENCE ===================== */

function inferBrand(name = '', tvgIdBase = '') {
  const n = decodeAmpersands(name).toLowerCase()
  const b = String(tvgIdBase || '').toLowerCase()

  if (n.includes('zee') || b.includes('zee')) return 'zee'
  if (n.includes('tv9') || b.includes('tv9')) return 'tv9'
  if (n.includes('tv5') || b.includes('tv5')) return 'tv5'
  if (n.includes('etv') || b.includes('etv')) return 'etv'
  if (n.includes('inews') || b.includes('inews')) return 'inews'
  if (n.includes('india today') || b.includes('indiatoday')) return 'indiatoday'
  if (n.includes('aaj tak') || b.includes('aajtak')) return 'aajtak'
  if (n.includes('&tv') || n.includes('and tv') || b.includes('andtv')) return 'and'
  if (n.includes('&flix') || n.includes('and flix') || b.includes('andflix')) return 'and'
  if (n.includes('&pictures') || n.includes('and pictures') || b.includes('andpictures')) return 'and'
  if (n.includes('&prive') || n.includes('and prive') || b.includes('andprive')) return 'and'
  if (n.includes('&xplor') || n.includes('and xplor') || b.includes('andxplor')) return 'and'

  return null
}

function inferLanguage(name = '') {
  const n = decodeAmpersands(name).toLowerCase()

  if (/tamil|thirai/.test(n)) return 'ta'
  if (/telugu|cinemalu/.test(n)) return 'te'
  if (/marathi|talkies|yuva|24 taas/.test(n)) return 'mr'
  if (/bangla|ghanta|kalak/.test(n)) return 'bn'
  if (/kannada/.test(n)) return 'kn'
  if (/malayalam|keralam/.test(n)) return 'ml'
  if (/punjabi/.test(n)) return 'pa'
  if (/odia|orissa|odisha|sarthak/.test(n)) return 'or'
  if (/hindi|zee tv|&tv|andtv|zee cinema|zing|zest|cafe|classic|zee news|zee business|bollywood/.test(n)) return 'hi'

  return null
}

function inferGenre(name = '') {
  const n = decodeAmpersands(name).toLowerCase()

  if (/news|24 taas|24 ghanta|24 kalak|aaj tak|wion|business|bharatvarsh/.test(n)) return 'news'
  if (/cinema|movies|films|pictures|bollywood|classic|biskope|bioskop|thirai|cinemalu|talkies|chitramandir/.test(n)) return 'movies'
  if (/zing|music|9xm|jalwa/.test(n)) return 'music'
  if (/kids|junior|cartoon/.test(n)) return 'kids'
  if (/tv|yuva|saru|tumm se tumm tak|zest|cafe|one|alwan|aflam|bangla|telugu|tamil|marathi|kannada|keralam|punjabi/.test(n)) return 'general'

  return null
}

function inferFamily(name = '', tvgIdBase = '') {
  const n = decodeAmpersands(name).toLowerCase()
  const b = String(tvgIdBase || '').toLowerCase()
  const source = `${n} ${b}`

  if (/cinemalu/.test(source)) return 'cinemalu'
  if (/cinema/.test(source)) return 'cinema'
  if (/banglasonar/.test(source) || /bangla sonar/.test(source)) return 'banglasonar'
  if (/bangla/.test(source)) return 'bangla'
  if (/telugu/.test(source)) return 'telugu'
  if (/tamil/.test(source)) return 'tamil'
  if (/marathi/.test(source)) return 'marathi'
  if (/kannada/.test(source)) return 'kannada'
  if (/keralam/.test(source)) return 'keralam'
  if (/punjabi/.test(source)) return 'punjabi'
  if (/talkies/.test(source)) return 'talkies'
  if (/biskope/.test(source)) return 'biskope'
  if (/bioskop/.test(source)) return 'bioskop'
  if (/chitramandir/.test(source)) return 'chitramandir'
  if (/thirai/.test(source)) return 'thirai'
  if (/cafe/.test(source)) return 'cafe'
  if (/zest/.test(source)) return 'zest'
  if (/classic/.test(source)) return 'classic'
  if (/bollywood/.test(source)) return 'bollywood'
  if (/business/.test(source)) return 'business'
  if (/news9/.test(source) || /\bnews 9\b/.test(source)) return 'news9'
  if (/inews/.test(source)) return 'inews'
  if (/tv9/.test(source)) return 'tv9'
  if (/tv5/.test(source)) return 'tv5'
  if (/aajtak|aaj tak/.test(source)) return 'aajtak'
  if (/wion/.test(source)) return 'wion'
  if (/bharat/.test(source)) return 'bharat'
  if (/zing/.test(source)) return 'zing'
  if (/andtv|&tv|and tv|zee tv|zeetv/.test(source)) return 'tv'
  if (/andflix|&flix|and flix/.test(source)) return 'flix'
  if (/andpictures|&pictures|and pictures/.test(source)) return 'pictures'
  if (/andprive|&prive|and prive/.test(source)) return 'prive'
  if (/andxplor|&xplor|and xplor/.test(source)) return 'xplor'
  if (/zeeone|zee one/.test(source)) return 'one'
  if (/alwan/.test(source)) return 'alwan'
  if (/aflam/.test(source)) return 'aflam'
  if (/yuva/.test(source)) return 'yuva'

  // fallback core family
  let core = source
  core = core.replace(/\b(zee|tv9|tv5|etv|inews|india today|aaj tak|and)\b/g, '')
  core = core.replace(/\b(hd|sd|uhd|fhd|4k|usa|us|uk|apac|me|intl|international|canada|ca|india|in)\b/g, '')
  core = core.replace(/[^a-z0-9]/g, '')
  return core || null
}

function buildMeta({ name = '', tvgId = null }) {
  const parsed = parseTvgId(tvgId || '')
  return {
    rawName: name,
    brand: inferBrand(name, parsed.baseId),
    language: inferLanguage(name),
    genre: inferGenre(name),
    family: inferFamily(name, parsed.baseId),
    region: inferRegionFromName(name) || parsed.region,
    quality: inferQualityFromName(name) || parsed.quality,
    parsedId: parsed
  }
}

/* ===================== HARD RULES ===================== */

function hardReject(xmlMeta, m3uMeta) {
  if (xmlMeta.brand && m3uMeta.brand && xmlMeta.brand !== m3uMeta.brand) return true
  if (xmlMeta.language && m3uMeta.language && xmlMeta.language !== m3uMeta.language) return true
  if (xmlMeta.genre && m3uMeta.genre && xmlMeta.genre !== m3uMeta.genre) return true
  if (xmlMeta.family && m3uMeta.family && xmlMeta.family !== m3uMeta.family) return true
  if (xmlMeta.region && m3uMeta.region && xmlMeta.region !== m3uMeta.region) return true
  return false
}

/* ===================== SCORING ===================== */

function scoreCandidate(xmlDisplayName, xmlMeta, m3u) {
  const xmlCore = stripNoiseForCore(xmlDisplayName)
  const byName = stripNoiseForCore(m3u.name)
  const byBaseId = stripNoiseForCore(m3u.meta.parsedId.baseId)

  const scoreName = Math.max(
    stringSimilarity.compareTwoStrings(xmlCore, byName),
    stringSimilarity.compareTwoStrings(xmlCore, byBaseId)
  )

  const familyScore =
    xmlMeta.family && m3u.meta.family
      ? (xmlMeta.family === m3u.meta.family ? 1 : 0)
      : 0.7

  const regionScore =
    xmlMeta.region && m3u.meta.region
      ? (xmlMeta.region === m3u.meta.region ? 1 : 0)
      : (!xmlMeta.region && m3u.meta.region === 'in' ? 0.9 : 0.7)

  const qualityScore =
    xmlMeta.quality && m3u.meta.quality
      ? (xmlMeta.quality === m3u.meta.quality ? 1 : 0.4)
      : 0.7

  const languageScore =
    xmlMeta.language && m3u.meta.language
      ? (xmlMeta.language === m3u.meta.language ? 1 : 0)
      : 0.7

  const genreScore =
    xmlMeta.genre && m3u.meta.genre
      ? (xmlMeta.genre === m3u.meta.genre ? 1 : 0)
      : 0.7

  const finalScore =
    scoreName * 0.40 +
    familyScore * 0.28 +
    regionScore * 0.10 +
    qualityScore * 0.08 +
    languageScore * 0.08 +
    genreScore * 0.06

  return {
    finalScore,
    scoreName,
    familyScore,
    regionScore,
    qualityScore,
    languageScore,
    genreScore
  }
}

/* ===================== HISTORY ===================== */

function loadRenameHistory() {
  if (!fs.existsSync(HISTORY_FILE)) {
    return {
      generated_at: new Date().toISOString(),
      renames: []
    }
  }

  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'))
  } catch (err) {
    console.warn('⚠ channel_rename_history.json corrupted — recreating fresh history')
    return {
      generated_at: new Date().toISOString(),
      renames: []
    }
  }
}

function saveRenameHistory(history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2))
}

/* ===================== LOAD XML ===================== */

if (!fs.existsSync(XML_PATH)) {
  throw new Error('❌ Required XML missing: output/zee5.xml')
}

const xml = fs.readFileSync(XML_PATH, 'utf8')

/* ===================== FETCH / LOAD M3U ===================== */

async function loadM3UText() {
  console.log(`📡 Loading upstream M3U: ${M3U_URL}`)

  try {
    const res = await fetch(M3U_URL, {
      headers: {
        'user-agent': 'Mozilla/5.0',
        accept: 'text/plain, application/x-mpegurl, application/vnd.apple.mpegurl, */*'
      }
    })

    if (!res.ok) {
      throw new Error(`Remote M3U fetch failed (${res.status})`)
    }

    const text = await res.text()
    if (!text.includes('#EXTM3U') && !text.includes('#EXTINF')) {
      throw new Error('Remote M3U does not look like a valid playlist')
    }

    console.log('✅ Remote M3U loaded successfully')
    return text
  } catch (err) {
    console.warn(`⚠ Remote M3U failed: ${err.message}`)

    if (fs.existsSync(LOCAL_M3U_PATH)) {
      console.warn(`⚠ Falling back to local M3U: ${LOCAL_M3U_PATH}`)
      return fs.readFileSync(LOCAL_M3U_PATH, 'utf8')
    }

    throw new Error('❌ Could not load remote M3U and no local fallback exists')
  }
}

/* ===================== PARSE M3U ===================== */

function parseM3UChannels(m3uText) {
  const out = []

  m3uText.split('#EXTINF').forEach(chunk => {
    const tvgId = chunk.match(/tvg-id="([^"]+)"/)?.[1]
    const tvgName = chunk.match(/tvg-name="([^"]+)"/)?.[1]
    const label = chunk.match(/,(.+?)\r?\n/)?.[1]

    const name = (tvgName || label || '').trim()
    if (!tvgId || !name) return

    out.push({
      id: tvgId,
      name,
      meta: buildMeta({ name, tvgId })
    })
  })

  return out
}

/* ===================== MAIN PATCH LOGIC ===================== */

async function run() {
  const m3uText = await loadM3UText()
  const m3uChannels = parseM3UChannels(m3uText)

  if (m3uChannels.length === 0) {
    throw new Error('❌ No channels parsed from upstream M3U')
  }

  let patchedXML = xml
  const review = []
  const patchLog = []
  const history = loadRenameHistory()

  const channelRegex =
    /<channel id="([^"]+)">[\s\S]*?<display-name[^>]*>([^<]+)<\/display-name>/g

  console.log('📡 Running strict patcher against real upstream iptv-org IN playlist...')

  let match
  while ((match = channelRegex.exec(xml)) !== null) {
    const oldId = match[1]
    const displayName = match[2].trim()

    const xmlMeta = buildMeta({ name: displayName, tvgId: null })

    // PASS 1: exact canonical display-name
    const exactCandidates = m3uChannels.filter(c => {
      if (hardReject(xmlMeta, c.meta)) return false
      return stripNoiseForCore(displayName) === stripNoiseForCore(c.name)
    })

    let chosen = null
    let chosenScore = null
    let method = null

    if (exactCandidates.length === 1) {
      chosen = exactCandidates[0]
      chosenScore = scoreCandidate(displayName, xmlMeta, chosen)
      method = 'exact-display-name'
    } else {
      const candidates = m3uChannels.filter(c => !hardReject(xmlMeta, c.meta))

      if (candidates.length === 0) {
        review.push({
          timestamp: new Date().toISOString(),
          xml_display_name: displayName,
          old_channel_id: oldId,
          reason: 'Hard rules blocked all candidates',
          xmlMeta
        })
        continue
      }

      const scored = candidates.map(c => ({
        candidate: c,
        ...scoreCandidate(displayName, xmlMeta, c)
      }))

      scored.sort((a, b) => b.finalScore - a.finalScore)
      const best = scored[0]

      // very strict threshold
      if (best.finalScore < 0.93) {
        review.push({
          timestamp: new Date().toISOString(),
          xml_display_name: displayName,
          old_channel_id: oldId,
          reason: 'Score below strict threshold',
          xmlMeta,
          topCandidates: scored.slice(0, 5).map(s => ({
            id: s.candidate.id,
            name: s.candidate.name,
            meta: s.candidate.meta,
            finalScore: Number(s.finalScore.toFixed(4)),
            scoreName: Number(s.scoreName.toFixed(4)),
            familyScore: Number(s.familyScore.toFixed(4)),
            regionScore: Number(s.regionScore.toFixed(4)),
            qualityScore: Number(s.qualityScore.toFixed(4)),
            languageScore: Number(s.languageScore.toFixed(4)),
            genreScore: Number(s.genreScore.toFixed(4))
          }))
        })
        continue
      }

      chosen = best.candidate
      chosenScore = best
      method = 'strict-weighted'
    }

    if (!chosen || chosen.id === oldId) continue

    const escapedOldId = escapeRegex(oldId)

    patchedXML = patchedXML
      .replace(new RegExp(`id="${escapedOldId}"`, 'g'), `id="${chosen.id}"`)
      .replace(new RegExp(`channel="${escapedOldId}"`, 'g'), `channel="${chosen.id}"`)

    const entry = {
      timestamp: new Date().toISOString(),
      xml_display_name: displayName,
      old_channel_id: oldId,
      new_channel_id: chosen.id,
      confidence: Number(chosenScore.finalScore.toFixed(4)),
      method,
      evaluated: {
        xmlMeta,
        chosenMeta: chosen.meta,
        scoreBreakdown: {
          finalScore: Number(chosenScore.finalScore.toFixed(4)),
          scoreName: Number(chosenScore.scoreName.toFixed(4)),
          familyScore: Number(chosenScore.familyScore.toFixed(4)),
          regionScore: Number(chosenScore.regionScore.toFixed(4)),
          qualityScore: Number(chosenScore.qualityScore.toFixed(4)),
          languageScore: Number(chosenScore.languageScore.toFixed(4)),
          genreScore: Number(chosenScore.genreScore.toFixed(4))
        }
      }
    }

    patchLog.push(entry)
    history.renames.push(entry)

    console.log(
      `✅ ${displayName} → ${chosen.id} (${Math.round(chosenScore.finalScore * 100)}%) [${method}]`
    )
  }

  fs.writeFileSync(XML_PATH, patchedXML)
  fs.writeFileSync(PATCH_LOG_FILE, JSON.stringify(patchLog, null, 2))
  fs.writeFileSync(REVIEW_FILE, JSON.stringify(review, null, 2))
  saveRenameHistory(history)

  console.log('\n✅ Auto‑patched:', patchLog.length)
  console.log('⚠️ Review required:', review.length)
  console.log('📜 Rename history updated:', history.renames.length)
}

run().catch(err => {
  console.error('❌ FATAL:', err.message)
  process.exit(1)
})
