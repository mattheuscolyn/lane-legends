#!/usr/bin/env python3
"""
Pull bowling scores from a published Google Sheet CSV export and write data/scores.csv.

Usage (from repo root):
    python tools/sync_sheet_to_csv.py --url "$GOOGLE_SHEET_CSV_URL"
    python tools/sync_sheet_to_csv.py --dry-run

Requires the sheet to be shared as "Anyone with the link can view" (or published).
Set GOOGLE_SHEET_CSV_URL to the export URL:
  https://docs.google.com/spreadsheets/d/{ID}/export?format=csv&gid={GID}
"""

from __future__ import annotations

import argparse
import csv
import io
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

from bowling_utils import (
    CSV_HEADER,
    compute_bowling_score,
    normalize_row_frames,
    parse_final_score,
    row_to_frames,
    validate_player_row,
)
from nickname_map import resolve_player_from_nickname

DEFAULT_OUTPUT = Path("data/scores.csv")
USER_AGENT = "LaneLegends-ScoreSync/1.0"


def fetch_sheet_csv(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            return resp.read().decode("utf-8-sig")
    except urllib.error.HTTPError as err:
        raise SystemExit(
            f"Failed to fetch sheet (HTTP {err.code}). "
            "Check GOOGLE_SHEET_CSV_URL and sheet sharing settings."
        ) from err
    except urllib.error.URLError as err:
        raise SystemExit(f"Failed to fetch sheet: {err}") from err


def parse_sheet_rows(text: str) -> list[dict[str, str]]:
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise SystemExit("Sheet CSV has no header row.")

    rows: list[dict[str, str]] = []
    for raw in reader:
        if not any(str(v or "").strip() for v in raw.values()):
            continue
        row = {col: "" for col in CSV_HEADER}
        for key, val in raw.items():
            if key is None:
                continue
            col = key.strip()
            if col in row:
                row[col] = "" if val is None else str(val).strip()
        rows.append(row)
    return rows


def enrich_player_fields(row: dict[str, str]) -> dict[str, str]:
    player = (row.get("player") or "").strip()
    nickname = (row.get("nickname") or "").strip()

    if nickname and not player:
        row["player"] = resolve_player_from_nickname(nickname) or nickname
    elif player and not nickname:
        resolved = resolve_player_from_nickname(player)
        if resolved:
            row["nickname"] = player
            row["player"] = resolved
    elif not player and not nickname:
        pass
    else:
        row["player"] = player
        row["nickname"] = nickname

    return row


def prepare_rows(rows: list[dict[str, str]], *, strict: bool) -> list[dict[str, str]]:
    if not rows:
        raise SystemExit("Sheet contains no data rows.")

    prepared: list[dict[str, str]] = []
    errors: list[str] = []

    for i, raw in enumerate(rows, start=2):
        row = enrich_player_fields(dict(raw))
        row = normalize_row_frames(row)

        if not (row.get("player") or row.get("nickname")):
            errors.append(f"Row {i}: missing player and nickname")
            continue

        validation = validate_player_row(row)
        if validation["status"] == "red":
            for issue in validation["issues"]:
                errors.append(f"Row {i} ({row.get('nickname') or row.get('player')}): {issue}")
            if strict:
                continue

        frames = row_to_frames(row)
        computed = compute_bowling_score(frames)
        final = parse_final_score(row)
        if computed is not None and final is not None and computed != final:
            msg = (
                f"Row {i} ({row.get('nickname') or row.get('player')}): "
                f"computed {computed} != final_score {final}"
            )
            errors.append(msg)
            if strict:
                continue

        prepared.append({col: row.get(col, "") for col in CSV_HEADER})

    if errors:
        print("Validation issues:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)

    if strict and errors:
        raise SystemExit(f"Aborted: {len(errors)} validation issue(s). Fix the sheet and retry.")

    if not prepared:
        raise SystemExit("No valid rows after processing.")

    if errors and not strict:
        print(f"Warning: skipped or included rows despite {len(errors)} issue(s).", file=sys.stderr)

    return prepared


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_HEADER)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync Google Sheet → data/scores.csv")
    parser.add_argument(
        "--url",
        default=os.environ.get("GOOGLE_SHEET_CSV_URL", ""),
        help="Published Google Sheet CSV export URL (or set GOOGLE_SHEET_CSV_URL)",
    )
    parser.add_argument(
        "--input",
        "-i",
        type=Path,
        default=None,
        help="Local CSV file instead of fetching a sheet (for testing)",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Output CSV path (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and print summary without writing output",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        default=True,
        help="Abort on validation errors (default: true)",
    )
    parser.add_argument(
        "--no-strict",
        action="store_false",
        dest="strict",
        help="Write valid rows even if some rows fail validation",
    )
    args = parser.parse_args()

    if not args.url and not args.input:
        raise SystemExit(
            "Missing sheet URL. Pass --url, --input, or set GOOGLE_SHEET_CSV_URL.\n"
            "See docs/data-ingestion-architecture.md for setup."
        )

    if args.input:
        if not args.input.exists():
            raise SystemExit(f"Input file not found: {args.input}")
        print(f"Reading local file: {args.input}")
        text = args.input.read_text(encoding="utf-8-sig")
    else:
        print("Fetching sheet…")
        text = fetch_sheet_csv(args.url)
    raw_rows = parse_sheet_rows(text)
    print(f"  Parsed {len(raw_rows)} row(s) from sheet.")

    rows = prepare_rows(raw_rows, strict=args.strict)
    print(f"  {len(rows)} row(s) ready for {args.output}.")

    if args.dry_run:
        print("Dry run — no file written.")
        return

    write_csv(args.output, rows)
    print(f"Wrote {args.output} ({len(rows)} rows).")


if __name__ == "__main__":
    main()
