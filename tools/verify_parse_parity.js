/**
 * Verify BowlingCore.parseGame matches pre-refactor semantics on all rows.
 * Uses git HEAD version of parse logic inlined for comparison.
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

// Legacy parseBallCell (no "10" as strike in r1 for buildFrame - old data.js)
function legacyParseBallCell(val) {
  if (val == null || String(val).trim() === "") return null;
  const v = String(val).trim().toUpperCase();
  if (v === "X") return "X";
  if (v === "/") return "/";
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

function legacyBuildFrame(frameIndex, raw1, raw2, raw3) {
  const balls = [];
  const r1 = legacyParseBallCell(raw1);
  const r2str = raw2 != null ? String(raw2).trim().toUpperCase() : "";
  const r2 = legacyParseBallCell(raw2);
  const r3 = legacyParseBallCell(raw3);
  if (frameIndex < 9) {
    if (r1 === "X") balls.push(10);
    else if (r2str === "/") {
      const first = typeof r1 === "number" ? r1 : 0;
      balls.push(first, 10 - first);
    } else {
      if (typeof r1 === "number") balls.push(r1);
      if (typeof r2 === "number") balls.push(r2);
    }
  } else {
    if (r1 === "X") {
      balls.push(10);
      if (r2str === "X") balls.push(10);
      else if (r2str === "/") balls.push(10);
      else if (typeof r2 === "number") balls.push(r2);
      if (r3 === "X") balls.push(10);
      else if (typeof r3 === "number") balls.push(r3);
    } else if (typeof r1 === "number") {
      balls.push(r1);
      if (r2str === "/") {
        balls.push(10 - r1);
        if (r3 === "X") balls.push(10);
        else if (typeof r3 === "number") balls.push(r3);
      } else if (typeof r2 === "number") balls.push(r2);
    }
  }
  return balls;
}

function legacyScore(row) {
  const frames = [];
  for (let f = 0; f < 10; f++) {
    const n = f + 1;
    frames.push({
      balls: legacyBuildFrame(f, row[`f${n}_b1`], row[`f${n}_b2`], f === 9 ? row.f10_b3 : undefined),
    });
  }
  return BC.calcBowlingScore(frames).total;
}

const csv = fs.readFileSync(path.join(root, "data/scores.csv"), "utf8");
const rows = BC.parseCSVText(csv);
let diffs = 0;

for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  const newGame = BC.parseGame(row);
  const legacyTotal = legacyScore(row);
  const newTotal = newGame.calculated_score;
  const final = newGame.final_score;
  if (legacyTotal !== newTotal || (final != null && legacyTotal !== final && newTotal === final)) {
    if (legacyTotal !== newTotal) {
      console.log(`Row ${i + 2}: legacy=${legacyTotal} new=${newTotal} final=${final} player=${row.player || row.nickname}`);
      diffs++;
    }
  }
}

console.log(`Compared ${rows.length} rows. Score calc diffs: ${diffs}`);
process.exit(diffs ? 1 : 0);
