"""Alley nickname → real player name (mirrors js/nickname-map.js)."""

NICKNAME_TO_PLAYER: dict[str, str] = {
    "SHREKK": "Mattheus",
    "MATE": "Mattheus",
    "MA": "Mattheus",
    "MAP": "Mattheus",
    "MAE": "Mattheus",
    "MEH": "Mattheus",
    "MAFUS": "Shelley",
    "SHRIMP": "Shelley",
    "SHEL": "Shelley",
    "SHE": "Shelley",
    "WIMBY": "Shelley",
    "EMLIE": "Emily",
    "EH": "Emily",
}


def resolve_player_from_nickname(nickname: str) -> str | None:
    key = (nickname or "").strip().upper()
    return NICKNAME_TO_PLAYER.get(key)
