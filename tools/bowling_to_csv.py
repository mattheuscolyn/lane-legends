#!/usr/bin/env python3
"""
Convert Phase 1 bowling scoreboard JSON transcriptions to CSV rows.

Usage:
    python tools/bowling_to_csv.py game-images/ --output game-images/output.csv

Reads *.json files only — no API calls, standard library only.
Run from the repository root.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import secrets
import sys
from pathlib import Path
from typing import Any

from bowling_utils import CSV_HEADER, compute_bowling_score


def generate_game_id() -> str:
    return secrets.token_urlsafe(8).lower().replace("-", "").replace("_", "")[:13]


def frames_to_flat_columns(frames: list[dict[str, Any]]) -> dict[str, str]:
    """Map 10 frame dicts to f1_b1..f10_b3 CSV cells."""
    out: dict[str, str] = {f"f{i}_b{j}": "" for i in range(1, 11) for j in range(1, 4)}

    for i, frame in enumerate(frames[:10]):
        frame_num = i + 1
        b1 = frame.get("b1")
        b2 = frame.get("b2")
        b3 = frame.get("b3") if frame_num == 10 else None

        if frame_num < 10:
            if b1 is None:
                continue
            p1 = int(b1)
            if p1 == 10:
                out[f"f{frame_num}_b1"] = "10"
            else:
                out[f"f{frame_num}_b1"] = str(p1)
                if b2 is not None:
                    out[f"f{frame_num}_b2"] = str(int(b2))
        else:
            if b1 is None:
                continue
            p1 = int(b1)
            out["f10_b1"] = str(p1)
            if p1 == 10:
                if b2 is not None:
                    out["f10_b2"] = str(int(b2))
                    if b3 is not None:
                        out["f10_b3"] = str(int(b3))
            elif b2 is not None:
                p2 = int(b2)
                out["f10_b2"] = str(p2)
                if p1 + p2 == 10 and b3 is not None:
                    out["f10_b3"] = str(int(b3))

    return out


def has_low_confidence(frames: list[dict[str, Any]]) -> bool:
    return any(frame.get("low_confidence") for frame in frames)


def build_row(
    game_id: str,
    meta: dict[str, Any],
    player: dict[str, Any],
) -> dict[str, str]:
    frames = player.get("frames") or []
    flat = frames_to_flat_columns(frames)
    row = {k: "" for k in CSV_HEADER}
    row.update(flat)
    row["game_id"] = game_id
    row["date"] = str(meta.get("date") or "")
    row["lane"] = str(meta.get("lane") or "")
    row["session_game"] = str(meta.get("session_game") or "")
    row["completed_time"] = str(meta.get("completed_time") or "")
    row["player"] = ""
    row["nickname"] = str(player.get("nickname") or "")
    row["final_score"] = str(player.get("final_score") or "")
    return row


def print_row_preview(
    row: dict[str, str],
    player: dict[str, Any],
    computed: int | None,
) -> None:
    frames = player.get("frames") or []
    print("\n--- Review row ---")
    print(f"  nickname:     {row['nickname']}")
    print(f"  lane:         {row['lane']}  game: {row['session_game']}")
    print(f"  date/time:    {row['date']}  {row['completed_time']}")
    print(f"  final_score:  {row['final_score']}  (computed: {computed})")
    lc_frames = [i + 1 for i, f in enumerate(frames) if f.get("low_confidence")]
    if lc_frames:
        print(f"  low confidence frames: {lc_frames}")
    frame_bits = []
    for i, fr in enumerate(frames, start=1):
        parts = []
        if fr.get("b1") is not None:
            parts.append(str(fr["b1"]) if fr["b1"] != 10 else "X")
        if fr.get("b2") is not None:
            b1 = fr.get("b1")
            b2 = fr["b2"]
            if b1 is not None and int(b1) + int(b2) == 10 and int(b1) < 10:
                parts.append("/")
            else:
                parts.append(str(b2) if b2 != 10 else "X")
        if fr.get("b3") is not None:
            parts.append(str(fr["b3"]) if fr["b3"] != 10 else "X")
        flag = "*" if fr.get("low_confidence") else ""
        frame_bits.append(f"F{i}:{''.join(parts)}{flag}")
    print(f"  frames:       {' | '.join(frame_bits)}")
    balls = [row[k] for k in CSV_HEADER if re.match(r"f\d+_b\d+", k) and row.get(k)]
    print(f"  CSV balls:    {', '.join(balls)}")


def interactive_review(
    row: dict[str, str],
    player: dict[str, Any],
    computed: int | None,
) -> dict[str, str] | None:
    print_row_preview(row, player, computed)
    print("\nPress Enter to accept, type 'skip' to discard,")
    print('or paste JSON to override fields (e.g. {"final_score": 85, "f10_b1": "10"}).')
    answer = input("> ").strip()
    if not answer:
        return row
    if answer.lower() == "skip":
        return None
    try:
        patch = json.loads(answer)
        if isinstance(patch, dict):
            for k, v in patch.items():
                if k in CSV_HEADER:
                    row[k] = str(v) if v is not None else ""
            return row
    except json.JSONDecodeError:
        pass
    print("Invalid input — treating as skip.")
    return None


def load_existing_keys(path: Path) -> set[tuple[str, str]]:
    keys: set[tuple[str, str]] = set()
    if not path.exists():
        return keys
    with path.open(newline="", encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            gid = (r.get("game_id") or "").strip()
            nick = (r.get("nickname") or "").strip()
            if gid and nick:
                keys.add((gid, nick))
    return keys


def append_rows(path: Path, rows: list[dict[str, str]]) -> None:
    write_header = not path.exists() or path.stat().st_size == 0
    with path.open("a", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_HEADER, extrasaction="ignore")
        if write_header:
            writer.writeheader()
        for row in rows:
            writer.writerow(row)


def process_json_file(
    path: Path,
    output_path: Path,
    existing_keys: set[tuple[str, str]],
    *,
    auto_confirm: bool = False,
) -> dict[str, Any]:
    summary: dict[str, Any] = {"file": str(path), "rows_written": 0, "warnings": []}

    with path.open(encoding="utf-8") as fh:
        data = json.load(fh)

    print(f"\n=== {path.name} ===")
    game_id = generate_game_id()
    meta = {
        "date": data.get("date", ""),
        "lane": data.get("lane", ""),
        "session_game": data.get("session_game", ""),
        "completed_time": data.get("completed_time", ""),
    }
    players = data.get("players") or []
    rows_to_write: list[dict[str, str]] = []

    for player in players:
        nickname = str(player.get("nickname") or "").strip()
        if not nickname:
            continue

        frames = player.get("frames") or []
        try:
            final_score = int(player["final_score"])
        except (KeyError, TypeError, ValueError):
            summary["warnings"].append(f"Missing final_score for {nickname} — skipped")
            print(f"  WARNING: Missing final_score for {nickname} — skipped")
            continue

        computed = compute_bowling_score(frames)
        needs_review = (
            computed is None
            or computed != final_score
            or has_low_confidence(frames)
        )

        row = build_row(game_id, meta, player)

        if (game_id, nickname) in existing_keys:
            print(f"  Skip duplicate: {nickname}")
            continue

        if needs_review and not auto_confirm:
            if computed is not None and computed != final_score:
                msg = f"{nickname}: computed {computed} != Tot. {final_score}"
                summary["warnings"].append(msg)
            reviewed = interactive_review(row, player, computed)
            if reviewed is None:
                print(f"  Skipped {nickname}")
                continue
            row = reviewed
        elif needs_review:
            summary["warnings"].append(
                f"{nickname}: score check {computed} vs {final_score} (auto-confirmed)"
            )

        print(f"  {nickname}: {final_score} pts")
        rows_to_write.append(row)
        existing_keys.add((game_id, nickname))

    if rows_to_write:
        append_rows(output_path, rows_to_write)
        summary["rows_written"] = len(rows_to_write)
        print(f"  Appended {len(rows_to_write)} row(s) -> {output_path}")
    else:
        print("  No rows written.")

    return summary


def collect_json_files(folder: Path, recursive: bool) -> list[Path]:
    paths = list(folder.rglob("*.json") if recursive else folder.glob("*.json"))
    return sorted(set(paths))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert bowling scoreboard JSON transcriptions to CSV."
    )
    parser.add_argument(
        "photos_dir",
        type=Path,
        help="Folder containing Phase 1 JSON files",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        default=Path("game-images/output.csv"),
        help="Output CSV path (default: game-images/output.csv)",
    )
    parser.add_argument(
        "--no-recursive",
        action="store_true",
        help="Only scan the top-level folder (default: include subfolders)",
    )
    parser.add_argument(
        "--yes",
        "-y",
        action="store_true",
        help="Skip interactive review prompts (accept all rows)",
    )
    args = parser.parse_args()

    photos_dir = args.photos_dir.resolve()
    if not photos_dir.is_dir():
        raise SystemExit(f"Not a directory: {photos_dir}")

    json_files = collect_json_files(photos_dir, recursive=not args.no_recursive)
    if not json_files:
        raise SystemExit(f"No JSON files found in {photos_dir}")

    output_path = args.output.resolve()
    existing_keys = load_existing_keys(output_path)
    totals = {"files": 0, "rows": 0, "warnings": 0}

    print(f"Processing {len(json_files)} JSON file(s) -> {output_path}")

    for json_path in json_files:
        try:
            summary = process_json_file(
                json_path,
                output_path,
                existing_keys,
                auto_confirm=args.yes,
            )
            totals["files"] += 1
            totals["rows"] += summary["rows_written"]
            totals["warnings"] += len(summary["warnings"])
        except Exception as err:
            print(f"  ERROR processing {json_path.name}: {err}", file=sys.stderr)
            totals["warnings"] += 1

    print(
        f"\nDone. {totals['files']} file(s), {totals['rows']} row(s) appended, "
        f"{totals['warnings']} warning(s)."
    )


if __name__ == "__main__":
    main()
