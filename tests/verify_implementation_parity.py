#!/usr/bin/env python3
"""Ensure JS and Python scoring agree on every golden scenario (cross-parity)."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
sys.path.insert(0, str(ROOT / "tests"))

from test_python_scoring import score_scenario  # noqa: E402

GOLDEN_PATH = Path(__file__).resolve().parent / "golden_games.json"

JS_SNIPPET = """
const fs = require('fs');
const vm = require('vm');
const root = process.argv[1];
const scenario = JSON.parse(process.argv[2]);
const sandbox = { module: { exports: {} }, exports: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(root + '/js/nickname-map.js', 'utf8'), sandbox);
vm.runInContext(
  fs.readFileSync(root + '/js/bowling-core.js', 'utf8') + '\\nthis.BowlingCore = BowlingCore;',
  sandbox
);
const BC = sandbox.BowlingCore;
const row = {};
BC.CSV_HEADER.forEach(c => row[c] = '');
Object.assign(row, scenario.cells);
const game = BC.parseGame(row);
console.log(JSON.stringify({
  final: game.calculated_score,
  frames: game.frames.map(f => f.frameScore)
}));
"""


def js_score(scenario: dict) -> tuple[int | None, list]:
    proc = subprocess.run(
        ["node", "-e", JS_SNIPPET, str(ROOT), json.dumps(scenario)],
        capture_output=True,
        text=True,
        check=True,
    )
    data = json.loads(proc.stdout.strip())
    return data["final"], data["frames"]


def main() -> None:
    golden = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))

    for scenario in golden["scenarios"]:
        sid = scenario["id"]
        py_final, py_frames = score_scenario(scenario)
        js_final, js_frames = js_score(scenario)

        if py_final != js_final:
            raise SystemExit(
                f"{sid}: JS final {js_final} != Python final {py_final}"
            )
        if py_frames != js_frames:
            for i, (a, b) in enumerate(zip(py_frames, js_frames, strict=True)):
                if a != b:
                    raise SystemExit(
                        f"{sid} frame {i + 1}: JS {b} != Python {a}"
                    )

    print(f"OK: JS and Python agree on {len(golden['scenarios'])} golden scenarios")


if __name__ == "__main__":
    main()
