const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const sandbox = { module: { exports: {} }, exports: {} };
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.join(root, "js/bowling-core.js"), "utf8") + "\nthis.BowlingCore = BowlingCore;",
  sandbox
);
const { parseCSVLine } = sandbox.BowlingCore;

const src = fs.readFileSync(
  path.join(__dirname, "../data/exports/bowling-games-2026-06-12.csv"),
  "utf8"
);
const lines = src.trim().split(/\r?\n/);

const headers = parseCSVLine(lines[0]);
const rows = lines.slice(1).map((l) =>
  Object.fromEntries(parseCSVLine(l).map((v, i) => [headers[i], v]))
);

const mapping = [
  {
    id: "demo-1",
    date: "2026-01-10",
    lane: 12,
    sg: 1,
    time: "18:30",
    srcIdx: [0, 1, 2],
    names: ["ALEX", "JORDAN", "SAM"],
  },
  {
    id: "demo-2",
    date: "2026-01-10",
    lane: 12,
    sg: 2,
    time: "19:15",
    srcIdx: [3, 4, 5],
    names: ["ALEX", "JORDAN", "SAM"],
  },
  {
    id: "demo-3",
    date: "2026-01-24",
    lane: 7,
    sg: 1,
    time: "20:00",
    srcIdx: [22, 23, 24],
    names: ["ALEX", "JORDAN", "SAM"],
  },
  {
    id: "demo-4",
    date: "2026-01-24",
    lane: 7,
    sg: 2,
    time: "20:45",
    srcIdx: [25, 26, 27],
    names: ["ALEX", "JORDAN", "SAM"],
  },
];

const out = [lines[0]];
for (const m of mapping) {
  m.srcIdx.forEach((si, pi) => {
    const s = rows[si];
    const cols = [
      m.id,
      m.date,
      String(m.lane),
      String(m.sg),
      m.time,
      m.names[pi],
    ];
    for (const h of headers.slice(6)) cols.push(s[h] ?? "");
    out.push(cols.join(","));
  });
}

const dest = path.join(__dirname, "../data/sample_data.csv");
fs.writeFileSync(dest, out.join("\n") + "\n");
console.log("Wrote", out.length - 1, "rows to", dest);
