# Lane Legends — Bowling Stats Dashboard

Lane Legends is a static web dashboard for tracking bowling league stats. It reads game data from a CSV file and visualizes season overview, per-player deep dives, frame-by-frame analysis, head-to-head records, and session scorecards.

No build step or backend is required — open `index.html` in a browser or deploy to GitHub Pages.

## Quick start

1. Clone or download this repository.
2. Open `index.html` in a browser (or serve the folder with any static file server).
3. The app loads `data/scores.csv` first. If that file is missing or empty, it falls back to `data/sample_data.csv` so the dashboard works out of the box with demo data.

To use your own scores, replace or update `data/scores.csv` with your exported games.

## Adding bowling data

Each row in the CSV represents **one player's completed game**. Games that were bowled together share the same `game_id`, `date`, `lane`, `session_game`, and `completed_time`.

### CSV columns

| Column | Description |
|--------|-------------|
| `game_id` | Unique identifier for the game (shared by all players in the same game). |
| `date` | Session date in `YYYY-MM-DD` format. |
| `lane` | Lane number (integer). |
| `session_game` | Game number within the bowling session (1, 2, 3, …). |
| `completed_time` | Time the game was finished, e.g. `20:47` or `21:14`. |
| `player` | Player name (text). |
| `f1_b1` … `f9_b2` | Ball results for frames 1–9. Each frame has up to two balls. |
| `f10_b1`, `f10_b2`, `f10_b3` | Frame 10 balls (up to three if strike/spare bonuses apply). |
| `final_score` | Total game score (must match proper bowling scoring from the frame data). |

### Ball notation

| Value | Meaning |
|-------|---------|
| `X` | Strike (10 pins on first ball). |
| `/` | Spare (all remaining pins knocked down on second ball). |
| `0`–`9` | Pins knocked down on that ball. |
| *(empty)* | Not used (e.g. second ball after a strike in frames 1–9). |

### Example row

```csv
game_id,date,lane,session_game,completed_time,player,f1_b1,f1_b2,f2_b1,f2_b2,f3_b1,f3_b2,f4_b1,f4_b2,f5_b1,f5_b2,f6_b1,f6_b2,f7_b1,f7_b2,f8_b1,f8_b2,f9_b1,f9_b2,f10_b1,f10_b2,f10_b3,final_score
demo-1,2026-01-10,12,1,18:30,ALEX,4,0,0,7,0,0,0,0,0,0,5,0,3,5,X,,0,0,3,6,,43
```

### Score entry tool

Use `score-entry.html` (or `Open Score Entry.bat` on Windows) to enter games in a grid UI and export a CSV. Copy the export into `data/scores.csv`, or use **Load CSV** in the dashboard sidebar.

See `data/sample_data.csv` for a full multi-session example with three players.

## Deploy to GitHub Pages

1. Push this repository to GitHub.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose the **main** branch and **/ (root)** folder, then save.
5. After a minute or two, your site will be live at `https://<username>.github.io/<repo>/`.

The repo includes a `.nojekyll` file so GitHub Pages serves the static files directly without Jekyll processing.

## Project structure

```
├── index.html          Dashboard app
├── score-entry.html    Manual score entry & CSV export
├── css/styles.css      Styles (responsive + dark mode)
├── js/
│   ├── app.js          Router and app init
│   ├── data.js         CSV loading and data model
│   ├── utils.js        Scoring engine and helpers
│   └── pages/          Page modules (overview, player, frames, h2h, sessions)
└── data/
    ├── scores.csv      Your league data (primary)
    └── sample_data.csv Demo data (fallback)
```

## License

Use and modify freely for your league nights. 🎳
