#!/usr/bin/env python3
"""
Part 2: Interactive bowling score review/correction tool.

Usage:
    streamlit run review_tool.py
"""

from __future__ import annotations

import csv
import shutil
from datetime import datetime
from pathlib import Path

import pandas as pd
import streamlit as st

from bowling_utils import (
    CSV_HEADER,
    FRAME_COLS,
    frame_ball_columns,
    frame_display_notation,
    parse_final_score,
    validate_player_row,
)

CSV_PATH = Path("data/scores.csv")
BACKUP_DIR = Path("data/backups")
STATUS_ICON = {"red": "🔴", "yellow": "🟡", "green": "🟢"}


def load_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        st.error(f"File not found: {path}. Run normalize_data.py first.")
        st.stop()
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    for col in CSV_HEADER:
        if col not in df.columns:
            df[col] = ""
    return df[CSV_HEADER]


def save_csv(df: pd.DataFrame, path: Path) -> None:
    df.to_csv(path, index=False)


def backup_csv(path: Path) -> Path:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = BACKUP_DIR / f"{path.stem}_backup_{ts}{path.suffix}"
    shutil.copy2(path, backup)
    return backup


def row_dict_from_series(row: pd.Series) -> dict[str, str]:
    return {col: str(row.get(col, "") or "") for col in CSV_HEADER}


def game_status(game_rows: list[dict[str, str]]) -> str:
    statuses = [validate_player_row(r)["status"] for r in game_rows]
    if "red" in statuses:
        return "red"
    if "yellow" in statuses:
        return "yellow"
    return "green"


def game_label(game_id: str, rows: list[dict[str, str]]) -> str:
    meta = rows[0]
    nicks = ", ".join(r.get("nickname", "") or "?" for r in rows)
    icon = STATUS_ICON[game_status(rows)]
    return (
        f"{icon} {meta.get('date', '?')} lane {meta.get('lane', '?')} "
        f"G{meta.get('session_game', '?')} — {nicks}"
    )


def init_session_state(df: pd.DataFrame) -> None:
    if "df" not in st.session_state:
        st.session_state.df = df.copy()
    if "backup_done" not in st.session_state:
        st.session_state.backup_done = False
    if "selected_game_id" not in st.session_state:
        game_ids = st.session_state.df["game_id"].unique()
        st.session_state.selected_game_id = game_ids[0] if len(game_ids) else None
    if "save_message" not in st.session_state:
        st.session_state.save_message = ""


def get_games(df: pd.DataFrame) -> dict[str, list[dict[str, str]]]:
    games: dict[str, list[dict[str, str]]] = {}
    for _, row in df.iterrows():
        gid = row["game_id"]
        games.setdefault(gid, []).append(row_dict_from_series(row))
    return games


def update_row_in_df(game_id: str, row_idx_in_game: int, updates: dict[str, str]) -> None:
    df = st.session_state.df
    mask = df["game_id"] == game_id
    indices = df.index[mask].tolist()
    if row_idx_in_game >= len(indices):
        return
    idx = indices[row_idx_in_game]
    for key, val in updates.items():
        if key in CSV_HEADER:
            st.session_state.df.at[idx, key] = val


def render_ball_input(
    key: str,
    value: str,
    *,
    disabled: bool = False,
    highlight: bool = False,
) -> str:
    if highlight:
        st.markdown(
            "<div style='background:#ffcccc;height:4px;border-radius:2px;margin-bottom:2px'></div>",
            unsafe_allow_html=True,
        )
    raw = st.text_input(
        label=key,
        value="" if disabled else value,
        key=key,
        label_visibility="collapsed",
        disabled=disabled,
        max_chars=2,
    ).strip()
    if raw == "":
        return ""
    if raw.isdigit():
        n = int(raw)
        if 0 <= n <= 10:
            return str(n)
    return value


