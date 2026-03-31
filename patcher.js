import fs from 'fs';
import stringSimilarity from 'string-similarity';

const XML_PATH = './zee5.xml';
const M3U_PATH = './in.m3u';

/**
 * Super-cleaner tailored for Indian Broadcasters
 * Converts "&" to "and", keeps "tv9", "anmol", "zing"
 */
function clean(name) {
    if (!name) return "";
    let n = name.toLowerCase();
    
    n = n.replace(/&/g, 'and'); // Convert & to 'and' for consistency
    n = n.replace(/\(.*\)/g, ''); // Remove (576p), (1080p)
    
    // Remove quality tags but KEEP brand names
    const junk = /\b(hd|sd|intl|uk|usa|india|live|channel|pvt|ltd)\b/g;
    n = n.replace(junk, '');
    
    // Keep only alphanumeric (helps match "tv9" and "andtv")
    n = n.replace(/[^a-z0-9]/g, '');
    
    return n.trim();
}

function runDeepPatch() {
    if (!fs.existsSync(M3U_PATH) || !fs.existsSync(XML_PATH)) {
        console.error("❌ Required files (in.m3u or zee5.xml) are missing.");
        return;
    }

    const m3uData = fs.readFileSync(M3U_PATH, 'utf8');
    const m3uChannels = [];
    const chunks = m3uData.split('#EXTINF');
    
    chunks.forEach(chunk => {
        const idMatch = chunk.match(/tvg-id="([^"]+)"/);
        const nameMatch = chunk.match(/,(.+?)(?:\r?\n|$)/);
        if (idMatch && nameMatch) {
            m3uChannels.push({
                id: idMatch[1],
                name: nameMatch[1].trim(),
                cleanName: clean(nameMatch[1])
            });
        }
    });

    if (m3uChannels.length === 0) {
        console.error("❌ Failed to parse in.m3u. Check file content.");
        return;
    }

    let xml = fs.readFileSync(XML_PATH, 'utf8');
    const channelRegex = /<channel id="([^"]+)">\s*<display-name[^>]*>([^<]+)<\/display-name>/g;
    
    let match;
    const taskList = [];
    const m3uCleanNames = m3uChannels.map(c => c.cleanName);

    console.log(`📡 M3U Ready. Matching Zee5 channels...`);

    while ((match = channelRegex.exec(xml)) !== null) {
        const oldId = match[1];
        const displayName = match[2].trim();
        const cleanXmlName = clean(displayName);

        if (!cleanXmlName) continue;

        // Find the best match from the M3U list
        const matches = stringSimilarity.findBestMatch(cleanXmlName, m3uCleanNames);
        const confidence = matches.bestMatch.rating;

        // 0.4 threshold is usually safe for "Zee TV" vs "Zee TV HD"
        if (confidence > 0.4) {
            const officialId = m3uChannels[matches.bestMatchIndex].id;
            taskList.push({ oldId, officialId, displayName, confidence });
        }
    }

    // Sort by length (longest first) so "zeetvhd" replaces before "zeetv"
    taskList.sort((a, b) => b.oldId.length - a.oldId.length);

    let patchCount = 0;
    taskList.forEach(({ oldId, officialId, displayName, confidence }) => {
        if (oldId === officialId) return;

        // Escape any dots/dashes in the old Zee5 ID
        const escapedOldId = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Match id="ID" and channel="ID"
        const idRegex = new RegExp(`id="${escapedOldId}"`, 'g');
        const channelRegexTag = new RegExp(`channel="${escapedOldId}"`, 'g');

        const tempXml = xml.replace(idRegex, `id="${officialId}"`)
                           .replace(channelRegexTag, `channel="${officialId}"`);
        
        if (tempXml !== xml) {
            xml = tempXml;
            patchCount++;
            console.log(`✅ [${Math.round(confidence * 100)}%] "${displayName}" -> ${officialId}`);
        }
    });

    fs.writeFileSync(XML_PATH, xml);
    console.log(`\n🎉 Success! Patched ${patchCount} channels and all related programmes.`);
}

runDeepPatch();
