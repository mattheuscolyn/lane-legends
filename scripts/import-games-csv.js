const fs = require("fs");
const path = require("path");
const { resolvePlayerFromNickname } = require("./nickname-map");

function parseLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

const srcPath = path.join(__dirname, "../bowling-games-2026-06-12.csv");
const src = fs.readFileSync(srcPath, "utf8").trim().split(/\r?\n/);
const headers = parseLine(src[0]);
const hasPlayer = headers.includes("player");

const frameHeaders = headers.filter((h) => h.startsWith("f") || h === "final_score");
const outHeaders = [
  "game_id",
  "date",
  "lane",
  "session_game",
  "completed_time",
  "player",
  "nickname",
  ...frameHeaders,
];

const rows = [outHeaders.join(",")];

for (const line of src.slice(1)) {
  const cells = parseLine(line);
  const row = Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  const nickname = (row.nickname || row.player || "").trim();
  const player =
    hasPlayer && row.player?.trim()
      ? row.player.trim()
      : resolvePlayerFromNickname(nickname) || nickname;
  const base = [
    row.game_id,
    row.date,
    row.lane,
    row.session_game,
    row.completed_time,
    player,
    nickname,
  ];
  for (const h of frameHeaders) base.push(row[h] ?? "");
  rows.push(base.join(","));
}

const dest = path.join(__dirname, "../data/scores.csv");
fs.writeFileSync(dest, rows.join("\n") + "\n");
console.log("Wrote", rows.length - 1, "rows to", dest);

const parsed = rows.slice(1).map((l) => {
  const c = parseLine(l);
  return { player: c[5], nickname: c[6] };
});
console.log("Players:", [...new Set(parsed.map((r) => r.player))].sort());
console.log("Unique nicknames:", [...new Set(parsed.map((r) => r.nickname))].length);
