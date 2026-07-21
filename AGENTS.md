# AGENTS.md — AutomationHealthCheck

Shared conventions every AI agent working in this Apps Script repo must follow.

**This is a standalone Apps Script repo.** The full shared discipline lives in the main pipelines repo:
- [`dash-bigquery-pipelines/AGENTS.md`](https://github.com/ShawnaDashMedia/dash-bigquery-pipelines/blob/main/AGENTS.md) — canonical discipline items
- [`dash-automation/AGENTS.md`](https://github.com/ShawnaDashMedia/dash-automation/blob/main/AGENTS.md) — companion for the cloud pipelines side

The 14 discipline items in that file apply here TOO. This shorter file exists to cover Apps-Script-specific nuances that don't apply to the Python cloud services.

---

## What this repo is

[FILL IN PER REPO — one-paragraph description of what this Apps Script project does, which spreadsheet(s) it's bound to (if any), and which people / services depend on it. Example: "Bound Apps Script for VER (Videographer and Editor Resources). Runs the WAG plan and updates editor assignments per Randy's rules. Depends on: filming-summaries-sync (upstream), editor-guides-sync (upstream)."]

**Bound spreadsheet ID (if applicable):** [FILL IN]

**How to deploy locally:** `clasp push` (from repo root). Verify `.clasp.json` scriptId matches the intended Apps Script project before pushing.

---

## Apps-Script-specific rules (in addition to the 12 canonical items)

**A1. Verify `.clasp.json` scriptId before every `clasp push`.** Pushing to the wrong scriptId overwrites the wrong project silently. This is the Apps Script equivalent of "wrong repo" — same class of error as `feedback_verify_blast_radius_by_grep.md`. Before pushing, run `cat .clasp.json | grep scriptId` and confirm the Apps Script project it references is the one you meant to deploy to.

**A2. `clasp push` from a clean git state.** Never push code to Apps Script that isn't ALSO committed to git in the same flow. If you push to Apps Script without committing to git, the deployed code and the git history diverge, and you can't tell what's running from `git log`. Sequence: commit + git push + clasp push, all in the same session.

**A3. Bound scripts vs. standalone scripts.** Bound scripts (attached to a specific spreadsheet) behave differently than standalone scripts:
- Bound scripts: check what spreadsheet they're bound to before editing. Look for `SpreadsheetApp.getActive()` usage.
- Standalone scripts: verify what spreadsheets they READ via explicit IDs. Check for hardcoded IDs in `Code.js`.

**A4. `sheets copyTo does not preserve formulas across spreadsheets.** Documented gotcha from `feedback_sheets_copyto_does_not_preserve_formulas.md`. If you're moving or copying tabs cross-spreadsheet, formulas will return empty. Use `getValues()` + `setValues()` explicitly for formula-preserving work, or accept that formulas will need re-entry after copy.

**A5. Do NOT modify live scripts without diff approval.** Per `feedback_no_modify_live_scripts.md`, changes to production Apps Script get a diff review from Shawna before pushing.

---

## Reference to canonical discipline

The 13 items you also must follow (full text in the canonical file linked above):

1. Git sync discipline (commit + git push + clasp push, all in the same flow)
2. CHANGELOG discipline (invoke log-pipeline-change skill for meaningful changes)
3. Read actual code, not prose
4. Sample-validate before asserting
5. Verify blast radius by grep
6. Sample-validate 5+ RANDOM hits for counter-based findings (+ sampling-disagreement rule + intentionally-retained allowlist)
7. Sweep-in-progress + sweep-complete protocol during parallel work
8. Propose-confirm for exposed changes
9. Cross-repo scope awareness
10. Never bypass hooks or safety
11. Ask before inventing
12. Independence of verifier (high-stakes: author + verifier + adversarial reviewer; low-stakes: single verifier)
13. Cross-check formal proposals against your own prior positions
14. Sweep-completeness discipline: nothing is complete until every source is directly checked (Notion + repos + artifacts, not just top search hits)

---

## How to update this file

Apps-Script-specific rules (A1-A5 above) can be updated in this repo per the standard flow (propose in DB: Agent Messages, get concurrence, commit). The 14 canonical items must NOT be duplicated or forked here — always link to the canonical source in dash-bigquery-pipelines.

If a canonical rule needs revision, that change lands in `dash-bigquery-pipelines/AGENTS.md` first, then propagates.

---

Last updated: 2026-07-21 (per-repo sections left blank; fill at first substantive work per orchestrator's answer #3). Owners: all 4 agents + Shawna.
