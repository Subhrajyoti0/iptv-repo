import fs from "fs";
import path from "path";

const PLAYLIST_DIR = "playlists";
const GENRE_DIR = path.join(PLAYLIST_DIR, "genres");
const COUNTRY_DIR = path.join(PLAYLIST_DIR, "countries");

fs.mkdirSync(GENRE_DIR, { recursive: true });
fs.mkdirSync(COUNTRY_DIR, { recursive: true });

/* ---------------- LOAD ALL PLAYLISTS ---------------- */

const files = fs
  .readdirSync(PLAYLIST_DIR)
  .filter(f => f.endsWith(".m3u") && !f.startsWith("index"));

let entries = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(PLAYLIST_DIR, file), "utf8");
  const lines = content.split("\n");
  let buffer = [];

  for (let line of lines) {
    if (line.startsWith("#EXTINF")) buffer = [line];
    else if (line.startsWith("http")) {
      buffer.push(line);
      entries.push(buffer.join("\n"));
    }
  }
}

/* ---------------- GENRE & COUNTRY BUCKETS ---------------- */

const genreBuckets = {};
const countryBuckets = {};

/* ---------------- PARSE ---------------- */

entries.forEach(item => {
  const matchGenre = item.match(/group-title="([^"]+)"/);
  if (!matchGenre) return;

  const group = matchGenre[1];
  const parts = group.split("|").map(p => p.trim());

  const genre = parts[0];
  const countryMatch = parts[1]?.match(/\((.*?)\)/);
  const country = countryMatch ? countryMatch[1] : "Unknown";

  genreBuckets[genre] ||= [];
  genreBuckets[genre].push(item);

  countryBuckets[country] ||= [];
  countryBuckets[country].push(item);
});

/* ---------------- WRITE GENRE PLAYLISTS ---------------- */

Object.entries(genreBuckets).forEach(([genre, list]) => {
  fs.writeFileSync(
    path.join(GENRE_DIR, `${genre.toLowerCase()}.m3u`),
    "#EXTM3U\n" + list.join("\n\n")
  );
});

/* ---------------- WRITE COUNTRY PLAYLISTS ---------------- */

Object.entries(countryBuckets).forEach(([cty, list]) => {
  fs.writeFileSync(
    path.join(COUNTRY_DIR, `${cty.toLowerCase()}.m3u`),
    "#EXTM3U\n" + list.join("\n\n")
  );
});

/* ---------------- MASTER INDEX ---------------- */

let index = "#EXTM3U\n";

Object.keys(countryBuckets).forEach(c => {
  index += `#EXTINF:-1,${c}\n`;
  index += `countries/${c.toLowerCase()}.m3u\n`;
});

fs.writeFileSync(path.join(PLAYLIST_DIR, "index.m3u"), index);

/* ---------------- INDEX.BY.GENRE ---------------- */

let genreIndex = "#EXTM3U\n";

Object.keys(genreBuckets).forEach(g => {
  genreIndex += `#EXTINF:-1,${g}\n`;
  genreIndex += `genres/${g.toLowerCase()}.m3u\n`;
});

fs.writeFileSync(path.join(PLAYLIST_DIR, "index.genre.m3u"), genreIndex);

console.log("✅ IPTV-org compatible indexes generated");
