# Lane Legends — Bowling Stats Dashboard

Lane Legends tracks bowling league stats for Mattheus, Emily, and Shelley. A static dashboard on GitHub Pages reads `data/scores.csv`; a local **Score Admin** app handles entry, validation, and export.

## Quick start

### View the dashboard

Open `index.html` in a browser, or visit your GitHub Pages URL. The app loads `data/scores.csv` (falls back to `data/sample_data.csv` if empty).

### Enter scores (after league night)

1. Run **`Open Admin.bat`** (starts a local server and opens the admin UI)
2. Click **+ New Game**, upload the scoreboard photo, enter frames
3. **Save CSV** → write to `data/scores.csv`
4. Commit and push:

```bash
git add data/scores.csv
git commit -m "Add bowling session 2026-06-14"
git push
```

The dashboard updates automatically on GitHub Pages.

---

## Project structure

```text
bowling/
├── index.html                 Dashboard (GitHub Pages)
├── score-entry.html           Redirects to admin/
├── Open Admin.bat             Launch admin + local server
├── css/styles.css             Dashboard styles
├── js/
│   ├── bowling-core.js        ★ Canonical scoring, CSV, validation
│   ├── nickname-map.js        Alley alias → player names
│   ├── data.js                CSV loading & data model
│   ├── utils.js               Stats, charts, formatting
│   ├── app.js                 Router
│   └── pages/                 Overview, Player, Frames, H2H, Sessions, Aliases
├── admin/                     ★ Unified score admin (entry + validation)
│   ├── index.html
│   ├── admin.js
│   └── admin.css
├── data/
│   ├── scores.csv             ★ Canonical dataset
│   ├── sample_data.csv        Demo fallback
│   ├── sheet-template.csv     Header template for Google Sheet sync
│   ├── exports/               Archived CSV exports
│   └── backups/               Auto backups from save_scores.py
├── tests/                     ★ Golden scoring tests (JS + Python parity)
│   ├── golden_games.json
│   ├── test_js_scoring.js
│   ├── test_python_scoring.py
│   └── verify_implementation_parity.py
├── docs/
│   ├── scoring-spec.md        ★ Authoritative scoring rules
│   ├── maintainer-checklist.md
│   ├── historical-data-audit.md
├── tools/                     Python pipeline
│   ├── bowling_utils.py       ★ Canonical Python scoring/validation
│   ├── save_scores.py         Validate & write CSV
│   ├── sync_sheet_to_csv.py   Optional Google Sheet import
│   ├── normalize_data.py      Frame encoding normalization
│   ├── bowling_to_csv.py      JSON transcription → CSV
│   └── review_tool.py         Optional Streamlit bulk editor
├── scripts/
│   ├── nickname-map.js        Node re-export of nickname map
│   └── gen-sample.js          Regenerate sample_data.csv
├── game-images/               Alley photos + JSON transcriptions
└── .github/workflows/
    └── sync-scores.yml        Optional scheduled sheet sync
```

---

## Data flow

```text
┌─────────────┐     Save CSV      ┌─────────────────┐     git push     ┌──────────────┐
│  admin/     │ ────────────────► │ data/scores.csv │ ───────────────► │ GitHub Pages │
│  (entry)    │                   │  (canonical)    │                  │  dashboard   │
└─────────────┘                   └─────────────────┘                  └──────────────┘
       ▲                                    ▲
       │                                    │
  Photo reference              Optional: Google Sheet sync (GitHub Action)
  JSON pipeline (tools/)       Optional: Streamlit review (tools/review_tool.py)
```

---

## Score admin workflow

| Feature | Description |
|---------|-------------|
| **New game entry** | Date, lane, session #, time, multiple players |
| **Frame grid** | Alley notation (X, /, 0–9) with live score calculation |
| **Validation** | Missing fields, score mismatches, duplicates |
| **Search** | Find games by date, lane, player, nickname |
| **Photo panel** | Upload scoreboard image beside the grid |
| **Historical edit** | Select any game from the sidebar list |
| **Save** | File System Access API or download → `data/scores.csv` |

### Save with validation gate

```bash
python tools/save_scores.py --input path/to/scores.csv --output data/scores.csv
```

Creates a timestamped backup in `data/backups/` before overwriting. **Refuses to save** if schema, score calculations, or row validation fail.

Verify without writing:

```bash
python tools/save_scores.py -i data/scores.csv --verify-only
```

### Recover from a bad CSV save

1. Find a backup in `data/backups/` (`scores_backup_YYYYMMDD_HHMMSS.csv`)
2. Verify it: `python tools/save_scores.py -i data/backups/<file> --verify-only`
3. Restore: `python tools/save_scores.py -i data/backups/<file> -o data/scores.csv --no-backup`

See [docs/maintainer-checklist.md](docs/maintainer-checklist.md) for the full workflow.

### Manual server

```bash
python -m http.server 8080
# Open http://localhost:8080/admin/
```

---

## CSV schema

One row = one player's completed game. Shared game metadata: `game_id`, `date`, `lane`, `session_game`, `completed_time`.

| Column | Description |
|--------|-------------|
| `player` | Real name |
| `nickname` | Alley-screen alias (optional if player set) |
| `f1_b1` … `f10_b3` | Frame ball results |
| `final_score` | Total (validated against frame data) |

See `data/sheet-template.csv` for the full header row.

---

## Python pipeline (optional)

For bulk import from photo transcriptions:

```bash
pip install -r requirements.txt

python tools/bowling_to_csv.py game-images/ -o game-images/output.csv
python tools/normalize_data.py -i game-images/output.csv -o data/scores.csv
python tools/save_scores.py -i data/scores.csv
```

Streamlit bulk editor: `streamlit run tools/review_tool.py`

---

## Optional: Google Sheet sync

For mobile-friendly entry, sync a published sheet to the repo. See [docs/data-ingestion-architecture.md](docs/data-ingestion-architecture.md).

1. Import `data/scores.csv` into Google Sheets
2. Add GitHub secret `GOOGLE_SHEET_CSV_URL`
3. Run **Actions → Sync scores from Google Sheet**

---

## Deploy to GitHub Pages

1. Push to GitHub
2. **Settings → Pages →** Deploy from `main` branch, `/ (root)`
3. Site live at `https://<user>.github.io/<repo>/`

`.nojekyll` ensures static files serve correctly.

---

## Documentation

| Doc | Contents |
|-----|----------|
| [scoring-spec.md](docs/scoring-spec.md) | **Authoritative** scoring, validation, encoding rules |
| [maintainer-checklist.md](docs/maintainer-checklist.md) | Session workflow, release checks, recovery |
| [historical-data-audit.md](docs/historical-data-audit.md) | Latest dataset audit (regenerate via `tools/audit_historical.py`) |
| [repository-audit.md](docs/repository-audit.md) | File inventory |
| [architecture-review.md](docs/architecture-review.md) | Duplication analysis |
| [data-ingestion-architecture.md](docs/data-ingestion-architecture.md) | Ingestion design & migration |

### Scoring tests

```bash
node tests/test_js_scoring.js
python tests/test_python_scoring.py
python tests/verify_implementation_parity.py
```

CI runs these on every change to `js/`, `tools/`, or `tests/`.

---

## License

Use and modify freely for your league nights. 🎳
