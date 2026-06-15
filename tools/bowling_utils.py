"""Shared bowling score utilities for normalization and review."""

from __future__ import annotations

import re
from typing import Any

CSV_HEADER = [
    "game_id",
    "date",
    "lane",
    "session_game",
    "completed_time",
    "player",
    "nickname",
    "f1_b1",
    "f1_b2",
    "f2_b1",
    "f2_b2",
    "f3_b1",
    "f3_b2",
    "f4_b1",
    "f4_b2",
    "f5_b1",
    "f5_b2",
    "f6_b1",
    "f6_b2",
    "f7_b1",
    "f7_b2",
    "f8_b1",
    "f8_b2",
    "f9_b1",
    "f9_b2",
    "f10_b1",
    "f10_b2",
    "f10_b3",
    "final_score",
]

FRAME_COLS = [c for c in CSV_HEADER if re.match(r"f\d+_b\d+", c)]


def frame_ball_columns(frame_num: int) -> list[str]:
    balls = ["b1", "b2"]
    if frame_num == 10:
        balls.append("b3")
    return [f"f{frame_num}_{b}" for b in balls]


def parse_date(date_str: str) -> str | None:
    """Return ISO date YYYY-MM-DD from M/D/YYYY, or None."""
    date_str = (date_str or "").strip()
    if not date_str:
        return None
    parts = date_str.split("/")
    if len(parts) != 3:
        return None
    try:
        month, day, year = int(parts[0]), int(parts[1]), int(parts[2])
        return f"{year:04d}-{month:02d}-{day:02d}"
    except ValueError:
        return None


def normalize_frame_value(
    value: str,
    *,
    ball: str,
    frame_num: int,
    b1_value: str | None = None,
) -> str:
    """
    Convert a single cell to canonical form: integer 0-10 or empty.

    Canonical: integers 0-10, empty = ball not bowled.
    """
    raw = "" if value is None else str(value).strip()

    if raw == "":
        return ""

    upper = raw.upper()
    if upper == "X":
        if ball == "b1":
            return "10"
        if frame_num == 10 and ball in ("b2", "b3"):
            return "10"
        return ""
    if raw == "-":
        return "0"
    if raw == "/":
        if ball != "b2" or b1_value is None or b1_value == "":
            return ""
        try:
            b1 = int(b1_value)
        except ValueError:
            return ""
        if 0 <= b1 < 10:
            return str(10 - b1)
        return ""

    if raw.isdigit() or (raw.startswith("-") and raw[1:].isdigit()):
        n = int(raw)
        if n < 0 or n > 10:
            return str(n)
        if ball == "b2" and frame_num <= 9 and b1_value not in (None, ""):
            try:
                b1 = int(b1_value)
            except ValueError:
                return str(n)
            if 0 < b1 < 10 and n == 10:
                return str(10 - b1)
        if ball == "b2" and frame_num == 10 and b1_value not in (None, ""):
            try:
                b1 = int(b1_value)
            except ValueError:
                return str(n)
            if 0 < b1 < 10 and n == 10:
                return str(10 - b1)
        return str(n)

    return raw


def normalize_row_frames(row: dict[str, str]) -> dict[str, str]:
    """Return a copy of row with frame columns normalized."""
    out = dict(row)
    for frame_num in range(1, 11):
        cols = frame_ball_columns(frame_num)
        b1_col = cols[0]
        b1_norm = normalize_frame_value(
            out.get(b1_col, ""),
            ball="b1",
            frame_num=frame_num,
        )
        out[b1_col] = b1_norm

        if len(cols) > 1:
            b2_col = cols[1]
            out[b2_col] = normalize_frame_value(
                out.get(b2_col, ""),
                ball="b2",
                frame_num=frame_num,
                b1_value=b1_norm,
            )

        if len(cols) > 2:
            b3_col = cols[2]
            out[b3_col] = normalize_frame_value(
                out.get(b3_col, ""),
                ball="b3",
                frame_num=frame_num,
            )

        if frame_num < 10 and b1_norm == "10":
            out[cols[1]] = ""

    return out