def render_player_scoreboard(
    player_row: dict[str, str],
    game_id: str,
    player_idx: int,
) -> None:
    validation = validate_player_row(player_row)
    bad_cells = validation["bad_cells"]

    nick_key = f"nick_{game_id}_{player_idx}"
    nickname = st.text_input(
        "Nickname",
        value=player_row.get("nickname", ""),
        key=nick_key,
    )
    if nickname != player_row.get("nickname", ""):
        update_row_in_df(game_id, player_idx, {"nickname": nickname})
        player_row = dict(player_row)
        player_row["nickname"] = nickname
        validation = validate_player_row(player_row)
        bad_cells = validation["bad_cells"]

    frames = validation["frames"]
    running = validation["running_totals"]
    computed = validation["computed"]
    final = parse_final_score(player_row)

    st.caption(
        f"Status: {STATUS_ICON[validation['status']]} "
        + ("; ".join(validation["issues"]) if validation["issues"] else "OK")
    )

    header_cols = st.columns(11)
    for i in range(10):
        header_cols[i].markdown(f"**F{i + 1}**")
    header_cols[10].markdown("**Tot.**")

    notation_cols = st.columns(11)
    for frame_num in range(1, 11):
        notation = frame_display_notation(frames[frame_num - 1], frame_num)
        notation_cols[frame_num - 1].markdown(
            f"<div style='text-align:center;font-family:monospace'>{notation or '&nbsp;'}</div>",
            unsafe_allow_html=True,
        )
    final_bad = "final_score" in bad_cells
    final_style = "color:red;font-weight:bold" if final_bad else ""
    notation_cols[10].markdown(
        f"<div style='text-align:center;{final_style}'>"
        f"{computed if computed is not None else '?'} / {final or '?'}"
        f"</div>",
        unsafe_allow_html=True,
    )

    input_cols = st.columns(11)
    updates: dict[str, str] = {}

    for frame_num in range(1, 10):
        cols = frame_ball_columns(frame_num)
        frame = frames[frame_num - 1]
        b1_val = player_row.get(cols[0], "")
        b2_val = player_row.get(cols[1], "")

        with input_cols[frame_num - 1]:
            b1_bad = cols[0] in bad_cells
            b2_bad = cols[1] in bad_cells
            new_b1 = render_ball_input(
                f"{game_id}_{player_idx}_f{frame_num}_b1",
                b1_val,
                highlight=b1_bad,
            )
            b2_disabled = new_b1 == "10"
            new_b2 = render_ball_input(
                f"{game_id}_{player_idx}_f{frame_num}_b2",
                "" if b2_disabled else b2_val,
                disabled=b2_disabled,
                highlight=b2_bad and not b2_disabled,
            )
            if new_b1 == "10":
                new_b2 = ""

            updates[cols[0]] = new_b1
            updates[cols[1]] = new_b2

    with input_cols[9]:
        cols = frame_ball_columns(10)
        b1_val = player_row.get(cols[0], "")
        b2_val = player_row.get(cols[1], "")
        b3_val = player_row.get(cols[2], "")

        new_b1 = render_ball_input(
            f"{game_id}_{player_idx}_f10_b1",
            b1_val,
            highlight=cols[0] in bad_cells,
        )
        new_b2 = render_ball_input(
            f"{game_id}_{player_idx}_f10_b2",
            b2_val,
            highlight=cols[1] in bad_cells,
        )
        new_b3 = render_ball_input(
            f"{game_id}_{player_idx}_f10_b3",
            b3_val,
            highlight=cols[2] in bad_cells,
        )
        updates[cols[0]] = new_b1
        updates[cols[1]] = new_b2
        updates[cols[2]] = new_b3

    changed = any(updates.get(c) != player_row.get(c, "") for c in updates)
    if changed:
        update_row_in_df(game_id, player_idx, updates)
        st.rerun()

    running_cols = st.columns(11)
    for frame_num in range(1, 11):
        rt = running[frame_num - 1]
        running_cols[frame_num - 1].markdown(
            f"<div style='text-align:center;font-size:0.85em;color:#555'>"
            f"{rt if rt is not None else ''}"
            f"</div>",
            unsafe_allow_html=True,
        )
    running_cols[10].markdown("")

    final_key = f"final_{game_id}_{player_idx}"
    new_final = st.text_input(
        "Final score (from scoreboard)",
        value=player_row.get("final_score", ""),
        key=final_key,
    )
    if new_final != player_row.get("final_score", ""):
        update_row_in_df(game_id, player_idx, {"final_score": new_final})
        st.rerun()


