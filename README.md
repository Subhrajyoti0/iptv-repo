# IPTV Repository

Auto-updated ZEE5 IPTV playlists with XMLTV EPG and catch-up support.

## Playlists
Generated files are stored in:

- `playlists/zee5_IN.m3u`
- `playlists/zee5_US.m3u`
- `playlists/zee5_GB.m3u`

## Indexes
Generated indexes:

- `playlists/index.m3u`
- `playlists/index.genre.m3u`
- `playlists/countries/*.m3u`
- `playlists/genres/*.m3u`

## EPG
Generated XMLTV:

- `epg/zee5_epg.xml.gz`

## Update Schedule
GitHub Actions updates every 6 hours.

## Legal
This repository does not host media content.
It only generates links to publicly reachable streams.




📺 Zee5 IPTV EPG & Playlist Generator
A fully automated, self‑learning Zee5 IPTV data generator that fetches all Zee5 TV channels, builds a clean XMLTV EPG, and generates an IPTV‑ready M3U playlist — with human‑like rate limits and GitHub Actions automation.
Inspired by the structure and philosophy of iptv‑org, but focused on Zee5.

✨ Features
✅ Fetches all Zee5 TV channels via catalog pagination (25 → 25 → 25…)
✅ Generates XMLTV EPG (zee5.xml) with correct programme timings
✅ Generates M3U playlist (zee5.m3u) compatible with IPTV players
✅ Auto‑discovers new channels from EPG and saves them permanently
✅ Human‑like fetching (delays, retries, backoff) — avoids API bans
✅ Handles 403 / blocked channels gracefully (no crashes)
✅ Logo embedding from Zee5 CDN
✅ Cron‑based GitHub Actions (updates every 6 hours)
✅ Works locally and in CI/CD

📂 Output Files





















FileDescriptionzee5.xmlXMLTV Electronic Program Guidezee5.m3uIPTV playlist (linked to XMLTV)seedChannels.jsonAuto‑expanded channel memory

📖 Project Structure
Plain Text.├── generators/│   └── zee5/│       ├── index.js            # Main generator│       ├── catalogChannels.js  # Channel pagination (human-like)│       ├── epg.js              # Resilient EPG fetcher│       ├── normalize.js        # Deduplication & cleanup│       ├── xmltv.js            # XMLTV writer│       ├── m3u.js              # M3U playlist generator│       └── seedChannels.json   # Auto-growing seed list├── utils/│   └── rateLimit.js├── zee5.xml├── zee5.m3u└── .github/workflows/zee5-epg.ymlShow more lines

🚀 Usage
✅ Run Locally

Node.js 18+ required

Shellnpm installnode generators/zee5/index.jsShow more lines
After running, you will get:
Plain Textzee5.xmlzee5.m3uShow more lines

✅ Use in IPTV Players

















SettingValuePlaylist URLzee5.m3uEPG URLzee5.xml
✅ Works with:

IPTV Smarters
Tivimate
VLC
OTT Navigator
TVHeadend
Jellyfin


🤖 Automation (GitHub Actions)
This repo includes fully automated updates every 6 hours.
What happens automatically:

Fetch all Zee5 channels
Fetch EPG for 2 days per channel
Discover new channels
Update zee5.xml + zee5.m3u
Commit and push changes

No manual intervention required.

🧠 Smart Channel Discovery
The generator learns automatically:

New channels discovered via EPG are saved in seedChannels.json
Future runs get faster and more complete
Works even if the catalog API gets blocked

This makes the system self‑healing and future‑proof.

⚠️ Disclaimer
This project:

Does NOT provide IPTV streams
Does NOT bypass DRM
Generates metadata only (EPG + playlist structure)

Stream URLs in the M3U file are placeholders and must be replaced with:

Your own IPTV proxy
A licensed provider
A private stream source

Use responsibly and in compliance with local laws.

🤝 Contributing
Contributions are welcome!
You can help by:

Adding channel grouping (language / genre)
Improving EPG normalization
Adding other providers (SonyLIV / Star / Jio)
Improving playlist formats


📌 Roadmap

✅ Language‑wise M3U & XML
✅ Category / genre grouping
✅ Public GitHub Pages hosting
✅ Multi‑provider architecture
✅ Error analytics & reporting


⭐ Inspiration
Inspired by:

https://github.com/iptv-org/iptv
Open IPTV & XMLTV ecosystems


🙌 Maintainer
Maintained by Subhrajyoti Satapathy
Built for reliability, automation, and long‑term operation.
