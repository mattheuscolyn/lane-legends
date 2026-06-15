/**
 * Golden scoring tests — JS canonical implementation.
 * Run: node tests/test_js_scoring.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const goldenPath = path.join(__dirname, "golden_games.json");

function loadBowlingCore() {
  const sandbox = { module: { exports: {} }, exports: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, "js/nickname-map.js"), "utf8"), sandbox);
  vm.runInContext(
    fs.readFileSync(path.join(root, "js/bowling-core.js"), "utf8") + "\nthis.BowlingCore = BowlingCore;",
    sandbox
  );
  return sandbox.BowlingCore;
}

function rowFromScenario(BC, scenario) {
  const row = {};
  for (const col of BC.CSV_HEADER) row[col] = "";
  Object.assign(row, scenario.cells);
  return row;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function assertFrameTotals(actual, expected, scenarioId) {
  if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== 10 || expected.length !== 10) {
    throw new Error(`${scenarioId}: frame totals must be length-10 arrays`);
  }
  for (let i = 0; i < 10; i++) {
    if (actual[i] !== expected[i]) {
      throw new Error(
        `${scenarioId} frame ${i + 1}: expected total ${expected[i]}, got ${actual[i]}`
      );
    }
  }
}

function main() {
  const BC = loadBowlingCore();
  const golden = JSON.parse(fs.readFileSync(goldenPath, "utf8"));
  let passed = 0;

  for (const scenario of golden.scenarios) {
    const row = rowFromScenario(BC, scenario);
    const game = BC.parseGame(row);
    const frameTotals = game.frames.map((f) => f.frameScore);

    assertEqual(game.calculated_score, scenario.expected_final_score, `${scenario.id} final score`);
    assertFrameTotals(frameTotals, scenario.expected_frame_totals, scenario.id);

    if (scenario.expect_incomplete) {
      if (game.calculated_score != null) {
        throw new Error(`${scenario.id}: expected incomplete (null score)`);
      }
    }

    passed++;
  }

  console.log(`OK: ${passed}/${golden.scenarios.length} golden scenarios passed (JS)`);
}

try {
  main();
} catch (err) {
  console.error("FAIL:", err.message);
  process.exit(1);
}
