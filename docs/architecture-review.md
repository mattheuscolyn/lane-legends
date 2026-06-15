# Architecture Review

## Duplicate logic inventory

### Bowling scoring

| Location | Model | Status |
|----------|-------|--------|
| `js/bowling-core.js` → `calcBowlingScore`, `scoreGame` | Frame list + ball-slot grid | **Canonical (JS)** |
| `js/utils.js` | Delegates to `BowlingCore` | Kept — dashboard stats wrapper |
| `js/data.js` | Delegates to `BowlingCore.parseGame` | Kept — data layer |
| `admin/admin.js` | Uses `BowlingCore.scoreGame` | Kept — UI only |
| `tools/bowling_utils.py` → `compute_bowling_score` | Numeric frame dicts | **Canonical (Python)** |
| `tools/bowling_to_csv.py` | Imports from `bowling_utils` | Consolidated |
| ~~`score-entry.html`~~ | Inline scoring (~200 lines) | **Removed** |

**Decision:** Two canonical implementations remain (JS for browser, Python for CLI/CI) — unavoidable without a build step. They mirror the same rules and are tested against the same CSV.

---

### Frame calculations

| Location | Purpose | Status |
|----------|---------|--------|
| `BowlingCore.buildFrame` | CSV cells → frame objects | Canonical |
| `BowlingCore.frameSlot` / `rollsFromBalls` | Entry grid → rolls | Canonical |
| `bowling_utils.row_to_frames` | CSV → numeric frames | Canonical (Python) |
| `bowling_utils.frame_to_rolls` | Frame → roll list | Canonical (Python) |

---

### Validation

| Location | Purpose | Status |
|----------|---------|--------|
| `BowlingCore.validateRow` | Live admin + export checks | Canonical (JS) |
| `bowling_utils.validate_player_row` | Strict numeric validation | Canonical (Python) |
| `tools/save_scores.py` | Pre-commit gate | Uses Python validator |
| `tools/review_tool.py` | Streamlit UI | Uses Python validator (optional) |

Admin shows live validation; `save_scores.py` enforces before writing to repo.

---

### Normalization

| Location | Purpose | Status |
|----------|---------|--------|
| `bowling_utils.normalize_row_frames` | X/`/`/`10` → numeric | Canonical (Python only) |
| `BowlingCore.parseBallCell` | Accepts both notations at read time | Canonical (JS read path) |

Normalization at write time happens when using Python pipeline; admin stores entry notation (X, /) which dashboard parses correctly.

---

### Nickname mapping

| Location | Status |
|----------|--------|
| `js/nickname-map.js` | **Canonical** |
| `scripts/nickname-map.js` | Re-exports for Node |
| `tools/nickname_map.py` | Mirror for Python (document sync) |

---

### CSV parsing

| Location | Status |
|----------|--------|
| `BowlingCore.parseCSVText` / `rowsToCSV` | **Canonical (JS)** — uses PapaParse when available |
| `BowlingCore.parseCSVLine` | Fallback parser |
| `bowling_utils.CSV_HEADER` | **Canonical schema (Python)** |
| ~~`scripts/import-games-csv.js`~~ | Removed |
| ~~`score-entry.html` export~~ | Removed — admin uses `BowlingCore` |

---

## Dashboard architecture

```text
index.html
  ├── js/bowling-core.js    (scoring, CSV)
  ├── js/nickname-map.js
  ├── js/utils.js           (stats, charts — uses BowlingCore)
  ├── js/data.js            (load CSV, group sessions)
  ├── js/app.js             (router)
  └── js/pages/*.js         (views — read-only analytics)
```

No page module writes data. Read path: `fetch(data/scores.csv)` → `BowlingData.ingestRows`.

---

## Admin architecture

```text
admin/index.html
  ├── ../js/bowling-core.js
  ├── ../js/nickname-map.js
  └── admin/admin.js
        ├── Load ../data/scores.csv (via local server)
        ├── CRUD games (in-memory)
        ├── Live validation (BowlingCore.validateRow)
        ├── Photo reference panel (client-side only)
        └── Save → download or File System Access API
              └── optional: python tools/save_scores.py
```

---

## Python pipeline architecture

```text
game-images/*.json
  → tools/bowling_to_csv.py → game-images/output.csv
  → tools/normalize_data.py → data/scores.csv
  → tools/save_scores.py (validate gate)
  → tools/review_tool.py (optional bulk fix)

Optional: Google Sheet → tools/sync_sheet_to_csv.py → data/scores.csv (GitHub Action)
```

---

## Removed implementations

| Removed | Lines saved (approx.) | Replaced by |
|---------|----------------------|-------------|
| `score-entry.html` scoring/CSV | ~900 | `admin/` + `bowling-core.js` |
| Duplicate scoring in `data.js` | ~120 | `BowlingCore` |
| Duplicate scoring in `utils.js` | ~55 | `BowlingCore` |
| Duplicate scoring in `bowling_to_csv.py` | ~120 | `bowling_utils` |
| `import-games-csv.js` | ~70 | Admin load/save |

---

## Future consolidation (optional)

1. Generate `tools/nickname_map.py` from `js/nickname-map.js` via small script to prevent drift.
2. Shared JSON Schema for CSV row validation used by both runtimes.
3. Single Playwright test comparing JS vs Python score for golden fixtures.

Not required for current league size.
