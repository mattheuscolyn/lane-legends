#!/usr/bin/env python3
"""Compute dataset metrics for production verification."""

from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path

from bowling_utils import CSV_HEADER, compute_bowling_score, row_to_frames, parse_final_score

CSV_PATH = Path("data/scores.csv")


def load_rows() -> list[dict[str, str]]:
    with CSV_PATH.open(newline="", encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))


def main() -> None:
    rows = load_rows()
    game_ids = set()
    sessions = set()
    players = set()
    scores_by_player: dict[str, list[int]] = defaultdict(list)
    mismatches = []

    for i, row in enumerate(rows, start=2):
        gid = row.get("game_id", "")
        game_ids.add(gid)
        sessions.add((row.get("date", ""), gid))
        date_sessions = row.get("date", "")
        if date_sessions:
            sessions.add(("date_only", date_sessions))
        p = row.get("player", "") or row.get("nickname", "")
        players.add(p)

        frames = row_to_frames({k: row.get(k, "") for k in CSV_HEADER})
        computed = compute_bowling_score(frames)
        final = parse_final_score(row)
        if computed is not None and final is not None and computed != final:
            mismatches.append((i, p, computed, final))

        if final is not None:
            scores_by_player[row.get("player", p)].append(final)

    unique_dates = {r.get("date") for r in rows if r.get("date")}
    session_dates = len(unique_dates)

    print("=== Dataset metrics ===")
    print(f"Total rows: {len(rows)}")
    print(f"Unique game_ids: {len(game_ids)}")
    print(f"Unique dates (sessions): {session_dates}")
    print(f"Unique players: {len(players)}")
    print(f"Score mismatches (computed vs final): {len(mismatches)}")

    for name in sorted(scores_by_player):
        sc = scores_by_player[name]
        print(f"  {name}: games={len(sc)} avg={sum(sc)/len(sc):.1f} high={max(sc)} low={min(sc)}")

    if mismatches[:5]:
        print("Sample mismatches:")
        for m in mismatches[:5]:
            print(f"  row {m[0]} {m[1]}: computed={m[2]} final={m[3]}")


if __name__ == "__main__":
    main()
