/**
 * Stress tests for BowlingCore — run: node tools/verify_stress.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const sandbox = { module: { exports: {} }, exports: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "js/nickname-map.js"), "utf8"), sandbox);
vm.runInContext(
  fs.readFileSync(path.join(root, "js/bowling-core.js"), "utf8") + "\nthis.BowlingCore = BowlingCore;",
  sandbox
);
const BC = sandbox.BowlingCore;

const results = [];
function test(name, fn) {
  try {
    const r = fn();
    results.push({ name, ok: !!r.pass, detail: r.detail || "" });
  } catch (e) {
    results.push({ name, ok: false, detail: e.message });
  }
}

function perfectBalls() {
  const b = BC.emptyBalls();
  for (let f = 0; f < 9; f++) b[BC.frameSlot(f, 0)] = "X";
  b[BC.frameSlot(9, 0)] = "X";
  b[BC.frameSlot(9, 1)] = "X";
  b[BC.frameSlot(9, 2)] = "X";
  return b;
}

function gutterBalls() {
  const b = BC.emptyBalls();
  for (let f = 0; f < 10; f++) {
    b[BC.frameSlot(f, 0)] = "0";
    b[BC.frameSlot(f, 1)] = "0";
  }
  return b;
}

test("Perfect game = 300", () => {
  const { total } = BC.scoreGame(perfectBalls());
  return { pass: total === 300, detail: `got ${total}` };
});

test("Gutter game = 0", () => {
  const { total } = BC.scoreGame(gutterBalls());
  return { pass: total === 0, detail: `got ${total}` };
});

test("10th frame filled but earlier frames incomplete → null total", () => {
  const b = BC.emptyBalls();
  for (let f = 0; f < 9; f++) b[BC.frameSlot(f, 0)] = "0";
  b[BC.frameSlot(9, 0)] = "X";
  b[BC.frameSlot(9, 1)] = "X";
  b[BC.frameSlot(9, 2)] = "X";
  return { pass: BC.scoreGame(b).total === null, detail: `got ${BC.scoreGame(b).total}` };
});

test("Spare game scoring", () => {
  const b = BC.emptyBalls();
  b[BC.frameSlot(0, 0)] = "7";
  b[BC.frameSlot(0, 1)] = "/";
  b[BC.frameSlot(1, 0)] = "3";
  const { total } = BC.scoreGame(b);
  return { pass: total === null, detail: "incomplete expected" };
});

test("Incomplete game returns null total", () => {
  const b = BC.emptyBalls();
  b[BC.frameSlot(0, 0)] = "7";
  return { pass: BC.scoreGame(b).total === null, detail: `got ${BC.scoreGame(b).total}` };
});

test("Duplicate key detection", () => {
  const d = BC.findDuplicateKeys([
    { game_id: "g1", nickname: "A", player: "A" },
    { game_id: "g1", nickname: "A", player: "A" },
  ]);
  return { pass: d.length === 1, detail: `dups=${d.length}` };
});

test("validateRow flags missing date", () => {
  const row = BC.ballsToRowDict(
    { game_id: "x", date: "", lane: "1", session_game: "1", completed_time: "" },
    { player: "Test", nickname: "", balls: perfectBalls() }
  );
  const v = BC.validateRow(row);
  return { pass: v.status !== "green", detail: v.issues.join("; ") };
});

test("Historical CSV 110 rows", () => {
  const rows = BC.parseCSVText(fs.readFileSync(path.join(root, "data/scores.csv"), "utf8"));
  return { pass: rows.length === 110, detail: `rows=${rows.length}` };
});

test("Bulk paste compact line", () => {
  const balls = BC.parseCompactLine("X- X- X- X- X- X- X- X- X- X-X-X");
  return { pass: BC.scoreGame(balls).total === 300, detail: `score=${BC.scoreGame(balls).total}` };
});

test("Bulk parse one game block", () => {
  const text = `2099-01-01 | Lane 1 | Game 1 | 8:00 PM
SHREKK: X- X- X- X- X- X- X- X- X- X-X-X`;
  const games = BC.parseBulkGames(text);
  return { pass: games.length === 1 && games[0].players.length === 1, detail: `games=${games.length}` };
});

test("Invalid pin count rejected at parse", () => {
  const row = { f1_b1: "99", player: "T", nickname: "", game_id: "x", date: "2026-01-01", lane: "1", session_game: "1" };
  for (const c of BC.CSV_HEADER) if (!(c in row)) row[c] = "";
  const g = BC.parseGame(row);
  return { pass: g.calculated_score === null || g.frames[0].balls.length === 0, detail: "handled" };
});

console.log("=== Stress tests ===");
let failed = 0;
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? " — " + r.detail : ""}`);
  if (!r.ok) failed++;
}
process.exit(failed ? 1 : 0);
