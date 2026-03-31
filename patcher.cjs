const fs = require('fs');

// CONFIGURATION - Ensure these files are in the same folder as this script
const XML_PATH = './zee5.xml';
const M3U_PATH = './zee5.m3u';

// MASTER MAPPING: [Zee5 Name] -> [iptv-org Official ID]
const channelMap = {
  // --- Hindi Entertainment ---
  "Zee TV HD": "ZeeTV.in",
  "Zee TV": "ZeeTV.in",
  "&TV HD": "AndTV.in",
  "&TV": "AndTV.in",
  "Zing": "Zing.in",
  "Zing USA": "Zing.us",
  "Zee Anmol": "ZeeAnmol.in",
  "Big Magic": "BigMagic.in",

  // --- Movies ---
  "&flix HD": "Andflix.in",
  "&flix": "Andflix.in",
  "&pictures HD": "AndPictures.in",
  "&pictures": "AndPictures.in",
  "&prive HD": "AndPriveHD.in",
  "Zee Cinema HD": "ZeeCinema.in",
  "Zee Cinema": "ZeeCinema.in",
  "Zee Action": "ZeeAction.in",
  "Zee Anmol Cinema": "ZeeAnmolCinema.in",
  "Zee Bollywood": "ZeeBollywood.in",
  "Zee Classic": "ZeeClassic.in",

  // --- News & Infotainment ---
  "Zee News": "ZeeNews.in",
  "Zee Business": "ZeeBusiness.in",
  "Zee Hindustan": "ZeeHindustan.in",
  "Zee Salaam": "ZeeSalaam.in",
  "WION": "Wion.in",
  "Aaj Tak HD": "AajTak.in",
  "Aaj Tak": "AajTak.in",
  "India Today": "IndiaToday.in",
  "Zee Zest HD": "ZeeZest.in",
  "Zee Zest": "ZeeZest.in",

  // --- Regional: Bangla ---
  "Zee Bangla HD": "ZeeBangla.in",
  "Zee Bangla": "ZeeBangla.in",
  "Zee 24 Ghanta": "Zee24Ghanta.in",

  // --- Regional: Marathi ---
  "Zee Marathi HD": "ZeeMarathi.in",
  "Zee Marathi": "ZeeMarathi.in",
  "Zee Talkies HD": "ZeeTalkies.in",
  "Zee Talkies": "ZeeTalkies.in",
  "Zee Yuva": "ZeeYuva.in",
  "Zee 24 Taas": "Zee24Taas.in",

  // --- Regional: Telugu ---
  "Zee Telugu HD": "ZeeTelugu.in",
  "Zee Telugu": "ZeeTelugu.in",
  "Zee Cinemalu HD": "ZeeCinemalu.in",
  "Zee Cinemalu": "ZeeCinemalu.in",

  // --- Regional: Tamil ---
  "Zee Tamil HD": "ZeeTamil.in",
  "Zee Tamil": "ZeeTamil.in",
  "Zee Thirai HD": "ZeeThirai.in",
  "Zee Thirai": "ZeeThirai.in",

  // --- Regional: Kannada & Keralam ---
  "Zee Kannada HD": "ZeeKannada.in",
  "Zee Kannada": "ZeeKannada.in",
  "Zee Keralam HD": "ZeeKeralam.in",
  "Zee Keralam": "ZeeKeralam.in",

  // --- Regional: Others ---
  "Zee Punjabi": "ZeePunjabi.in",
  "Zee Ganga": "ZeeGanga.in",
  "Zee Madhya Pradesh Chhattisgarh": "ZeeMadhyaPradeshChhattisgarh.in",
  "Zee Rajasthan": "ZeeRajasthan.in",
  "Zee Bihar Jharkhand": "ZeeBiharJharkhand.in",
  "Zee Odisha": "ZeeOdisha.in",

  // --- Music & Others ---
  "9XM": "9XM.in",
  "9X Jalwa": "9XJalwa.in",
  "9X Jhakaas": "9XJhakaas.in",
  "9X Tashan": "9XTashan.in",
  "E24": "E24.in"
};

function runPatch() {
  console.log("🛠️  Starting All-in-One Patcher (iptv-org Sync)...");

  if (!fs.existsSync(XML_PATH) || !fs.existsSync(M3U_PATH)) {
    console.error("❌ Critical Error: Input files (zee5.xml/m3u) not found.");
    return;
  }

  let xml = fs.readFileSync(XML_PATH, 'utf8');
  let m3u = fs.readFileSync(M3U_PATH, 'utf8');
  let count = 0;

  // PATCH M3U
  const m3uLines = m3u.split('\n');
  const patchedM3U = m3uLines.map(line => {
    if (line.startsWith('#EXTINF')) {
      const parts = line.split(',');
      const name = parts[parts.length - 1].trim();
      const officialId = channelMap[name];
      if (officialId) {
        count++;
        return line.replace(/tvg-id="[^"]*"/, `tvg-id="${officialId}"`);
      }
    }
    return line;
  });

  // PATCH XML
  Object.entries(channelMap).forEach(([name, id]) => {
    const xmlName = name.replace(/&/g, '&amp;');
    // We target both the channel definition and the programme entries
    const idRegex = new RegExp(`id="${xmlName}"`, 'g');
    const progRegex = new RegExp(`channel="${xmlName}"`, 'g');
    
    xml = xml.replace(idRegex, `id="${id}"`).replace(progRegex, `channel="${id}"`);
  });

  fs.writeFileSync(M3U_PATH, patchedM3U.join('\n'));
  fs.writeFileSync(XML_PATH, xml);

  console.log(`✅ Verification Complete: ${count} channels mapped and synced.`);
}

runPatch();
