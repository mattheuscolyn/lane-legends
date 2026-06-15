#!/usr/bin/env python3
"""Golden scoring tests — Python canonical implementation."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

from bowling_utils import (  # noqa: E402
    CSV_HEADER,
    compute_bowling_score,
    compute_running_totals,
    normalize_row_frames,
    row_to_frames,
)

GOLDEN_PATH = Path(__file__).resolve().parent / "golden_games.json"


def row_from_scenario(cells: dict) -> dict[str, str]:
    row = {col: "" for col in CSV_HEADER}
    row.update({k: str(v) if v is not None else "" for k, v in cells.items()})
    return row


def score_scenario(scenario: dict) -> tuple[int | None, list[int | None]]:
    row = row_from_scenario(scenario["cells"])
    if scenario.get("encoding") == "notation":
        row = normalize_row_frames(row)
    frames = row_to_frames(row)
    return compute_bowling_score(frames), compute_running_totals(frames)


def main() -> None:
    golden = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))
    passed = 0

    for scenario in golden["scenarios"]:
        sid = scenario["id"]
        final_score, frame_totals = score_scenario(scenario)

        if final_score != scenario["expected_final_score"]:
            raise SystemExit(
                f"{sid} final score: expected {scenario['expected_final_score']}, got {final_score}"
            )

        expected_totals = scenario["expected_frame_totals"]
        if frame_totals != expected_totals:
            for i, (got, exp) in enumerate(zip(frame_totals, expected_totals, strict=True)):
                if got != exp:
                    raise SystemExit(
                        f"{sid} frame {i + 1}: expected {exp}, got {got}"
                    )

        if scenario.get("expect_incomplete") and final_score is not None:
            raise SystemExit(f"{sid}: expected incomplete (null score)")

        passed += 1

    print(f"OK: {passed}/{len(golden['scenarios'])} golden scenarios passed (Python)")


if __name__ == "__main__":
    main()
