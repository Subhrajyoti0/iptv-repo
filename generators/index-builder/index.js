import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");

const PLAYLIST_DIR = path.join(REPO_ROOT, "playlists");
const GENRE_DIR = path.join(PLAYLIST_DIR, "genres");
const COUNTRY_DIR = path.join(PLAYLIST_DIR, "countries");

fs.mkdirSync(GENRE_DIR, { recursive: true });
fs.mkdirSync(COUNTRY_DIR, { recursive: true });

const files = fs
  .readdirSync(PLAYLIST_DIR)
  .filter(f => f.endsWith(".m3u") && !f.startsWith("index"));

console.log(`Found playlist files: ${files.join(", ") || "(none)"}`);

let entries = [];

for (const file of files) {
  const fullPath = path.join(PLAYLIST_DIR, file);
  const content = fs.readFileSync(fullPath, "utf8");
  const lines = content.split("\n");

  let currentExtinf = null;
  let fileEntries = 0;

  for (const line of lines) {
    if (line.startsWith("#EXTINF")) {
      currentExtinf = line;
    } else if (line.startsWith("http") && currentExtinf) {
      entries.push(`${currentExtinf}\n${line}`);
      currentExtinf = null;
      fileEntries++;
    }
  }

  console.log(`${file}: ${fileEntries} valid entries`);
}

console.log(`Total valid playlist entries: ${entries.length}`);

const genreBuckets = {};
const countryBuckets = {};

for (const item of entries) {
  const groupMatch = item.match(/group-title="([^"]+)"/);
  if (!groupMatch) continue;

  const group = groupMatch[1];
  const parts = group.split("|").map(x => x.trim());

  const genre = parts[0] || "General";
  const countryMatch = (parts[1] || "").match(/\((.*?)\)/);
  const country = countryMatch ? countryMatch[1].toLowerCase() : "unknown";

  if (!genreBuckets[genre]) genreBuckets[genre] = [];
  genreBuckets[genre].push(item);

  if (!countryBuckets[country]) countryBuckets[country] = [];
  countryBuckets[country].push(item);
}

console.log(`Genres found: ${Object.keys(genreBuckets).length}`);
console.log(`Countries found: ${Object.keys(countryBuckets).length}`);

for (const [genre, list] of Object.entries(genreBuckets)) {
  const safeName = genre.toLowerCase().replace(/\s+/g, "_");
  fs.writeFileSync(
    path.join(GENRE_DIR, `${safeName}.m3u`),
    "#EXTM3U\n" + list.join("\n")
  );
}

for (const [country, list] of Object.entries(countryBuckets)) {
  fs.writeFileSync(
    path.join(COUNTRY_DIR, `${country}.m3u`),
    "#EXTM3U\n" + list.join("\n")
  );
}

let indexM3U = "#EXTM3U\n";
for (const country of Object.keys(countryBuckets).sort()) {
  indexM3U += `#EXTINF:-1,${country.toUpperCase()}\n`;
  indexM3U += `countries/${country}.m3u\n`;
}
fs.writeFileSync(path.join(PLAYLIST_DIR, "index.m3u"), indexM3U);

let genreIndex = "#EXTM3U\n";
for (const genre of Object.keys(genreBuckets).sort()) {
  const safeName = genre.toLowerCase().replace(/\s+/g, "_");
  genreIndex += `#EXTINF:-1,${genre}\n`;
  genreIndex += `genres/${safeName}.m3u\n`;
}
fs.writeFileSync(path.join(PLAYLIST_DIR, "index.genre.m3u"), genreIndex);

console.log("✅ IPTV-org compatible indexes generated");
``
