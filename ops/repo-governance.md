# Repository Governance – Zee5 IPTV / XMLTV Production Line

## Purpose

This document defines the final production-line governance for this repository.

It exists to ensure:
- production files are protected
- runtime files are not committed
- GitHub Copilot proposes changes through pull requests instead of silently mutating the repository
- Microsoft 365 Copilot is used for knowledge, summary, and approval support
- cleanup decisions are review-first, not automation-first

This repository contains a Zee5 IPTV / XMLTV pipeline with generated outputs, patching logic, workflow automation, and audit artifacts.

---

## Governance Principles

### 1. EPG correctness is more important than convenience
If there is uncertainty, the system must prefer:
- review
- explicit explanation
- non-destructive PRs

Never prefer “more patches” over “correct patches.”

### 2. Copilot may recommend. Humans approve.
GitHub Copilot may:
- review pull requests
- analyze issues
- propose fixes
- open pull requests
- recommend files for deletion

GitHub Copilot must not:
- silently delete files
- auto-merge pull requests
- bypass review buckets
- rewrite production logic without review

### 3. Runtime state must not be tracked
Runtime-only files are not part of production output and must remain ignored.

### 4. Generated output is not disposable
Generated files are part of the production line and must not be deleted without review just because they are generated.

### 5. Only one workflow should be active
This repository must keep a single active production workflow. Any duplicate or legacy workflows must remain disabled or be moved to review-before-delete.

---

## Final Production Line

The final production flow is:

1. Fetch Zee5 catalog metadata
2. Fetch Zee5 EPG
3. Normalize programme data
4. Generate XMLTV
5. Patch channel IDs safely
6. Publish artifacts
7. Review questionable mappings in the review bucket

Production path:

`catalogSequential.js -> epg.js -> normalizeProgramme.js -> xmltv.js -> output/zee5.xml -> patcher/patcher.js -> patched output/zee5.xml -> GitHub Pages / clients`

---

## Production Files to Keep

The following files are considered production-line files and must be treated as keep-by-default.

### Generator pipeline
- `generators/zee5/index.js`
- `generators/zee5/epg.js`
- `generators/zee5/catalogSequential.js`
- `generators/zee5/normalizeProgramme.js`
- `generators/zee5/xmltv.js`

### Patcher and audit
- `patcher/patcher.js`
- `patcher/patch_log.json`
- `patcher/review.json`
- `patcher/channel_rename_history.json`

### Publishable outputs
- `output/zee5.xml`
- `output/zee5_raw_epg.json`
- `output/zee5_normalized_epg.json`

### Automation and repository configuration
- `.github/workflows/zee5-epg-auto-update.yml`
- `.gitignore`
- `.gitattributes`
- `package.json`
- `package-lock.json`
- `README.md`
- `LICENSE`
- `in.m3u`

---

## Runtime Files (Must Remain Ignored)

The following files are runtime-only and must not be committed:

- `output/zee5_progress.json`

If this file appears in a pull request, the correct action is:
1. remove it from the PR
2. keep it in `.gitignore`
3. do not track it

---

## Review-Before-Delete Candidates

The following classes of files must never be auto-deleted. They may only be proposed for deletion in a PR checklist.

### Workflow review candidates
- disabled workflows
- duplicate workflows
- superseded workflows

Examples:
- `.github/workflows/update.yml.disabled`
- `.github/workflows/zee5-epg.yml.disabled`

### Legacy / root-level artifacts
These often appear during migration from older layouts and may duplicate structured output under `output/`, `patcher/`, or newer workflow locations.

Examples:
- `patcher.js` (root-level legacy candidate if `patcher/patcher.js` is authoritative)
- `patcher.cjs`
- `zee5.xml` (root-level legacy candidate if `output/zee5.xml` is authoritative)
- `zee5.m3u`
- `progress.json`

### Corrupted / stale generated artifacts
If generated JSON or XML contains:
- merge conflict markers
- stale schema
- invalid XML
- broken references

…Copilot may recommend cleanup or regeneration, but only through a reviewable PR.

---

## Workflow Policy

### Active production workflow
Only this workflow should remain active:

- `.github/workflows/zee5-epg-auto-update.yml`

### Disabled / legacy workflows
Any other workflow file should be treated as:
- disabled
- historical
- review-before-delete

### Workflow behavior requirements
The active production workflow must:
- generate output
- run the patcher
- block empty XML from being published
- not add ignored runtime files
- push safely with concurrency and rebase protection
- avoid duplicate overlapping runs

---

## GitHub Copilot Policy

GitHub Copilot has two approved roles in this repository:

