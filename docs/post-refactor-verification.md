# Post-Refactor Verification Report

Independent production-readiness review. Reviewer stance: **do not trust the implementation until proven.**

Review date: 2026-06-14

---

## 1. File removal — feature parity matrix

### score-entry.html (1,450 lines → redirect stub + `admin/`)

| Feature | Old location | New location | Status |
|---------|--------------|--------------|--------|
| New game form (date, lane, session, time) | score-entry | `admin/admin.js` → `newGame()` | ✅ Parity |
| Player nickname + real name | score-entry | admin editor player fields | ✅ Parity |
| Frame grid entry (X, /, 0–9) | score-entry | admin `renderFramesGrid` | ✅ Parity |
| Live score calculation | score-entry `scoreGame` | `BowlingCore.scoreGame` | ✅ Parity |
| Export CSV | score-entry | admin **Save CSV** | ✅ Parity (different UX) |
| Import CSV | score-entry | admin **Load CSV** | ✅ Parity |
| Copy for Sheet | score-entry (added then removed) | — | ⚠️ **Gap** — use Save CSV |
| Bulk paste (multi-game blocks) | score-entry `parseBulkGames` | `BowlingCore.parseBulkGames` + admin **Bulk paste** | ✅ Restored in review |
| Quick paste (compact notation) | score-entry `parseCompactLine` | `BowlingCore.parseCompactLine` + admin details panel | ✅ Restored in review |
| localStorage session persistence | score-entry | admin `DRAFT_KEY` draft autosave | ✅ Parity (different key) |
| Demo seed game | score-entry `seedGame1` | — | ⚠️ **Removed** (intentional — real data loaded from CSV) |
| Bulk header time parsing (12h) | score-entry | `BowlingCore.parseBulkHeaderLine` | ✅ Parity |
| **Photo reference panel** | — | admin photo upload | ✅ **New capability** |
| **Search / edit historical games** | — | admin game list + editor | ✅ **New capability** |
| **Live validation bar** | — | admin validation | ✅ **New capability** |
| **Duplicate detection** | — | `BowlingCore.findDuplicateKeys` | ✅ **New capability** |

**Initial review finding:** Bulk paste and quick paste were **missing** from first admin implementation — **regression**. Fixed during this verification pass by moving parsers into `BowlingCore` and wiring admin UI.

---

### Open Score Entry.bat

