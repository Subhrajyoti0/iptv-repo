import fs from "fs";

const input = process.argv[2] || "in.m3u";
const output = process.argv[3] || "output/in_parsed.json";

if (!fs.existsSync(input)) {
  throw new Error(`Missing input M3U: ${input}`);
}

const text = fs.readFileSync(input, "utf8");
const lines = text.split(/\r?\n/);

const result = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (!line.startsWith("#EXTINF")) continue;

  const url = lines[i + 1]?.trim();
  if (!url || url.startsWith("#")) continue;

  const tvgId = line.match(/tvg-id="([^"]*)"/)?.[1] || "";
  const tvgName = line.match(/tvg-name="([^"]*)"/)?.[1] || "";
  const group = line.match(/group-title="([^"]*)"/)?.[1] || "";
  const logo = line.match(/tvg-logo="([^"]*)"/)?.[1] || "";
  const label = line.split(",").slice(1).join(",").trim();

  result.push({
    tvg_id: tvgId,
    tvg_name: tvgName,
    name: tvgName || label || tvgId,
    label,
    group,
    logo,
    url
  });
}

fs.mkdirSync("output", { recursive: true });
fs.writeFileSync(output, JSON.stringify(result, null, 2));

console.log(`✅ Parsed ${result.length} IPTV entries`);
console.log(`✅ ${output}`);
