import fs from 'fs'
import stringSimilarity from 'string-similarity'

const XML_PATH = './output/zee5.xml'
const M3U_PATH = './in.m3u'

/**
 * Clean names for fuzzy matching
 * Keeps numbers like tv9, anmol, zing
 */
function clean(name) {
  if (!name) return ''
  let n = name.toLowerCase()

  n = n.replace(/&/g, 'and')
  n = n.replace(/\(.*?\)/g, '')
  n = n.replace(/\b(hd|sd|intl|uk|usa|india|live|channel)\b/g, '')
  n = n.replace(/[^a-z0-9]/g, '')

  return n.trim()
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function runDeepPatch() {
  if (!fs.existsSync(XML_PATH) || !fs.existsSync(M3U_PATH)) {
    console.error('❌ Required files missing (zee5.xml or in.m3u)')
    return
  }

  const xml = fs.readFileSync(XML_PATH, 'utf8')
  const m3u = fs.readFileSync(M3U_PATH, 'utf8')

  // ---------- Parse M3U ----------
  const m3uChannels = []
  const chunks = m3u.split('#EXTINF')

  chunks.forEach(chunk => {
    const idMatch = chunk.match(/tvg-id="([^"]+)"/)
    const nameMatch = chunk.match(/,(.+?)\r?\n/)
    if (idMatch && nameMatch) {
      m3uChannels.push({
        id: idMatch[1],
        name: nameMatch[1].trim(),
        clean: clean(nameMatch[1])
      })
    }
  })

  if (m3uChannels.length === 0) {
    console.error('❌ No channels parsed from M3U')
    return
  }

  const m3uCleanNames = m3uChannels.map(c => c.clean)

  // ---------- Parse XML Channels ----------
  const channelRegex =
    /<channel id="([^"]+)">[\s\S]*?<display-name[^>]*>([^<]+)<\/display-name>/g

  let match
  let patchTasks = []

  console.log('📡 Matching Zee5 XML channels to M3U IDs...')

  while ((match = channelRegex.exec(xml)) !== null) {
    const oldId = match[1]
    const xmlName = match[2].trim()
    const cleanXml = clean(xmlName)

    if (!cleanXml) continue

    const result = stringSimilarity.findBestMatch(cleanXml, m3uCleanNames)
    const confidence = result.bestMatch.rating

    if (confidence >= 0.4) {
      const officialId = m3uChannels[result.bestMatchIndex].id
      if (officialId !== oldId) {
        patchTasks.push({ oldId, officialId, xmlName, confidence })
      }
    }
  }

  // Longest IDs first (important!)
  patchTasks.sort((a, b) => b.oldId.length - a.oldId.length)

  let patched = xml

  patchTasks.forEach(({ oldId, officialId, xmlName, confidence }) => {
    const escaped = escapeRegex(oldId)

    const idRegex = new RegExp(`id="${escaped}"`, 'g')
    const progRegex = new RegExp(`channel="${escaped}"`, 'g')

    const updated = patched
      .replace(idRegex, `id="${officialId}"`)
      .replace(progRegex, `channel="${officialId}"`)

    if (updated !== patched) {
      patched = updated
      console.log(
        `✅ ${xmlName} → ${officialId} (${Math.round(confidence * 100)}%)`
      )
    }
  })

  fs.writeFileSync(XML_PATH, patched)
  console.log(`\n🎉 Successfully patched ${patchTasks.length} channels`)
}

runDeepPatch()
