# Refactor Plan — Lane Legends

Prioritized cleanup and consolidation plan derived from the [repository audit](./repository-audit.md).

---

## Priority 1 — High impact cleanup

### 1.1 Consolidate nickname mapping (done)

**Problem:** Identical `NICKNAME_TO_PLAYER` map copied in four places.

**Action:**
- Create `js/nickname-map.js` as universal module (browser + Node via `module.exports`).
- Update `js/data.js` and `score-entry.html` to use it.
- Make `scripts/nickname-map.js` re-export from `js/nickname-map.js`.

**Impact:** One place to add new alley aliases; eliminates drift risk.

### 1.2 Consolidate Python scoring in `bowling_to_csv.py` (done)

**Problem:** `bowling_to_csv.py` duplicated `CSV_HEADER`, `frame_to_rolls`, and `compute_bowling_score` from `bowling_utils.py`.

**Action:** Import shared functions from `bowling_utils`; keep only JSON→CSV column mapping in `bowling_to_csv.py`.

**Impact:** Single scoring implementation for Python pipeline.

### 1.3 Organize Python tools under `tools/` (done)

**Problem:** Python scripts lived at repo root alongside dashboard files.

**Action:**
- Move `bowling_utils.py`, `normalize_data.py`, `bowling_to_csv.py`, `review_tool.py` → `tools/`.
- Update default paths: `review_tool.py` reads `data/scores.csv`; `normalize_data.py` defaults to `--output data/scores.csv`.
- Run tools as `python tools/normalize_data.py` from repo root.

**Impact:** Clear separation of dashboard vs pipeline.

### 1.4 Remove proven dead code (done)

**Problem:** Unused exports bloat the public JS API.

**Action:**
- Remove from `js/data.js`: `getRecords`, `getAllPlayerStats`, `getAvgFramePins`, `getHeadToHead` (pages implement their own queries).
- Remove from `js/utils.js`: `getMostMemorable` (never called).
- Stop exporting `framesToRolls` (internal only).

**Impact:** Smaller surface area; less confusion for future contributors.

### 1.5 Archive legacy CSVs and remove exact duplicate (done)

**Problem:** Root-level CSV clutter; `output_normalized.csv` identical to `data/scores.csv`.

**Action:**
- Move `bowling-games-2026-06-12.csv` → `data/exports/`.
- Move `bowling-games-from-photos.csv` → `data/exports/`.
- Move `output_normalized_backup_*` → `data/backups/`.
- Delete root `output_normalized.csv` (SHA256 match with `data/scores.csv`).
- Update script paths in `import-games-csv.js` and `gen-sample.js`.

**Impact:** Cleaner root; all data preserved in logical locations.

### 1.6 Trim unused Python dependencies (done)

**Problem:** `requirements.txt` lists `anthropic` and `Pillow` with no imports in the repo.

**Action:** Remove unused packages; keep `pandas` and `streamlit`.

---

## Priority 2 — Maintainability improvements

### 2.1 Documentation in `/docs` (done)

- `docs/repository-audit.md` — file inventory
- `docs/refactor-plan.md` — this document
- Update root `README.md` with actual structure and pipeline commands

### 2.2 Add `.gitignore` (done)

Ignore `__pycache__/`, `*.pyc`, and local Streamlit/review backups at repo root (backups in `data/backups/` are intentional).

### 2.3 Align review/normalize workflow with canonical data (done)

**Before:** `normalize_data.py` → `output_normalized.csv`; `review_tool.py` reads that file.

**After:** Both target `data/scores.csv` (with review tool creating timestamped backups in `data/backups/`).

**Workflow:**
```text
game-images/*.json  →  python tools/bowling_to_csv.py game-images/ -o game-images/output.csv
game-images/output.csv  →  python tools/normalize_data.py -i game-images/output.csv -o data/scores.csv
data/scores.csv  →  streamlit run tools/review_tool.py
```

Merge normalized rows into `data/scores.csv` manually or via import script as needed.

### 2.4 Score-entry scoring duplication (deferred)

**Problem:** `score-entry.html` embeds ~250 lines of scoring logic parallel to `js/utils.js`.

**Why deferred:** Score entry uses X/`/` ball-slot notation; dashboard uses numeric frame parsing. Merging requires an adapter layer or extracting `js/scoring-entry.js` — meaningful effort for a standalone page.

**Recommendation:** Future pass — extract `js/scoring-entry.js` and load from `score-entry.html`; optionally share `calcBowlingScore` via rolls adapter.

---

## Priority 3 — Nice-to-have cleanup

### 3.1 Extract shared CSV line parser for Node scripts

`import-games-csv.js` and `gen-sample.js` both define `parseCSVLine`. Could move to `scripts/csv-utils.js`.

### 3.2 `Bowling Games.xlsx`

Legacy spreadsheet; not referenced by code. Keep in repo for historical reference or move to `data/exports/` if desired.

### 3.3 Photo asset organization

`game-images/` contains paired `.jpeg` + `.json` files. Consider subfolder by session date once volume grows.

### 3.4 Dashboard `toLegacy` adapter

`BowlingData.getGames()` maps snake_case to camelCase for pages. Could standardize pages on snake_case and remove adapter — low priority, works today.

### 3.5 CSS audit

`css/styles.css` (~100 rule blocks) — all classes appear used by dashboard pages. No dead CSS identified; no action needed.

---

## Post-refactor structure

```text
bowling/
├── index.html
├── score-entry.html
├── Open Score Entry.bat
├── .nojekyll
├── .gitignore
├── README.md
├── requirements.txt
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   ├── data.js
│   ├── utils.js
│   ├── nickname-map.js
│   └── pages/
├── data/
│   ├── scores.csv          ← dashboard + pipeline target
│   ├── sample_data.csv
│   ├── exports/            ← archived CSV exports
│   └── backups/            ← review-tool snapshots
├── docs/
│   ├── repository-audit.md
│   └── refactor-plan.md
├── scripts/                ← Node import helpers
├── tools/                  ← Python pipeline
└── game-images/            ← photos + JSON transcriptions
```

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| GitHub Pages paths break | Dashboard files stay at repo root; `data/scores.csv` path unchanged |
| Python import errors after move | Run from repo root: `python tools/…`; `tools/` uses same-directory imports |
| Script path breaks after CSV move | Updated `import-games-csv.js` and `gen-sample.js` |
| Deleting `output_normalized.csv` loses data | Verified identical hash to `data/scores.csv` before deletion |
| Nickname map out of sync | Single `js/nickname-map.js` shared by browser and Node |

---

## Verification checklist

- [ ] Open `index.html` — loads `data/scores.csv`, all six routes render
- [ ] Open `score-entry.html` — nickname auto-fill works
- [ ] `node scripts/import-games-csv.js` — writes `data/scores.csv`
- [ ] `python tools/normalize_data.py --help` — runs
- [ ] `python tools/bowling_to_csv.py game-images/ --yes` — appends to output CSV
- [ ] `streamlit run tools/review_tool.py` — loads `data/scores.csv`
