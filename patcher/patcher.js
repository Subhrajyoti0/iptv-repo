import fs from 'fs'
import stringSimilarity from 'string-similarity'
import { inferMetadata } from './channelMetadata.js'
import { hardReject } from './hardRules.js'
import { ALIASES } from './aliases.js'

/* ================== PATHS ================== */

const XML_PATH = './output/zee5.xml'
const M3U_PATH = './in.m3u'

const REVIEW_FILE = './patcher/review.json'
const PATCH_LOG_FILE = './patcher/patch_log.json'
const HISTORY_FILE = './patcher/channel_rename_history.json'

/* ================== HELPERS ================== */

/**
 * Normalize DISPLAY-NAME ONLY for matching
 * Never used for writing XML
 */
function normalizeDisplayNameForMatching(displayName) {
  if (!displayName) return ''

  let n = displayName

  // Decode XML entities repeatedly: &amp;amp; → &amp; → &
  while (n.includes('&amp;')) {
    n = n.replace(/&amp;/g, '&')
  }

  // Canonicalize & → and
  n = n.replace(/&/g, 'and')

  // Apply human aliases
  Object.entries(ALIASES).forEach(([from, to]) => {
    n = n.replace(from, to)
  })

  // Normalize text
  n = n.toLowerCase()
  n = n.replace(/\(.*?\)/g, '')
  n = n.replace(/\b(hd|sd|uhd|usa|uk|intl|apac)\b/g, '')
  n = n.replace(/[^a-z0-9]/g, '')

  return n.trim()
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/* ================== HISTORY ================== */

function loadRenameHistory() {
  if (!fs.existsSync(HISTORY_FILE)) {
    return {
      generated_at: new Date().toISOString(),
      renames: []
    }
  }
  return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'))
}

function saveRenameHistory(history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2))
}

/* ================== SAFETY ================== */

if (!fs.existsSync(XML_PATH) || !fs.existsSync(M3U_PATH)) {
  throw new Error('❌ Required files missing (zee5.xml or in.m3u)')
}

/* ================== LOAD FILES ================== */

const xml = fs.readFileSync(XML_PATH, 'utf8')
const m3u = fs.readFileSync(M3U_PATH, 'utf8')

/* ================== PARSE M3U ================== */

const m3uChannels = []

m3u.split('#EXTINF').forEach(chunk => {
  const id = chunk.match(/tvg-id="([^"]+)"/)?.[1]
  const name = chunk.match(/,(.+?)\r?\n/)?.[1]

  if (!id || !name) return

  m3uChannels.push({
    id,
    name,
    meta: inferMetadata(name),
    norm: normalizeDisplayNameForMatching(name)
  })
})

if (m3uChannels.length === 0) {
  throw new Error('❌ No channels parsed from M3U')
}

/* ================== PATCH INIT ================== */

let patchedXML = xml
const review = []
const patchLog = []

const history = loadRenameHistory()

/* Matches one display-name per channel block */
const channelRegex =
  /<channel id="([^"]+)">[\s\S]*?<display-name[^>]*>([^<]+)<\/display-name>/g

console.log('📡 Running Option‑A safe channel patcher with history support...')

/* ================== PATCH LOOP ================== */

let match
while ((match = channelRegex.exec(xml)) !== null) {
  const oldId = match[1]
  const displayName = match[2].trim()

  const xmlMeta = inferMetadata(displayName)
  const xmlNorm = normalizeDisplayNameForMatching(displayName)

  // ✅ HARD RULE FILTER
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

  // ✅ SOFT MATCH (AFTER HARD RULES)
  const scores = stringSimilarity.findBestMatch(
    xmlNorm,
    candidates.map(c => c.norm)
  )

  const best = scores.bestMatch
  const candidate = candidates[scores.bestMatchIndex]

  // ✅ CONFIDENCE GATE
  if (best.rating < 0.75) {
    review.push({
      timestamp: new Date().toISOString(),
      xml_display_name: displayName,
      old_channel_id: oldId,
      reason: 'Confidence below safe threshold',
      confidence: best.rating,
      xmlMeta,
      candidates: candidates.map(c => ({
        id: c.id,
        confidence: stringSimilarity.compareTwoStrings(
          xmlNorm,
          c.norm
        )
      }))
    })
    continue
  }

  // ✅ SAFE AUTO‑PATCH
  const escapedOldId = escapeRegex(oldId)

  patchedXML = patchedXML
    .replace(new RegExp(`id="${escapedOldId}"`, 'g'), `id="${candidate.id}"`)
    .replace(
      new RegExp(`channel="${escapedOldId}"`, 'g'),
      `channel="${candidate.id}"`
    )

  const renameEntry = {
    timestamp: new Date().toISOString(),
    xml_display_name: displayName,
    old_channel_id: oldId,
    new_channel_id: candidate.id,
    confidence: best.rating,
    method: 'auto',
    rules: {
      brand_match: xmlMeta.brand === candidate.meta.brand,
      language_match: xmlMeta.language === candidate.meta.language,
      genre_match: xmlMeta.genre === candidate.meta.genre,
      confidence_threshold: 0.75
    }
  }

  patchLog.push(renameEntry)
  history.renames.push(renameEntry)

  console.log(
    `✅ ${displayName} → ${candidate.id} (${Math.round(best.rating * 100)}%)`
  )
}

/* ================== WRITE FILES ================== */

fs.writeFileSync(XML_PATH, patchedXML)
fs.writeFileSync(PATCH_LOG_FILE, JSON.stringify(patchLog, null, 2))
fs.writeFileSync(REVIEW_FILE, JSON.stringify(review, null, 2))
saveRenameHistory(history)

console.log('\n✅ Auto‑patched:', patchLog.length)
console.log('⚠️ Review required:', review.length)
console.log('📜 Rename history updated:', history.renames.length)
