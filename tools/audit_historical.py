#!/usr/bin/env python3
"""Audit data/scores.csv and write docs/historical-data-audit.md."""

from __future__ import annotations

import csv
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from bowling_utils import CSV_HEADER, validate_player_row
from nickname_map import NICKNAME_TO_PLAYER, resolve_player_from_nickname

ROOT = Path(__file__).resolve().parent.parent
SCORES = ROOT / "data" / "scores.csv"
OUTPUT = ROOT / "docs" / "historical-data-audit.md"


def load_rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        rows: list[dict[str, str]] = []
        for raw in reader:
            row = {col: "" for col in CSV_HEADER}
            for key, val in raw.items():
                if key and key.strip() in row:
                    row[key.strip()] = "" if val is None else str(val).strip()
            rows.append(row)
        return rows


def audit(rows: list[dict[str, str]]) -> dict:
    invalid: list[str] = []
    suspicious: list[str] = []
    score_mismatches: list[str] = []
    missing_meta: list[str] = []
    nickname_issues: list[str] = []
    duplicate_games: list[str] = []
    duplicate_players: list[str] = []

    game_ids: dict[str, list[int]] = defaultdict(list)
    player_keys: dict[str, list[int]] = defaultdict(list)
    nicknames_seen: dict[str, set[str]] = defaultdict(set)

    for i, row in enumerate(rows, start=2):
        line = f"Row {i} (game_id={row.get('game_id')}, {row.get('nickname') or row.get('player')})"
        result = validate_player_row(row)

        if result["status"] == "red":
            invalid.append(f"{line}: {'; '.join(result['issues'])}")
            if any("Score mismatch" in issue for issue in result["issues"]):
                score_mismatches.append(line)
        elif result["status"] == "yellow":
            suspicious.append(f"{line}: {'; '.join(result['issues'])}")

        for field in ("date", "lane", "session_game", "game_id"):
            if not str(row.get(field, "")).strip():
                missing_meta.append(f"{line}: missing {field}")

        nickname = (row.get("nickname") or "").strip()
        player = (row.get("player") or "").strip()
        if nickname:
            resolved = resolve_player_from_nickname(nickname)
            if resolved and player and resolved != player:
                nickname_issues.append(
                    f"{line}: nickname '{nickname}' resolves to '{resolved}' but player is '{player}'"
                )
            elif not resolved and nickname.upper() not in {k.upper() for k in NICKNAME_TO_PLAYER}:
                nickname_issues.append(f"{line}: unknown nickname '{nickname}'")

        gid = row.get("game_id", "")
        if gid:
            game_ids[gid].append(i)

        key = f"{gid}|{(nickname or player).upper()}"
        player_keys[key].append(i)

        if nickname:
            nicknames_seen[nickname.lower()].add(player.lower())

    for gid, line_nums in game_ids.items():
        if len(line_nums) > 6:
            duplicate_games.append(
                f"game_id {gid}: {len(line_nums)} player rows (lines {line_nums}) — unusually high"
            )

    for key, line_nums in player_keys.items():
        if len(line_nums) > 1:
            duplicate_players.append(f"Duplicate key {key} on lines {line_nums}")

    for nick, players in nicknames_seen.items():
        if len(players) > 1:
            nickname_issues.append(
                f"Nickname '{nick}' maps to multiple player values: {sorted(players)}"
            )

    return {
        "row_count": len(rows),
        "game_count": len(game_ids),
        "invalid": invalid,
        "suspicious": suspicious,
        "score_mismatches": score_mismatches,
        "missing_meta": missing_meta,
        "nickname_issues": nickname_issues,
        "duplicate_games": duplicate_games,
        "duplicate_players": duplicate_players,
    }


def render(report: dict) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "# Historical Data Audit",
        "",
        f"Generated: {ts}",
        f"Source: `data/scores.csv`",
        "",
        "## Summary",
        "",
        f"- **Player rows:** {report['row_count']}",
        f"- **Distinct games:** {report['game_count']}",
        f"- **Invalid (red):** {len(report['invalid'])}",
        f"- **Suspicious (yellow):** {len(report['suspicious'])}",
        f"- **Score mismatches:** {len(report['score_mismatches'])}",
        f"- **Duplicate player keys:** {len(report['duplicate_players'])}",
        "",
        "## Recommendations",
        "",
    ]

    recs: list[str] = []
    if report["invalid"]:
        recs.append("Fix all **invalid (red)** rows before the next release. Do not edit `final_score` without correcting frame cells.")
    if report["score_mismatches"]:
        recs.append("Reconcile score mismatches by recomputing from frame data; prefer `computed` over manual `final_score`.")
    if report["duplicate_players"]:
        recs.append("Remove duplicate `game_id|nickname` rows — only one row per player per game.")
    if report["nickname_issues"]:
        recs.append(
            "Review nickname rows in the audit — add aliases to both nickname maps, "
            "or confirm `player` column is authoritative for historical typos (e.g. swapped SHREKK/MAFUS)."
        )
    if report["missing_meta"]:
        recs.append("Fill missing metadata (date, lane, session_game, game_id) for traceability.")
    if report["suspicious"]:
        recs.append("Review **suspicious (yellow)** rows — may be incomplete games or missing optional fields.")
    if not recs:
        recs.append("No critical issues found. Continue running golden tests and `save_scores.py` before every CSV write.")

    lines.extend(f"- {r}" for r in recs)
    lines.append("")

    sections = [
        ("Invalid rows", report["invalid"]),
        ("Suspicious rows", report["suspicious"]),
        ("Score mismatches", report["score_mismatches"]),
        ("Duplicate players in same game", report["duplicate_players"]),
        ("Duplicate / crowded games", report["duplicate_games"]),
        ("Missing metadata", report["missing_meta"]),
        ("Nickname inconsistencies", report["nickname_issues"]),
    ]

    for title, items in sections:
        lines.extend([f"## {title}", ""])
        if items:
            lines.extend(f"- {item}" for item in items)
        else:
            lines.append("_None._")
        lines.append("")

    lines.append("## Notes")
    lines.append("")
    lines.append("- This audit is **read-only** — no data was modified.")
    lines.append("- Validation uses `tools/bowling_utils.validate_player_row` (Python canonical validator).")
    lines.append("- JS scoring is cross-checked in CI via `tests/golden_games.json`.")
    lines.append("")

    return "\n".join(lines)


def main() -> None:
    if not SCORES.exists():
        raise SystemExit(f"Not found: {SCORES}")

    rows = load_rows(SCORES)
    report = audit(rows)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(render(report), encoding="utf-8")
    print(f"Wrote {OUTPUT}")
    print(
        f"Rows: {report['row_count']} | Invalid: {len(report['invalid'])} | "
        f"Suspicious: {len(report['suspicious'])} | Duplicates: {len(report['duplicate_players'])}"
    )


if __name__ == "__main__":
    main()