def row_to_frames(row: dict[str, Any]) -> list[dict[str, int | None]]:
    """Parse normalized row into frame dicts with optional int pin counts."""
    frames: list[dict[str, int | None]] = []
    for frame_num in range(1, 11):
        frame: dict[str, int | None] = {"b1": None, "b2": None}
        if frame_num == 10:
            frame["b3"] = None
        for col in frame_ball_columns(frame_num):
            ball = col.split("_")[1]
            val = row.get(col, "")
            if val is None or str(val).strip() == "":
                frame[ball] = None
            else:
                try:
                    frame[ball] = int(val)
                except (TypeError, ValueError):
                    frame[ball] = None
        frames.append(frame)
    return frames


def frame_to_rolls(frame: dict[str, int | None], frame_idx: int) -> list[int]:
    """Convert one frame to sequential rolls bowled."""
    b1 = frame.get("b1")
    b2 = frame.get("b2")
    b3 = frame.get("b3") if frame_idx == 9 else None
    rolls: list[int] = []

    if frame_idx < 9:
        if b1 is None:
            return rolls
        p1 = b1
        if p1 == 10:
            rolls.append(10)
            return rolls
        rolls.append(p1)
        if b2 is not None:
            rolls.append(b2)
        return rolls

    if b1 is None:
        return rolls
    p1 = b1
    if p1 == 10:
        rolls.append(10)
        if b2 is not None:
            rolls.append(b2)
            if b3 is not None:
                rolls.append(b3)
    else:
        rolls.append(p1)
        if b2 is not None:
            p2 = b2
            rolls.append(p2)
            if p1 + p2 == 10 and b3 is not None:
                rolls.append(b3)
    return rolls


def compute_bowling_score(frames: list[dict[str, int | None]]) -> int | None:
    """Standard ten-pin score from frame dicts."""
    if len(frames) < 10:
        return None

    rolls: list[int] = []
    for i, frame in enumerate(frames[:10]):
        rolls.extend(frame_to_rolls(frame, i))

    if not rolls:
        return None

    total = 0
    idx = 0
    for f in range(10):
        if idx >= len(rolls):
            return None
        if f == 9:
            total += sum(rolls[idx:])
            break
        if rolls[idx] == 10:
            if idx + 2 >= len(rolls):
                return None
            total += 10 + rolls[idx + 1] + rolls[idx + 2]
            idx += 1
        elif idx + 1 < len(rolls) and rolls[idx] + rolls[idx + 1] == 10:
            if idx + 2 >= len(rolls):
                return None
            total += 10 + rolls[idx + 2]
            idx += 2
        else:
            if idx + 1 >= len(rolls):
                return None
            total += rolls[idx] + rolls[idx + 1]
            idx += 2
    return total


def compute_running_totals(frames: list[dict[str, int | None]]) -> list[int | None]:
    """Running cumulative score after each frame (1..10)."""
    if len(frames) < 10:
        return [None] * 10

    rolls: list[int] = []
    for i, frame in enumerate(frames[:10]):
        rolls.extend(frame_to_rolls(frame, i))

    totals: list[int | None] = [None] * 10
    roll_idx = 0
    cumulative = 0

    for f in range(10):
        if roll_idx >= len(rolls):
            break
        if f == 9:
            frame_score = sum(rolls[roll_idx:])
        elif rolls[roll_idx] == 10:
            if roll_idx + 2 >= len(rolls):
                break
            frame_score = 10 + rolls[roll_idx + 1] + rolls[roll_idx + 2]
            roll_idx += 1
        elif roll_idx + 1 < len(rolls) and rolls[roll_idx] + rolls[roll_idx + 1] == 10:
            if roll_idx + 2 >= len(rolls):
                break
            frame_score = 10 + rolls[roll_idx + 2]
            roll_idx += 2
        else:
            if roll_idx + 1 >= len(rolls):
                break
            frame_score = rolls[roll_idx] + rolls[roll_idx + 1]
            roll_idx += 2

        cumulative += frame_score
        totals[f] = cumulative

    return totals


def ball_to_notation(ball_val: int | None, *, is_spare_second: bool = False) -> str:
    if ball_val is None:
        return ""
    if is_spare_second:
        return "/"
    if ball_val == 10:
        return "X"
    if ball_val == 0:
        return "-"
    return str(ball_val)


