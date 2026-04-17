# Copilot repository instructions

This repository contains a Zee5 IPTV / XMLTV pipeline with:
- production generator logic in `generators/`
- patching / reconciliation logic in `patcher/`
- generated publishable outputs in `output/`
- GitHub automation in `.github/workflows/`

## Primary goal
Protect the production line and prefer correctness over convenience.

## Non-negotiable rules
1. Never delete files directly without proposing them in a PR checklist.
2. Never auto-merge.
3. Always explain root cause before proposing code or file changes.
4. Treat runtime files differently from production files.
5. If a file is stale, duplicated, disabled, or legacy, propose it under:
   - "Files recommended to keep"
   - "Files recommended for review before deletion"
6. Do not silently remove audit trails, review buckets, or generated outputs unless explicitly instructed.

## Production files to keep
These files are part of the final production line and should be treated as keep-by-default:

### Generator pipeline
- generators/zee5/index.js
- generators/zee5/epg.js
- generators/zee5/catalogSequential.js
- generators/zee5/normalizeProgramme.js
- generators/zee5/xmltv.js

### Patcher and audit
- patcher/patcher.js
- patcher/patch_log.json
- patcher/review.json
- patcher/channel_rename_history.json

### Published outputs
- output/zee5.xml
- output/zee5_raw_epg.json
- output/zee5_normalized_epg.json

### Automation and repo config
- .github/workflows/zee5-epg-auto-update.yml
- .gitignore
- .gitattributes
- package.json
- package-lock.json
- README.md
- LICENSE
- in.m3u

## Runtime-only files (must not be committed)
- output/zee5_progress.json

If this file appears in a PR, recommend removing it from tracking and keeping it ignored.

## Workflow policy
Only one production workflow should remain active:
- .github/workflows/zee5-epg-auto-update.yml

Any other workflow files should be treated as:
- disabled legacy workflows
- review-before-delete candidates
- never auto-delete without PR review

## Cleanup policy
If auditing the repository:
1. Scan the full tree
2. Identify the production-line files and their relationships
3. Identify:
   - duplicate files
   - root-level legacy files
   - disabled workflows
   - outdated references in README/docs
   - runtime files accidentally tracked
4. Produce a PR with:
   - Files recommended to keep
   - Files recommended for review before deletion
   - Files that must remain ignored
   - Root cause notes

## Patcher policy
When reviewing or changing patcher logic:
- prioritize exact matches over fuzzy matches
- require brand, language, family, region, and quality checks before patching
- keep a review bucket
- preserve rename history
- never broaden patching thresholds without explicit review

## EPG policy
- EPG correctness is more important than convenience
- never publish empty XML
- never publish HTML-escaped XML
- never bypass review for questionable channel mappings

## Output expectations for cleanup PRs
Every cleanup PR must contain:
1. Summary of what was analyzed
2. Root cause / rationale
3. Files recommended to keep
4. Files recommended for review before deletion
5. Files that are runtime-only and should remain ignored
6. Any risks or unknowns
