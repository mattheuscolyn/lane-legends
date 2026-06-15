# Bowling Scoring Specification

**Authoritative reference.** All scoring, validation, and parsing code must conform to this document. When code and spec disagree, fix the code (or amend this spec deliberately with golden test updates).

Canonical implementations:

| Runtime | Module | Primary entry points |
|---------|--------|---------------------|
| JavaScript (browser + Node) | `js/bowling-core.js` | `parseGame`, `scoreGame`, `validateRow` |
| Python (CLI + CI) | `tools/bowling_utils.py` | `row_to_frames`, `compute_bowling_score`, `validate_player_row` |

Golden tests: `tests/golden_games.json` — both implementations must match expected values and each other (see `tests/verify_implementation_parity.py`).

---

## Data model

### CSV schema

One row = one player's game. Required metadata: `game_id`, `date`, `lane`, `session_game`, `nickname` (or `player`), frame columns `f1_b1` … `f10_b3`, optional `final_score`.

**On disk (canonical CSV):** frame cells are **numeric integers 0–10** or empty. Strikes in frames 1–9 use `10` in `b1` with empty `b2`.

**At entry time (admin UI):** alley notation (`X`, `/`, `-`) is accepted and converted at read/score time in JS; Python accepts notation only after `normalize_row_frames`.

### Two JS scoring paths (same rules)

1. **CSV row path:** `parseGame(row)` → `buildFrame` × 10 → `calcBowlingScore`
2. **Ball-grid path:** `scoreGame(balls[21])` → `rollsFromBalls` → same scoring loop

Both must produce identical totals for equivalent input.

---

## Ball notation and encoding

| Input | Meaning | Normalized (CSV) |
|-------|---------|------------------|
| `X` or `10` (ball 1) | Strike | `10` in b1; b2 empty (frames 1–9) |
| `X` (frame 10, b2/b3) | Strike | `10` |
| `/` (ball 2) | Spare | `10 - b1` in b2 |
| `-` | Gutter | `0` |
| `0`–`9` | Pin count | unchanged |
| empty | Not bowled | empty |

### Numeric spare representation

When `b1 + b2 === 10` and `b1 < 10`, the frame is a **spare** even without `/`. This applies to **all frames including frame 10**.

**Frame 10 spare with fill:** if `b1 + b2 === 10`, ball 3 is the fill ball and **must** be included in scoring.

Example (historical bug case): `f10_b1=2, f10_b2=8, f10_b3=8` → rolls `[2,8,8]`, frame 10 contributes 18, not 10.

### Legacy numeric strike

`fN_b1=10` with empty `fN_b2` in frames 1–9 is a strike. JS `parseBallCell` treats `10` like `X`.

---

## Strike handling (frames 1–9)

- A strike records one roll of `10`.
- Frame score = `10 + next_roll + roll_after_next`.
- Advance roll index by **1** (not 2).
- Running total is cumulative sum of frame scores.

### Strike bonus examples

| Rolls (start) | Frame score |
|---------------|-------------|
| X, 7, 2 | 10 + 7 + 2 = 19 |
| X, X, 5 | 10 + 10 + 5 = 25 |
| X, X, X | 30 |

---

## Spare handling (frames 1–9)

- A spare records two rolls summing to 10 (via `/` or numeric `b1+b2=10`).
- Frame score = `10 + next_roll`.
- Advance roll index by **2**.

---

## Open frames (frames 1–9)

- Two rolls summing to less than 10.
- Frame score = sum of both rolls.
- Advance roll index by **2**.

---

## Frame 10 handling

Frame 10 has up to three balls. Scoring rules:

1. **Open frame:** two rolls, no b3. Frame score = b1 + b2.
2. **Spare:** b1 + b2 = 10 (via `/` or numeric). b3 required. Frame score = b1 + b2 + b3.
3. **Strike on b1:** b2 required. If b2 is strike, b3 required. Frame score = sum of all balls bowled in frame 10.

The scoring loop treats frame 10 specially: frame score = **sum of all remaining rolls** (no lookahead bonus).

### Frame 10 examples

| b1 | b2 | b3 | Rolls | Frame 10 score |
|----|----|----|-------|----------------|
| X | X | X | 10,10,10 | 30 |
| 7 | / | 3 | 7,3,3 | 13 |
| 2 | 8 | 8 | 2,8,8 | 18 |
| 0 | 0 | — | 0,0 | 0 |

---

## Incomplete games

A game is **incomplete** when any of the following hold:

