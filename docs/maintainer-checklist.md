# Maintainer Checklist

Operational steps to keep bowling statistics correct. See [scoring-spec.md](scoring-spec.md) for rules.

---

## After every bowling session

### 1. Import photos (optional bulk path)

If using the photo transcription pipeline:

```bash
pip install -r requirements.txt
python tools/bowling_to_csv.py game-images/ -o game-images/output.csv
python tools/normalize_data.py -i game-images/output.csv -o /tmp/import.csv
python tools/save_scores.py -i /tmp/import.csv -o data/scores.csv
```

Otherwise skip to admin entry.

### 2. Enter scores

1. Run **`Open Admin.bat`** (or `python -m http.server 8080` → http://localhost:8080/admin/)
2. **+ New Game** — set date, lane, session #, time
3. Enter frames per player (notation: `X`, `/`, `-`, digits)
4. Use **Bulk paste** for multi-game import if needed
5. Confirm live score matches the alley display

### 3. Validate data

Before saving to the repo:

```bash
# Export/download CSV from admin, then:
python tools/save_scores.py -i path/to/downloaded.csv --verify-only

# Or validate current canonical file:
python tools/save_scores.py -i data/scores.csv --verify-only
```

Fix any reported errors in admin. **Do not hand-edit `final_score`** without fixing frame cells.

### 4. Save

```bash
python tools/save_scores.py -i path/to/downloaded.csv -o data/scores.csv
```

This creates a timestamped backup in `data/backups/` and refuses to write if validation fails.

### 5. Commit

```bash
git add data/scores.csv
git commit -m "Add bowling session YYYY-MM-DD"
git push
```

### 6. Deploy

GitHub Pages updates automatically after push to `main`. Confirm dashboard loads new games.

---

## Before every release

Run the full verification suite locally:

```bash
node tests/test_js_scoring.js
python tests/test_python_scoring.py
python tests/verify_implementation_parity.py
python tools/save_scores.py -i data/scores.csv --verify-only
python tools/audit_historical.py
node tools/verify_final_score.js
```

Review `docs/historical-data-audit.md` for new warnings.

Confirm CI **Verify scores** workflow is green on the PR.

---

## Before changing scoring logic

1. Read [scoring-spec.md](scoring-spec.md).
2. Add golden scenarios to `tests/golden_games.json` **first**.
3. Run `python tools/gen_golden_expected.py` to refresh expected values (verify JS agrees).
4. Implement changes in **both**:
   - `js/bowling-core.js`
   - `tools/bowling_utils.py`
5. All must pass:
   - `node tests/test_js_scoring.js`
   - `python tests/test_python_scoring.py`
   - `python tests/verify_implementation_parity.py`
6. Update scoring-spec.md if behavior intentionally changes.
7. Run historical audit — expect zero score mismatches unless migrating data deliberately.

---

## Adding a new alley nickname

1. Add to `js/nickname-map.js`
2. Add the same mapping to `tools/nickname_map.py`
3. Re-run `python tools/audit_historical.py`

---

## Recovery: restore a corrupted `data/scores.csv`

1. List backups:

   ```bash
   dir data\backups
   # or: ls data/backups/
   ```

2. Pick the newest backup before the bad save (files named `scores_backup_YYYYMMDD_HHMMSS.csv`).

3. Verify the backup:

   ```bash
   python tools/save_scores.py -i data/backups/scores_backup_YYYYMMDD_HHMMSS.csv --verify-only
   ```

4. Restore:

   ```bash
   python tools/save_scores.py -i data/backups/scores_backup_YYYYMMDD_HHMMSS.csv -o data/scores.csv --no-backup
   ```

   Or copy manually after verification.

5. Commit the restored file.

**Prevention:** Always use `save_scores.py` for writes — it backs up automatically and blocks invalid data.
