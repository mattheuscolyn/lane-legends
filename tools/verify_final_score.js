/** Assert computed score matches final_score for every row. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "js/nickname-map.js"), "utf8"), sandbox);
vm.runInContext(
  fs.readFileSync(path.join(root, "js/bowling-core.js"), "utf8") + "\nthis.BowlingCore = BowlingCore;",
  sandbox
);
const BC = sandbox.BowlingCore;

const rows = BC.parseCSVText(fs.readFileSync(path.join(root, "data/scores.csv"), "utf8"));
let bad = 0;

for (let i = 0; i < rows.length; i++) {
  const g = BC.parseGame(rows[i]);
  if (g.calculated_score != null && g.final_score != null && g.calculated_score !== g.final_score) {
    console.log(`Row ${i + 2}: computed=${g.calculated_score} final=${g.final_score}`);
    bad++;
  }
}

console.log(bad ? `FAIL: ${bad} mismatches` : `PASS: ${rows.length} rows self-consistent`);
process.exit(bad ? 1 : 0);