- Fewer than 10 frames have sufficient balls to score.
- Frame 10 started but not finished per rules above.
- JS `scoreGame`: any frame fails `isFrameComplete`.

**Incomplete score:** `final_score` and `calculated_score` are `null`. Running totals may be partial (non-null for completed frames only); remaining frames are `null`.

---

## Validation rules

### Python (`validate_player_row`) — strict gate for CSV writes

| Check | Severity |
|-------|----------|
| Missing `lane`, `date`, `session_game`, `nickname` | yellow/red |
| Non-numeric frame cell | red |
| Pin count outside 0–10 | red |
| Frames 1–9: b1+b2 > 10 (non-strike) | red |
| Frames 1–9: strike with non-empty b2 | red |
| Frames 1–9: b1 set, b2 missing | red |
| Frame 10: strike missing b2; double strike missing b3; spare missing b3; open with b3 | red |
| `computed != final_score` when both present | red |
| Cannot compute (incomplete) | red |

### JavaScript (`validateRow`) — admin UI feedback

Checks missing metadata, player/nickname, incomplete frames, score mismatch. **Weaker** than Python (does not validate per-cell pin legality). **All CSV writes must pass `save_scores.py`** (Python validator).

### Duplicate detection

Unique key: `game_id|NICKNAME` (case-insensitive). Duplicates are rejected by `save_scores.py`.

---

## Normalization (`normalize_row_frames`)

Used before Python scoring/validation when cells may contain notation:

1. Normalize b1, then b2 (with b1 context for `/`), then b3.
2. Frames 1–9: if b1 is `10`, force b2 empty.
3. `X` in frame 10 b2/b3 → `10`.

CSV stored in git should already be normalized; normalization is for import pipelines and golden notation scenarios.

---

## Implementation parity matrix

| Responsibility | Canonical implementation | Remaining consumers |
|----------------|-------------------------|---------------------|
| CSV row scoring | JS: `parseGame` / Python: `row_to_frames` + `compute_bowling_score` | `js/data.js`, `js/utils.js`, dashboard pages (via data.js), `tools/save_scores.py`, `tools/audit_historical.py`, CI verify scripts |
| Live entry grid scoring | JS: `scoreGame` | `admin/admin.js` |
| CSV row validation (strict) | Python: `validate_player_row` | `save_scores.py`, `audit_historical.py`, `review_tool.py`, `normalize_data.py` |
| CSV row validation (UI) | JS: `validateRow` | `admin/admin.js` |
| Frame notation normalization | Python: `normalize_row_frames` | `normalize_data.py`, golden Python tests |
| Ball cell parsing (notation) | JS: `parseBallCell`, `buildFrame` | `parseGame`, bulk paste |
| Nickname → player | JS: `js/nickname-map.js` / Python: `tools/nickname_map.py` | admin, save_scores, data.js — **manual sync required** |
| CSV parse/serialize | JS: `parseCSVText`, `rowsToCSV` | admin, data.js |
| CSV parse (Python) | `save_scores.load_rows`, csv module | save_scores, audit, sync_sheet |
| Bulk compact paste | JS: `parseCompactLine`, `parseBulkGames` | admin only |
| Golden test expected values | `tests/golden_games.json` | `test_js_scoring.js`, `test_python_scoring.py`, `verify_implementation_parity.py` |

### Known intentional duplication (drift risk)

| Area | Risk | Mitigation |
|------|------|------------|
| Two scoring engines (JS + Python) | Logic drift | Golden tests + cross-parity CI |
| Two validators (JS weak, Python strict) | Bad data saved via admin download | **Always run `save_scores.py` before commit** |
| Nickname maps (JS + Python) | Import resolves wrong player | Maintainer checklist; add alias to both files |
| `scoreGame` vs `parseGame` (JS) | Subtle frame-10 differences | Golden tests cover both paths indirectly via row cells |
| `scripts/gen-sample.js` CSV parser | Stale parser | Uses `BowlingCore.parseCSVLine` when run via Node helper |

---

## Change process

1. Update this spec.
2. Add/adjust scenarios in `tests/golden_games.json`.
3. Run `python tools/gen_golden_expected.py` after cell changes.
4. Implement in **both** `bowling-core.js` and `bowling_utils.py`.
5. Run `node tests/test_js_scoring.js`, `python tests/test_python_scoring.py`, `python tests/verify_implementation_parity.py`.
6. Run `python tools/save_scores.py -i data/scores.csv --verify-only` if CSV touched.