| Old | New | Status |
|-----|-----|--------|
| `start score-entry.html` (file://, no CSV fetch) | `Open Admin.bat` → `python -m http.server 8080` + `/admin/` | ✅ **Improved** — admin can `fetch(../data/scores.csv)` |

---

### scripts/import-games-csv.js

| Feature | Old script | Replacement | Status |
|---------|------------|-------------|--------|
| Read export CSV | `bowling-games-2026-06-12.csv` | admin **Load CSV** | ✅ |
| Resolve nickname → player | `nickname-map.js` | `BowlingCore.normalizePlayerRow` + `nickname-map.js` | ✅ |
| Write `data/scores.csv` | overwrite entire file | admin Save + `tools/save_scores.py` | ✅ Safer (validation gate) |
| One-shot CLI merge | `node scripts/import-games-csv.js` | `python tools/save_scores.py -i export.csv` | ✅ |

**Nothing lost** for intended use. One-shot automation replaced by admin load/save or Python CLI.

---

## 2. Historical data verification

Automated checks run:

```bash
python tools/verify_metrics.py
node tools/verify_dashboard.js
node tools/verify_parse_parity.js
node tools/verify_stress.js
```

### Counts (current `data/scores.csv`)

| Metric | Value |
|--------|-------|
| Total rows | **110** |
| Unique `game_id` | **48** |
| Session dates | **24** |
| Players | **3** (Mattheus, Emily, Shelley) |
| Python score mismatches (computed vs `final_score`) | **0** |

### Per-player metrics (unchanged through refactor)

| Player | Games | Avg | High | Low |
|--------|-------|-----|------|-----|
| Mattheus | 48 | 79.2 | 113 | 36 |
| Emily | 16 | 101.9 | 142 | 72 |
| Shelley | 46 | 62.2 | 100 | 21 |

### Head-to-head (sample)

Mattheus vs Emily shared games: **1–15** (Mattheus wins – Emily wins)

### Dashboard metric differences vs pre-refactor `data.js`

| Check | Result |
|-------|--------|
| Row count | Unchanged (110) |
| `final_score` values | Unchanged |
| JS `calculated_score` vs `final_score` | **110/110 match** (after frame-10 numeric spare fix) |
| Legacy `data.js` parser vs current | 4 rows differ on numeric `10` strikes — current matches `final_score` |

**Critical bug found in review:** Initial `BowlingCore.buildFrame` did not treat numeric spares in frame 10 (e.g. `2,8,8` → 2+8=10 spare + fill ball). **8 rows** showed computed ≠ final. **Fixed** before merge.

**Parse parity note (legacy):** `BowlingCore.parseBallCell` treats numeric `"10"` as a strike. Legacy `data.js` parsed `"10"` as integer 10 without strike semantics on some paths. On **4 rows**, legacy calculation was off by 1; **current matches `final_score`**.

**Git note:** Last committed `data/scores.csv` (HEAD) had ~42 data rows; working tree has 110. Metrics above apply to **current canonical file**, not git HEAD.

---

## 3. Admin E2E simulation

Simulated in `tools/verify_dashboard.js` (programmatic, not browser):

| Step | Result |
|------|--------|
| Create game `2099-12-31`, lane 99, session 9 | ✅ |
| Enter perfect game for Mattheus/SHREKK | ✅ Score **300** |
| `validateRow` | ✅ **green** |
| Merge into dataset | ✅ Row appears with `final_score=300` |
| `parseGame` on exported row | ✅ Dashboard-compatible |

**Browser E2E not automated** (no Playwright in repo). Manual checklist:

- [ ] `Open Admin.bat` → games list populates
- [ ] New game → save → reload dashboard
- [ ] New game visible on Overview, Sessions, Player, H2H, Frames

---

## 4. Stress test results

| Case | Expected | Actual | Status |
|------|----------|--------|--------|
| Perfect game (300) | 300 | 300 | ✅ PASS |
| Gutter game (0) | 0 | 0 | ✅ PASS |
| 10th frame XXX only (incomplete game) | null total | null | ✅ PASS (test name misleading) |
| Incomplete frame | null | null | ✅ PASS |
| Duplicate game_id + nickname | flagged | 1 dup | ✅ PASS |
| Missing date validation | yellow/red | flagged | ✅ PASS |
| Bulk compact paste → 300 | 300 | 300 | ✅ PASS |
| Bulk block parse | 1 game | 1 game | ✅ PASS |
| Invalid pin "99" | no valid score | handled | ✅ PASS |
| Duplicate player same game | — | detected by `findDuplicateKeys` | ✅ |
| Invalid pin in grid (entry) | reject input | admin rejects non `[0-9X/]` | ✅ |
| Missing metadata on save | warn | validation bar yellow/red | ✅ |

**Not enforced at entry time:** Python-style pin sum > 10 per frame in JS validator (only on save/export path via incomplete score).

---

## 5. Remaining duplication map

| Responsibility | Implementations | Canonical | Why others exist |
|----------------|-----------------|-----------|------------------|
| **JS scoring (frames)** | `BowlingCore.calcBowlingScore` | `js/bowling-core.js` | — |
| **JS scoring (entry grid)** | `BowlingCore.scoreGame` | `js/bowling-core.js` | Same file; two input models |
| **JS scoring wrapper** | `BowlingUtils.calcBowlingScore` | delegates to core | Dashboard API stability |
| **Python scoring** | `bowling_utils.compute_bowling_score` | `tools/bowling_utils.py` | CLI/CI; no JS in Python |
| **Nickname map JS** | `js/nickname-map.js` | same | Node re-export in `scripts/nickname-map.js` |
| **Nickname map Python** | `tools/nickname_map.py` | same | Mirror for sync/save (manual sync) |
| **CSV parse JS** | `BowlingCore.parseCSVText` | `js/bowling-core.js` | PapaParse when in browser |
| **CSV parse Node** | `scripts/gen-sample.js` `parseCSVLine` | should use core | **Debt** — 30 lines duplicate |
| **Validation strict** | Python `validate_player_row` | `bowling_utils.py` | Stricter numeric rules |
| **Validation loose** | JS `validateRow` | `bowling-core.js` | Admin live feedback |
| **Bulk paste** | `BowlingCore.parseBulkGames` | `bowling-core.js` | Consolidated in review |

**Target state:** 2 scoring engines (JS + Python) is acceptable without a build step. **Should consolidate:** `gen-sample.js` CSV parser → require bowling-core via vm or shared JSON.

---

## 6. UX review — friction points & fixes

### Workflow: bowl → photo → home → enter

| Friction | Severity | Action taken |
|----------|----------|--------------|
| Must run local server | High | Documented in `Open Admin.bat`; file:// cannot load CSV |
| Save doesn't auto-commit to git | Medium | By design; documented |
| Bulk paste missing | **Critical** | **Fixed** — Bulk paste modal |
| Quick paste missing | High | **Fixed** — editor details panel |
| No draft recovery | Medium | **Fixed** — localStorage draft |
| 48 games clutter sidebar | Low | **Fixed** — list capped at 80 + show all |
| Photo not persisted with game | Medium | **Known gap** — photo is session-only |
| No keyboard shortcuts documented | Low | Not fixed |
| Save overwrites without backup reminder | Medium | User should run `save_scores.py` |

### Still missing (acceptable defer)

- Copy-for-Sheet button (removed with old score-entry)
- Attach photo path to CSV row / game metadata
- JSON photo pipeline import inside admin UI

---

## 7. Future-proofing (5 years / 5,000 rows)

| Area | Risk at scale | Mitigation implemented |
|------|---------------|------------------------|
| Admin load all games in memory | Slow list render | List pagination (80 + show all) |
| Admin search | O(n) filter | Acceptable to ~500 games; needs virtual scroll beyond |
| Dashboard `fetch(scores.csv)` | ~500KB–2MB CSV | Acceptable; consider compression or split files later |
| Dashboard parse all rows on load | O(n) | Fine to ~2000 rows; Chart.js may lag |
| Duplicate detection | O(n) | Fine |
| Git merge conflicts on CSV | High human risk | Document branch discipline |

**Not implemented (defer):** virtual scrolling, Web Worker parse, indexedDB cache.

---

## 8. Final recommendation (senior review)

### What still bothers me

1. **Two scoring engines (JS + Python)** can drift — only partially tested for parity.
2. **Admin save path is awkward**: download CSV → manual replace → git push. No first-class "write to repo" without Electron or a git hook.
3. **JS validation is weaker than Python** — user can save yellow-state rows from admin; `save_scores.py` catches issues but is optional.
4. **`BowlingCore.buildFrame` frame-10 numeric spare bug** — shipped in refactor; **8 rows** had wrong dashboard scores until caught in this review. **Fixed.**
5. **`BowlingCore.parseBallCell` behavior change** (numeric 10 = strike) fixes 4 additional legacy mismatches — was undocumented.
5. **Photo reference is ephemeral** — exactly the workflow you described needs photo↔game linkage; currently lost on refresh.
6. **`score-entry.html` redirect** — fine, but git history still points newcomers to wrong tool if README stale (README updated).
7. **No automated browser tests** — admin regressions (like missing bulk paste) shipped once already.

### If starting over

- **Single data layer**: SQLite or JSON lines in git with schema validation in CI — CSV is human-friendly but merge-hostile.
- **One scoring library** compiled to both JS and Python (WASM or code-gen from tests fixtures).
- **Admin as local Tauri/Electron app** with direct filesystem write — still no server, better save UX.
- **Photo stored as `game-images/{game_id}.jpg`** with manifest — links transcription to entry.

### Remaining technical debt

| Item | Priority |
|------|----------|
| Consolidate `gen-sample.js` CSV parser | Low |
| Sync `nickname_map.py` from `nickname-map.js` via script | Low |
| Add Playwright smoke test for admin load/save | Medium |
| Persist photo reference per game_id (localStorage map) | Medium |
| Align JS `validateRow` with Python strictness | Medium |
| Document numeric-10 strike semantics in README | High |

### Before adding new features

1. **Add CI** running `verify_stress.js`, `verify_dashboard.js`, `verify_metrics.py`, `save_scores.py --dry-run`.
2. **Run manual admin browser test** once after any admin change.
3. **Require `save_scores.py`** before every commit to `data/scores.csv`.
4. **Fix or document** the 4-row parse semantics change for anyone comparing old dashboard screenshots.

---

## Verification commands (run before merge)

```bash
python tools/verify_metrics.py
python tools/save_scores.py -i data/scores.csv -o data/scores.csv.test --no-backup
node tools/verify_stress.js
node tools/verify_dashboard.js
node tools/verify_parse_parity.js   # expect 4 diffs vs legacy (improvement)
```

---

## Verdict

**Conditional approve** — ship after:

- [x] Bulk/quick paste restored
- [x] Draft autosave added
- [x] List pagination added
- [x] Frame-10 numeric spare scoring fixed (8 rows)
- [x] CI workflow added (`.github/workflows/verify-scores.yml`)
- [ ] One manual browser pass on `Open Admin.bat`

The refactor improves architecture. The initial admin release had **two real regressions** (missing bulk paste, broken frame-10 spare parsing) that this review caught and fixed.
