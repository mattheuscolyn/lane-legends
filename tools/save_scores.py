#!/usr/bin/env python3
"""
Validate and write scores CSV (used after admin export or CI).

Usage:
    python tools/save_scores.py --input scores.csv
    python tools/save_scores.py --input scores.csv --output data/scores.csv
"""

from __future__ import annotations

import argparse
import csv
import shutil
from datetime import datetime
from pathlib import Path

from bowling_utils import CSV_HEADER, validate_player_row
from nickname_map import resolve_player_from_nickname

DEFAULT_OUTPUT = Path("data/scores.csv")
BACKUP_DIR = Path("data/backups")


def enrich_row(row: dict[str, str]) -> dict[str, str]:
    player = (row.get("player") or "").strip()
    nickname = (row.get("nickname") or "").strip()
    if nickname and not player:
        row["player"] = resolve_player_from_nickname(nickname) or nickname
    elif player and not nickname:
        resolved = resolve_player_from_nickname(player)
        if resolved:
            row["nickname"] = player
            row["player"] = resolved
    return row


def load_rows(path: Path) -> tuple[list[dict[str, str]], list[str] | None]:
    with path.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        fieldnames = list(reader.fieldnames or [])
        rows = []
        for raw in reader:
            row = {col: "" for col in CSV_HEADER}
            for key, val in raw.items():
                if key and key.strip() in row:
                    row[key.strip()] = "" if val is None else str(val).strip()
            rows.append(enrich_row(row))
        return rows, fieldnames


def verify_schema(fieldnames: list[str] | None) -> list[str]:
    """Return schema errors; empty list means OK."""
    errors: list[str] = []
    if not fieldnames:
        return ["CSV has no header row"]
    normalized = {h.strip() for h in fieldnames if h}
    required = set(CSV_HEADER)
    missing = sorted(required - normalized)
    if missing:
        errors.append(f"Missing required columns: {', '.join(missing)}")
    return errors


def validate_all(rows: list[dict[str, str]], *, strict: bool) -> list[str]:
    errors: list[str] = []
    seen: set[str] = set()
    for i, row in enumerate(rows, start=2):
        key = f"{row.get('game_id')}|{(row.get('nickname') or row.get('player') or '').upper()}"
        if key in seen:
            errors.append(f"Row {i}: duplicate {key}")
        seen.add(key)
        result = validate_player_row(row)
        if result["status"] == "red":
            for issue in result["issues"]:
                errors.append(f"Row {i}: {issue}")
        elif result["status"] == "yellow" and strict:
            for issue in result["issues"]:
                errors.append(f"Row {i}: {issue}")

    return errors


def backup(path: Path) -> None:
    if not path.exists():
        return
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    shutil.copy2(path, BACKUP_DIR / f"{path.stem}_backup_{ts}{path.suffix}")


def write_rows(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_HEADER)
        writer.writeheader()
        for row in rows:
            writer.writerow({col: row.get(col, "") for col in CSV_HEADER})


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate and save scores CSV.")
    parser.add_argument("--input", "-i", type=Path, required=True)
    parser.add_argument("--output", "-o", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--no-strict", action="store_true")
    parser.add_argument("--no-backup", action="store_true")
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Validate schema and rows without writing output",
    )
    args = parser.parse_args()

    if not args.input.exists():
        raise SystemExit(f"Not found: {args.input}")

    rows, fieldnames = load_rows(args.input)
    if not rows:
        raise SystemExit("No data rows.")

    errors = verify_schema(fieldnames)
    errors.extend(validate_all(rows, strict=not args.no_strict))

    if errors:
        print("Validation failed — save refused:")
        for err in errors:
            print(f"  {err}")
        raise SystemExit(1)

    if args.verify_only:
        print(f"OK: {len(rows)} rows passed schema and validation checks")
        return

    if not args.no_backup and args.output.exists():
        backup(args.output)

    write_rows(args.output, rows)
    print(f"Wrote {len(rows)} rows to {args.output}")


if __name__ == "__main__":
    main()