def frame_display_notation(
    frame: dict[str, int | None], frame_num: int
) -> str:
    """Bowling notation for one frame cell."""
    b1 = frame.get("b1")
    b2 = frame.get("b2")
    b3 = frame.get("b3") if frame_num == 10 else None

    if b1 is None:
        return ""

    if frame_num < 10:
        if b1 == 10:
            return "X"
        if b2 is None:
            return ball_to_notation(b1)
        if b1 + b2 == 10:
            return f"{ball_to_notation(b1)}{ball_to_notation(b2, is_spare_second=True)}"
        return f"{ball_to_notation(b1)}{ball_to_notation(b2)}"

    parts: list[str] = []
    if b1 == 10:
        parts.append("X")
        if b2 is not None:
            parts.append("X" if b2 == 10 else ball_to_notation(b2))
            if b3 is not None:
                parts.append("X" if b3 == 10 else ball_to_notation(b3))
    else:
        parts.append(ball_to_notation(b1))
        if b2 is not None:
            if b1 + b2 == 10:
                parts.append("/")
            else:
                parts.append(ball_to_notation(b2))
            if b3 is not None and b1 + b2 == 10:
                parts.append("X" if b3 == 10 else ball_to_notation(b3))
    return "".join(parts)


def parse_final_score(row: dict[str, Any]) -> int | None:
    val = row.get("final_score", "")
    if val is None or str(val).strip() == "":
        return None
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


def validate_player_row(row: dict[str, Any]) -> dict[str, Any]:
    """
    Validate one player row. Returns dict with:
    status ('green'|'yellow'|'red'), issues list, bad_cells set, computed score.
    """
    issues: list[str] = []
    bad_cells: set[str] = set()

    for field in ("lane", "date", "session_game", "nickname"):
        if not str(row.get(field, "") or "").strip():
            issues.append(f"Missing required field: {field}")
            bad_cells.add(field)

    frames = row_to_frames(row)

    for frame_num in range(1, 11):
        frame = frames[frame_num - 1]
        cols = frame_ball_columns(frame_num)
        b1 = frame.get("b1")
        b2 = frame.get("b2")
        b3 = frame.get("b3") if frame_num == 10 else None

        for col in cols:
            raw = row.get(col, "")
            if raw is None or str(raw).strip() == "":
                continue
            try:
                n = int(raw)
            except (TypeError, ValueError):
                issues.append(f"{col}: non-numeric value '{raw}'")
                bad_cells.add(col)
                continue
            if n < 0 or n > 10:
                issues.append(f"{col}: value {n} out of range 0-10")
                bad_cells.add(col)

        if frame_num < 10:
            if b1 is not None and b2 is not None and b1 != 10 and b1 + b2 > 10:
                issues.append(f"Frame {frame_num}: b1+b2={b1}+{b2} > 10")
                bad_cells.update(cols[:2])

            if b1 == 10 and b2 is not None:
                issues.append(f"Frame {frame_num}: strike should have empty b2")
                bad_cells.add(cols[1])

            if b1 is not None and b1 != 10 and b2 is None:
                issues.append(f"Frame {frame_num}: missing b2")
                bad_cells.add(cols[1])

        if frame_num == 10 and b1 is not None:
            if b1 == 10:
                if b2 is None:
                    issues.append("Frame 10: strike needs b2")
                    bad_cells.add(cols[1])
                elif b2 == 10 and b3 is None:
                    issues.append("Frame 10: double strike needs b3")
                    bad_cells.add(cols[2])
            elif b2 is not None:
                if b1 + b2 == 10 and b3 is None:
                    issues.append("Frame 10: spare needs b3")
                    bad_cells.add(cols[2])
                if b1 + b2 < 10 and b3 is not None:
                    issues.append("Frame 10: open frame should not have b3")
                    bad_cells.add(cols[2])

    computed = compute_bowling_score(frames)
    final = parse_final_score(row)

    if computed is None:
        issues.append("Cannot compute score (incomplete frames)")
    elif final is not None and computed != final:
        issues.append(f"Score mismatch: computed {computed} != final {final}")
        bad_cells.add("final_score")

    if any("Score mismatch" in i or "Cannot compute" in i for i in issues):
        status = "red"
    elif issues:
        status = "yellow"
    else:
        status = "green"

    return {
        "status": status,
        "issues": issues,
        "bad_cells": bad_cells,
        "computed": computed,
        "running_totals": compute_running_totals(frames),
        "frames": frames,
    }
