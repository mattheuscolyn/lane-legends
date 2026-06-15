#!/usr/bin/env python3
"""
Part 1: Audit and normalize bowling score CSV to canonical numeric frame values.

Usage:
    python normalize_data.py [--input PATH] [--output data/scores.csv]
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter
from pathlib import Path

import pandas as pd

from bowling_utils import (
    CSV_HEADER,
    FRAME_COLS,
    compute_bowling_score,
    normalize_row_frames,
    parse_date,
    parse_final_score,
    row_to_frames,
)

REFERENCE_CUTOFF = "2026-05-28"


def find_input_csv(explicit: Path | None) -> Path:
    if explicit is not None:
        if not explicit.exists():
            raise SystemExit(f"Input file not found: {explicit}")
        return explicit

    candidates = [
        Path("output.csv"),
        Path("data/scores.csv"),
        Path("game-images/output.csv"),
    ]
    for path in candidates:
        if path.exists():
            return path
    raise SystemExit(
        "No CSV found. Tried output.csv, data/scores.csv, game-images/output.csv. "
        "Pass --input PATH."
    )


def categorize_value(val: str) -> str:
    v = "" if val is None else str(val).strip()
    if v == "":
        return "empty"
    if v.upper() == "X":
        return "X"
    if v == "/":
        return "/"
    if v == "-":
        return "-"
    if v.isdigit() or (v.startswith("-") and v[1:].isdigit()):
        n = int(v)
        if n == 10:
            return "int_10"
        if 0 <= n <= 9:
            return "int_0_9"
        return "other_int"
    return "other"


def audit_encodings(df: pd.DataFrame) -> None:
    df = df.copy()
    df["_iso_date"] = df["date"].apply(parse_date)
    ref = df[df["_iso_date"] < REFERENCE_CUTOFF]
    newer = df[df["_iso_date"] >= REFERENCE_CUTOFF]

    print("=== Encoding audit (before normalization) ===\n")

    for label, group in [
        (f"Reference rows (date < {REFERENCE_CUTOFF})", ref),
        (f"Newer rows (date >= {REFERENCE_CUTOFF})", newer),
    ]:
        print(f"--- {label}: {len(group)} player rows ---")
        counter: Counter[str] = Counter()
        unique_vals: set[str] = set()
        spare_patterns: Counter[str] = Counter()

        for _, row in group.iterrows():
            for frame_num in range(1, 11):
                b1_col = f"f{frame_num}_b1"
                b2_col = f"f{frame_num}_b2"
                b1 = str(row.get(b1_col, "") or "").strip()
                b2 = str(row.get(b2_col, "") or "").strip()
                for v in (b1, b2):
                    counter[categorize_value(v)] += 1
                    if v:
                        unique_vals.add(v)
                if b1 and b2:
                    if b2 == "/":
                        spare_patterns[f"({b1}, '/')"] += 1
                    elif b1.isdigit() and b2.isdigit():
                        a, b = int(b1), int(b2)
                        if 0 < a < 10 and b == 10:
                            spare_patterns[f"({a}, 10) frame-total spare"] += 1
                        elif a < 10 and a + b == 10:
                            spare_patterns[f"({a}, {b}) numeric spare"] += 1

        print(f"  Value type counts: {dict(counter)}")
        print(f"  Unique non-empty values: {sorted(unique_vals, key=lambda x: (not x.isdigit(), x))}")
        if spare_patterns:
            print("  Spare representations:")
            for pattern, count in spare_patterns.most_common():
                print(f"    {pattern}: {count}")
        print()

    print("Reference encoding: bowling notation (X, /) + integers 0-9 + empty")
    print("Newer encoding: integers 0-10 (10 = strike or frame-total spare marker) + empty")
    print()


def validate_rows(df: pd.DataFrame, label: str) -> tuple[int, int, list[str]]:
    passed = 0
    failed = 0
    failures: list[str] = []

    for idx, row in df.iterrows():
        row_dict = {k: "" if pd.isna(row.get(k)) else str(row.get(k, "")) for k in CSV_HEADER}
        for k in row.index:
            if k not in row_dict:
                row_dict[k] = "" if pd.isna(row[k]) else str(row[k])

        frames = row_to_frames(row_dict)
        computed = compute_bowling_score(frames)
        final = parse_final_score(row_dict)

        if computed is not None and final is not None and computed == final:
            passed += 1
        else:
            failed += 1
            nick = row_dict.get("nickname", "?")
            gid = row_dict.get("game_id", "?")
            failures.append(
                f"  row {idx + 2} ({gid}/{nick}): computed={computed}, final_score={final}"
            )

    print(f"=== {label} ===")
    print(f"  Pass: {passed}/{passed + failed}")
    print(f"  Fail: {failed}/{passed + failed}")
    if failures:
        print("  Failures:")
        for line in failures:
            print(line)
    print()
    return passed, failed, failures


def main() -> None:
    parser = argparse.ArgumentParser(description="Normalize bowling score CSV.")
    parser.add_argument("--input", "-i", type=Path, default=None, help="Input CSV path")
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        default=Path("data/scores.csv"),
        help="Output CSV path (default: data/scores.csv)",
    )
    args = parser.parse_args()

    input_path = find_input_csv(args.input)
    print(f"Loading: {input_path}\n")

    df = pd.read_csv(input_path, dtype=str, keep_default_na=False)

    audit_encodings(df)

    normalized_rows = []
    for _, row in df.iterrows():
        row_dict = {col: str(row.get(col, "") or "") for col in df.columns}
        normalized = normalize_row_frames(row_dict)
        normalized_rows.append(normalized)

    out_df = pd.DataFrame(normalized_rows)

    for col in CSV_HEADER:
        if col not in out_df.columns:
            out_df[col] = ""

    out_df = out_df[CSV_HEADER]
    out_df.to_csv(args.output, index=False)
    print(f"Wrote normalized CSV: {args.output} ({len(out_df)} rows)\n")

    out_df["_iso_date"] = out_df["date"].apply(parse_date)
    ref_df = out_df[out_df["_iso_date"] < REFERENCE_CUTOFF].drop(columns=["_iso_date"])
    newer_df = out_df[out_df["_iso_date"] >= REFERENCE_CUTOFF].drop(columns=["_iso_date"])

    _, ref_fail, ref_failures = validate_rows(ref_df, "Reference row self-test")
    if ref_fail:
        print("ERROR: Reference row validation failed — normalization logic needs fixing.")
        sys.exit(1)

    validate_rows(newer_df, "Newer row validation (expected failures for Part 2)")


if __name__ == "__main__":
    main()
