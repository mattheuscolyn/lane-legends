#!/usr/bin/env python3
"""Bootstrap expected scores for golden_games.json (dev helper)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from bowling_utils import (
    CSV_HEADER,
    compute_bowling_score,
    compute_running_totals,
    normalize_row_frames,
    row_to_frames,
)

GOLDEN = Path(__file__).resolve().parent.parent / "tests" / "golden_games.json"


def row_from_cells(cells: dict) -> dict:
    row = {c: "" for c in CSV_HEADER}
    row.update({k: str(v) if v is not None else "" for k, v in cells.items()})
    return row


def enrich(scenario: dict) -> dict:
    row = row_from_cells(scenario["cells"])
    if scenario.get("encoding") == "notation":
        row = normalize_row_frames(row)
    frames = row_to_frames(row)
    computed = compute_bowling_score(frames)
    totals = compute_running_totals(frames)
    scenario = dict(scenario)
    scenario["expected_final_score"] = computed
    scenario["expected_frame_totals"] = totals
    return scenario


if __name__ == "__main__":
    data = json.loads(GOLDEN.read_text(encoding="utf-8"))
    data["scenarios"] = [enrich(s) for s in data["scenarios"]]
    GOLDEN.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"Updated expected values in {GOLDEN}")
