import fs from 'fs'
import stringSimilarity from 'string-similarity'
import { inferMetadata } from './channelMetadata.js'
import { hardReject } from './hardRules.js'
import { ALIASES } from './aliases.js'

const XML_PATH = './output/zee5.xml'
const M3U_PATH = './in.m3u'
const REVIEW_FILE = './patcher/review.json'
const LOG_FILE = './patcher/patch_log.json'

/**
 * ✅ Normalize DISPLAY-NAME ONLY for matching
 * - Decodes &amp;amp; → &amp; → &
 * - Converts '&' → 'and'
 * - NEVER used for writing XML
 */
function normalizeDisplayNameForMatching(displayName) {
  if (!displayName) return ''

  let n = displayName

  // 1️⃣ Decode XML entities repeatedly (&amp;amp;, &amp;amp;amp;, ...)
  while (n.includes('&amp;')) {
    n = n.replace(/&amp;/g, '&')
  }

  // 2️⃣ Canonicalize ampersand to 'and'
  n = n.replace(/&/g, 'and')

  // 3️⃣ Apply alias replacements (e.g. &tv → and tv)
  Object.entries(ALIASES).forEach(([from, to]) => {
    n = n.replace(from, to)
  })

  // 4️⃣ Normalize case
  n = n.toLowerCase()

  // 5️⃣ Remove noise (quality / region)
  n = n.replace(/\(.*?\)/g, '')
  n = n.replace(/\b(hd|sd|uhd|usa|uk|intl|apac)\b/g, '')

  // 6️⃣ Keep alphanumeric only
  n = n.replace(/[^a-z0-9]/g, '')

  return n.trim()
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/* ======================= SAFETY CHECKS ======================= */

if (!fs.existsSync(XML_PATH) || !fs.existsSync(M3U_PATH)) {
  throw new Error('❌ Required files missing (zee5.xml or in.m3u)')
}

const xml = fs.readFileSync(XML_PATH, 'utf8')
const m3u = fs.readFileSync(M3U_PATH, 'utf8')

/* ======================= PARSE M3U ======================= */

const m3uChannels = []

m3u.split('#EXTINF').forEach(chunk => {
  const id = chunk.match(/tvg-id="([^"]+)"/)?.[1]
  const name = chunk.match(/,(.+?)\r?\n/)?.[1]

  if (id && name) {
    m3uChannels.push({
      id,
      name,
      meta: inferMetadata(name),
      norm: normalizeDisplayNameForMatching(name),
    })
  }
})

if (m3uChannels.length === 0) {
  throw new Error('❌ Failed to parse any channels from M3U')
}

/* ======================= PATCH LOGIC ======================= */

const review = []
const patchedLog = []
let patchedXML = xml

const channelRegex =
  /<channel id="([^"]+)">[\s\S]*?<display-name[^>]*>([^<]+)<\/display-name>/g

let match

console.log('📡 Running Option‑A safe patcher (display-name aware)...')

while ((match = channelRegex.exec(xml)) !== null) {
  const oldId = match[1]
  const displayName = match[2].trim()

  const xmlMeta = inferMetadata(displayName)
  const xmlNorm = normalizeDisplayNameForMatching(displayName)

  // ✅ HARD RULE FILTER FIRST
  const candidates = m3uChannels.filter(c => !hardReject(xmlMeta, c.meta))

  if (candidates.length === 0) {
    review.push({
      xmlName: displayName,
      reason: 'Hard rules blocked all candidates',
      xmlMeta,
    })
    continue
  }

  // ✅ SOFT MATCH (ONLY AFTER HARD RULES PASS)
  const scores = stringSimilarity.findBestMatch(
    xmlNorm,
    candidates.map(c => c.norm)
  )

  const best = scores.bestMatch
  const candidate = candidates[scores.bestMatchIndex]

  // ✅ CONFIDENCE GATE
  if (best.rating < 0.75) {
    review.push({
      xmlName: displayName,
      xmlNorm,
      reason: 'Confidence below safe threshold',
      bestMatch: candidate.id,
      confidence: best.rating,
    })
    continue
  }

  // ✅ SAFE PATCH
  const escaped = escapeRegex(oldId)

  patchedXML = patchedXML
    .replace(new RegExp(`id="${escaped}"`, 'g'), `id="${candidate.id}"`)
    .replace(new RegExp(`channel="${escaped}"`, 'g'), `channel="${candidate.id}"`)

  patchedLog.push({
    xmlName: displayName,
    from: oldId,
    to: candidate.id,
    confidence: best.rating,
  })

  console.log(
    `✅ ${displayName} → ${candidate.id} (${Math.round(best.rating * 100)}%)`
  )
}

/* ======================= WRITE OUTPUT ======================= */

fs.writeFileSync(XML_PATH, patchedXML)
fs.writeFileSync(LOG_FILE, JSON.stringify(patchedLog, null, 2))
fs.writeFileSync(REVIEW_FILE, JSON.stringify(review, null, 2))

console.log('\n✅ Auto‑patched:', patchedLog.length)
console.log('⚠️ Review required:', review.length)
