/**
 * Dashboard metrics + E2E simulation — run: node tools/verify_dashboard.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");

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

const BC = loadBowlingCore();
const csv = fs.readFileSync(path.join(root, "data/scores.csv"), "utf8");
const rows = BC.parseCSVText(csv);
const parsed = rows.map(r => BC.parseGame(r)).filter(g => g.player);

function avg(arr) {
  const v = arr.filter(x => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function getGames(data) {
  const map = new Map();
  for (const g of data) {
    if (!map.has(g.game_id)) {
      map.set(g.game_id, {
        gameId: g.game_id,
        date: g.date,
        sortKey: g.sortKey,
        players: [],
      });
    }
    map.get(g.game_id).players.push(g);
  }
  return [...map.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

function getSessions(data) {
  const dates = [...new Set(data.map(g => g.date))];
  return dates.length;
}

function h2hWins(data, p1, p2) {
  let p1Wins = 0;
  let p2Wins = 0;
  for (const game of getGames(data)) {
    const r1 = game.players.find(p => p.player === p1);
    const r2 = game.players.find(p => p.player === p2);
    if (r1?.final_score != null && r2?.final_score != null) {
      if (r1.final_score > r2.final_score) p1Wins++;
      else if (r2.final_score > r1.final_score) p2Wins++;
    }
  }
  return { p1Wins, p2Wins };
}

console.log("=== Historical data ===");
console.log(`Rows: ${rows.length}`);
console.log(`Parsed games (players): ${parsed.length}`);
console.log(`Unique game_ids: ${new Set(parsed.map(g => g.game_id)).size}`);
console.log(`Sessions (dates): ${getSessions(parsed)}`);
console.log(`Players: ${[...new Set(parsed.map(g => g.player))].sort().join(", ")}`);

for (const name of ["Mattheus", "Emily", "Shelley"]) {
  const pg = parsed.filter(g => g.player === name);
  const scores = pg.map(g => g.final_score).filter(s => s != null);
  console.log(`  ${name}: n=${pg.length} avg=${avg(scores)?.toFixed(1)} high=${Math.max(...scores)} low=${Math.min(...scores)}`);
}

const h2h = h2hWins(parsed, "Mattheus", "Emily");
console.log(`H2H Mattheus vs Emily: ${h2h.p1Wins}-${h2h.p2Wins}`);

// E2E: simulate new game
console.log("\n=== E2E new game simulation ===");
const testGame = {
  game_id: "verify-test-game",
  date: "2099-12-31",
  lane: "99",
  session_game: "9",
  completed_time: "23:59",
  players: [
    { player: "Mattheus", nickname: "SHREKK", balls: (() => {
      const b = BC.emptyBalls();
      for (let f = 0; f < 9; f++) b[BC.frameSlot(f, 0)] = "X";
      b[BC.frameSlot(9, 0)] = "X";
      b[BC.frameSlot(9, 1)] = "X";
      b[BC.frameSlot(9, 2)] = "X";
      return b;
    })() },
  ],
};

const testRows = BC.flattenGames([testGame]);
const testParsed = BC.parseGame(testRows[0]);
console.log(`Test game score: ${testParsed.final_score} (expect 300)`);
console.log(`Test validation: ${BC.validateRow(testRows[0]).status}`);

const combined = [...rows, ...testRows.map(r => Object.fromEntries(BC.CSV_HEADER.map(c => [c, r[c] ?? ""])) )];
const combinedParsed = combined.map(r => BC.parseGame(r));
const testInCombined = combinedParsed.filter(g => g.game_id === "verify-test-game");
console.log(`Test game in combined dataset: ${testInCombined.length} row(s), score=${testInCombined[0]?.final_score}`);

const ok = testParsed.final_score === 300 && testInCombined[0]?.final_score === 300;
console.log(ok ? "\nE2E PASS" : "\nE2E FAIL");
process.exit(ok ? 0 : 1);