def main() -> None:
    st.set_page_config(page_title="Bowling Score Review", layout="wide")
    st.title("Bowling Score Review")

    df = load_csv(CSV_PATH)
    init_session_state(df)

    if st.session_state.save_message:
        st.success(st.session_state.save_message)

    games = get_games(st.session_state.df)

    with st.sidebar:
        st.header("Games")
        show_flagged_only = st.toggle("Show only flagged games", value=False)

        filtered_games = []
        for gid, rows in games.items():
            status = game_status(rows)
            if show_flagged_only and status == "green":
                continue
            filtered_games.append((gid, rows))

        if not filtered_games:
            st.warning("No games match the filter.")
            st.stop()

        labels = [game_label(gid, rows) for gid, rows in filtered_games]
        game_ids = [gid for gid, _ in filtered_games]

        current = st.session_state.selected_game_id
        if current not in game_ids:
            current = game_ids[0]
            st.session_state.selected_game_id = current

        selected_label = st.radio(
            "Select game",
            options=labels,
            index=game_ids.index(current),
            label_visibility="collapsed",
        )
        selected_idx = labels.index(selected_label)
        game_id = game_ids[selected_idx]
        st.session_state.selected_game_id = game_id

        st.divider()
        red = sum(1 for gid, rows in games.items() if game_status(rows) == "red")
        yellow = sum(1 for gid, rows in games.items() if game_status(rows) == "yellow")
        green = sum(1 for gid, rows in games.items() if game_status(rows) == "green")
        st.caption(f"🔴 {red}  🟡 {yellow}  🟢 {green} games")

    rows = games[game_id]
    meta = rows[0]

    st.subheader(f"Game: {game_id}")

    meta_cols = st.columns(4)
    meta_updates: dict[str, str] = {}
    with meta_cols[0]:
        new_date = st.text_input("Date", value=meta.get("date", ""), key=f"meta_date_{game_id}")
        meta_updates["date"] = new_date
    with meta_cols[1]:
        new_lane = st.text_input("Lane", value=meta.get("lane", ""), key=f"meta_lane_{game_id}")
        meta_updates["lane"] = new_lane
    with meta_cols[2]:
        new_sg = st.text_input(
            "Session game",
            value=meta.get("session_game", ""),
            key=f"meta_sg_{game_id}",
        )
        meta_updates["session_game"] = new_sg
    with meta_cols[3]:
        new_time = st.text_input(
            "Completed time",
            value=meta.get("completed_time", ""),
            key=f"meta_time_{game_id}",
        )
        meta_updates["completed_time"] = new_time

    meta_changed = any(meta_updates[k] != meta.get(k, "") for k in meta_updates)
    if meta_changed:
        df = st.session_state.df
        mask = df["game_id"] == game_id
        for key, val in meta_updates.items():
            st.session_state.df.loc[mask, key] = val
        st.rerun()

    for i, player_row in enumerate(rows):
        df = st.session_state.df
        mask = df["game_id"] == game_id
        indices = df.index[mask].tolist()
        if i < len(indices):
            player_row = row_dict_from_series(st.session_state.df.loc[indices[i]])

        st.divider()
        st.markdown(f"### Player: {player_row.get('nickname') or '(no nickname)'}")
        render_player_scoreboard(player_row, game_id, i)

    if st.button("Save changes", type="primary"):
        if not st.session_state.backup_done:
            backup = backup_csv(CSV_PATH)
            st.session_state.backup_done = True
            st.session_state.save_message = f"Saved. Backup: {backup.name}"
        else:
            st.session_state.save_message = "Saved."
        save_csv(st.session_state.df, CSV_PATH)
        st.rerun()


if __name__ == "__main__":
    main()