### A. Copilot Code Review
Use repository rulesets to automatically request Copilot review on pull requests targeting protected branches. This is supported as a repository rule and can optionally run on drafts and new pushes. [1](https://visualstudiomagazine.com/articles/2026/04/16/vs-code-updates-boost-ai-agents-terminal-control-and-copilot-workflow.aspx)[4](https://windowsreport.com/github-adds-rubber-duck-debugging-ai-to-copilot-cli-for-smarter-code-reviews/)

Copilot review should focus on:
- workflow mistakes
- unsafe file tracking
- broken XML / JSON generation
- duplicate or legacy files
- repo drift between README and actual structure
- patcher safety regressions

### B. Copilot Coding Agent
The coding agent is approved for:
- repo audits
- workflow failure investigations
- cleanup PR preparation
- production-vs-review classification
- patcher or generator fixes

It must be invoked through:
- GitHub Issues assigned to `@copilot`
- delegated tasks from supported IDE / GitHub surfaces

The coding agent works in a GitHub Actions environment and opens a PR for review rather than merging directly. [2](https://bing.com/search?q=GitHub+Copilot+coding+agent+repository+issue+assign+Copilot+latest+docs+2026)[5](https://docs.github.com/copilot/how-tos/agents/copilot-coding-agent/using-copilot-to-work-on-an-issue)[6](https://dev.to/rahulxsingh/github-copilot-code-review-complete-guide-2026-255h)

### Copilot must NOT
- delete files directly on `main`
- auto-merge cleanup PRs
- broaden patching thresholds silently
- remove review or history artifacts without approval

---

## Microsoft 365 Copilot Policy

Microsoft 365 Copilot should be used as the knowledge, summary, and approval layer for this repository.

### Approved use
- summarize audit reports
- explain production vs review recommendations
- help stakeholders review cleanup proposals
- answer questions about repository structure and policies

### Recommended connector
Use the **GitHub Cloud Knowledge connector** to index GitHub repository markdown and text content into Microsoft 365 Copilot and Microsoft Search experiences. [3](https://github.blog/ai-and-ml/github-copilot/how-to-use-github-copilot-to-level-up-your-code-reviews-and-pull-requests/)

### Not approved for direct repo mutation
Microsoft 365 Copilot should not be used as the direct mutation layer for code or file deletion in this repository. GitHub-native Copilot review and coding-agent workflows are the approved execution surface for repository changes. [3](https://github.blog/ai-and-ml/github-copilot/how-to-use-github-copilot-to-level-up-your-code-reviews-and-pull-requests/)[2](https://bing.com/search?q=GitHub+Copilot+coding+agent+repository+issue+assign+Copilot+latest+docs+2026)

---

## Cleanup PR Requirements

Any cleanup PR created by a human or by GitHub Copilot must include these sections:

1. **What was analyzed**
2. **Root cause / rationale**
3. **Files recommended to keep**
4. **Files recommended for review before deletion**
5. **Files that must remain ignored**
6. **Risks / unknowns**
7. **Whether workflows are active, disabled, or legacy**

No cleanup PR should silently remove production or audit files.

---

## Review Bucket Policy

The review bucket is a production safety mechanism.

The following must be preserved:
- `patcher/review.json`
- `patcher/channel_rename_history.json`
- `patcher/patch_log.json`

These files are part of the governance and audit story. They must not be removed without deliberate review.

---

## Merge / Branching Guidance

### Generated files
Generated output files may be committed by automation.

### Logic files
Human-authored logic changes should be made carefully and reviewed.

### Runtime files
Runtime-only state must remain ignored.

### Protected branch behavior
If using protected branches:
- require pull requests
- require checks
- optionally require Copilot code review
- do not allow bots or humans to bypass production policy casually

---

## Repo Audit Standard

A repo audit should always classify files into these buckets:

- `KEEP_PRODUCTION`
- `RUNTIME_IGNORE`
- `REVIEW_BEFORE_DELETE`
- `DUPLICATE_CANDIDATE`
- `OUTDATED_REFERENCE`

The goal is not aggressive deletion.
The goal is safe production-line clarity.

---

## Current Expected Repository Shape

Expected core shape:

- `generators/zee5/`
- `patcher/`
- `output/`
- `.github/workflows/`
- `ops/`
- root config files (`package.json`, `.gitignore`, `.gitattributes`, `README.md`)

Any major drift from this structure should be reviewed.

---

## Enforcement Summary

### Keep
Keep all approved production-line files.

### Ignore
Keep runtime-only files ignored and untracked.

### Review
All duplicates, disabled workflows, stale root-level artifacts, and questionable cleanup candidates go to review.

### Approve
Humans approve deletions and merges.

### Never
Never silently delete. Never auto-merge cleanup. Never bypass review for questionable changes.

---

## Final Rule

**Copilot advises. Humans decide. Production safety wins.**

_Copilot review clean test marker – do not keep_

_Second Copilot clean trigger_

_Copilot review clean test marker – do not keep_

_Copilot review clean test marker – do not keep_
