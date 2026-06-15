/**
 * Lane Legends — canonical bowling scoring, CSV schema, and validation.
 * Used by dashboard (data.js, utils.js) and admin (admin/admin.js).
 */
const BowlingCore = (() => {
  const CSV_HEADER = [
    'game_id', 'date', 'lane', 'session_game', 'completed_time', 'player', 'nickname',
    'f1_b1', 'f1_b2', 'f2_b1', 'f2_b2', 'f3_b1', 'f3_b2', 'f4_b1', 'f4_b2',
    'f5_b1', 'f5_b2', 'f6_b1', 'f6_b2', 'f7_b1', 'f7_b2', 'f8_b1', 'f8_b2',
    'f9_b1', 'f9_b2', 'f10_b1', 'f10_b2', 'f10_b3', 'final_score',
  ];

  const FRAME_COLS = CSV_HEADER.filter(h => /^f\d+_b\d+$/.test(h));

  function generateGameId() {
    const t = Date.now().toString(36);
    const r = Math.random().toString(36).slice(2, 7);
    return `${t}${r}`.slice(0, 13);
  }

  function normalizePlayerRow(row) {
    const rawPlayer = row.player != null ? String(row.player).trim() : '';
    const rawNickname = row.nickname != null ? String(row.nickname).trim() : '';

    if (rawPlayer && rawNickname) return { player: rawPlayer, nickname: rawNickname };
    if (rawPlayer && !rawNickname) return { player: rawPlayer, nickname: '' };
    if (rawNickname && !rawPlayer) {
      return {
        player: (typeof resolvePlayerFromNickname === 'function'
          ? resolvePlayerFromNickname(rawNickname)
          : null) || rawNickname,
        nickname: rawNickname,
      };
    }
    return { player: '', nickname: '' };
  }

  function parseBallCell(val) {
    if (val == null || String(val).trim() === '') return null;
    const v = String(val).trim().toUpperCase();
    if (v === 'X' || v === '10') return 10;
    if (v === '/') return '/';
    if (v === '-') return 0;
    const n = parseInt(v, 10);
    return isNaN(n) ? null : n;
  }

  function buildFrame(frameIndex, raw1, raw2, raw3) {
    const balls = [];
    let isStrike = false;
    let isSpare = false;

    const r1 = parseBallCell(raw1);
    const r2str = raw2 != null ? String(raw2).trim().toUpperCase() : '';
    const r2 = parseBallCell(raw2);
    const r3 = parseBallCell(raw3);

    if (frameIndex < 9) {
      if (r1 === 10) {
        balls.push(10);
        isStrike = true;
      } else if (r2str === '/' || r2 === '/') {
        const first = typeof r1 === 'number' ? r1 : 0;
        balls.push(first);
        balls.push(10 - first);
        isSpare = true;
      } else {
        if (typeof r1 === 'number') balls.push(r1);
        if (typeof r2 === 'number') balls.push(r2);
      }
    } else {
      if (r1 === 10) {
        balls.push(10);
        isStrike = true;
        if (r2str === 'X' || r2 === 10) balls.push(10);
        else if (r2str === '/' || r2 === '/') balls.push(10);
        else if (typeof r2 === 'number') balls.push(r2);
        if (r3 === 10) balls.push(10);
        else if (typeof r3 === 'number') balls.push(r3);
      } else if (typeof r1 === 'number') {
        balls.push(r1);
        if (r2str === '/' || r2 === '/') {
          balls.push(10 - r1);
          isSpare = true;
          if (r3 === 10) balls.push(10);
          else if (typeof r3 === 'number') balls.push(r3);
        } else if (typeof r2 === 'number') {
          if (r1 + r2 === 10) {
            balls.push(r2);
            isSpare = true;
            if (r3 === 10) balls.push(10);
            else if (typeof r3 === 'number') balls.push(r3);
          } else {
            balls.push(r2);
          }
        }
      }
    }

    return { balls, isStrike, isSpare, frameScore: null };
  }

  function framesToRolls(frames) {
    const rolls = [];
    for (const frame of frames) {
      for (const ball of frame.balls) {
        if (ball != null) rolls.push(ball);
      }
    }
    return rolls;
  }

  function calcBowlingScore(frames) {
    const rolls = framesToRolls(frames);
    if (!rolls.length) return { total: null, frameTotals: Array(10).fill(null) };

    const frameTotals = [];
    let total = 0;
    let idx = 0;

    for (let f = 0; f < 10; f++) {
      if (idx >= rolls.length) {
        frameTotals.push(null);
        continue;
      }

      let frameScore;
      if (f === 9) {
        frameScore = 0;
        while (idx < rolls.length) frameScore += rolls[idx++];
      } else if (rolls[idx] === 10) {
        frameScore = 10 + (rolls[idx + 1] ?? 0) + (rolls[idx + 2] ?? 0);
        idx += 1;
      } else if (idx + 1 < rolls.length && rolls[idx] + rolls[idx + 1] === 10) {
        frameScore = 10 + (rolls[idx + 2] ?? 0);
        idx += 2;
      } else {
        frameScore = (rolls[idx] ?? 0) + (rolls[idx + 1] ?? 0);
        idx += 2;
      }
      total += frameScore;
      frameTotals.push(total);
    }

    const complete = frameTotals.every(t => t != null);
    return { total: complete ? total : null, frameTotals };
  }

  function framePinTotal(frame) {
    return frame.balls.reduce((sum, b) => sum + (b ?? 0), 0);
  }

  function parseGame(row) {
    const frames = [];
    for (let f = 0; f < 10; f++) {
      const n = f + 1;
      frames.push(buildFrame(f, row[`f${n}_b1`], row[`f${n}_b2`], f === 9 ? row.f10_b3 : undefined));
    }

    const { total, frameTotals } = calcBowlingScore(frames);
    frames.forEach((frame, i) => { frame.frameScore = frameTotals[i]; });

    const csvScore = row.final_score !== '' && row.final_score != null
      ? parseInt(row.final_score, 10) : null;
    const { player, nickname } = normalizePlayerRow(row);

    return {
      game_id: row.game_id || '',
      date: row.date || '',
      lane: row.lane !== '' && row.lane != null ? parseInt(row.lane, 10) : null,
      session_game: row.session_game !== '' && row.session_game != null
        ? parseInt(row.session_game, 10) : null,
      completed_time: row.completed_time || null,
      player,
      nickname,
      displayName: nickname || player,
      final_score: !isNaN(csvScore) && csvScore != null ? csvScore : total,
      frames,
      calculated_score: total,
      sortKey: `${row.date}|${String(row.session_game || 999).padStart(3, '0')}|${row.completed_time || '99:99'}`,
    };
  }

  /* ── Ball-slot entry model (scoreboard grid) ── */

  function emptyBalls() {
    return Array(21).fill('');
  }

  function frameSlot(frame, ballInFrame) {
    if (frame < 9) return frame * 2 + ballInFrame;
    return 18 + ballInFrame;
  }

  function parseBall(val) {
    if (!val || val === '') return null;
    const v = String(val).trim().toUpperCase();
    if (v === 'X') return 10;
    if (v === '/') return 'spare';
    const n = parseInt(v, 10);
    if (isNaN(n) || n < 0 || n > 10) return null;
    return n;
  }

  function rollsFromBalls(balls) {
    const rolls = [];
    let fi = 0;
    while (fi < 10) {
      const s0 = balls[frameSlot(fi, 0)] || '';
      const s1 = balls[frameSlot(fi, 1)] || '';
      const s2 = fi === 9 ? (balls[frameSlot(fi, 2)] || '') : '';

      if (fi < 9) {
        if (s0.toUpperCase() === 'X') { rolls.push(10); fi++; continue; }
        if (!s0 && !s1) break;
        const p1 = parseBall(s0);
        if (p1 === null && s0) break;
        if (s1.toUpperCase() === '/') {
          rolls.push(p1 ?? 0);
          rolls.push(10 - (p1 ?? 0));
          fi++;
          continue;
        }
        const p2 = parseBall(s1);
        if (p1 !== null) rolls.push(p1);
        if (p2 !== null) rolls.push(p2);
        fi++;
      } else {
        if (!s0 && !s1 && !s2) break;
        if (s0.toUpperCase() === 'X') {
          rolls.push(10);
          if (s1.toUpperCase() === 'X') {
            rolls.push(10);
            const p3 = parseBall(s2);
            if (p3 !== null) rolls.push(p3);
          } else {
            const p2 = parseBall(s1);
            if (p2 !== null) rolls.push(p2);
            const p3 = parseBall(s2);
            if (p3 !== null) rolls.push(p3);
          }
        } else {
          const p1 = parseBall(s0);
          if (p1 !== null) rolls.push(p1);
          if (s1 === '/') {
            rolls.push(10 - (p1 ?? 0));
            const p3 = parseBall(s2);
            if (p3 !== null) rolls.push(p3);
          } else {
            const p2 = parseBall(s1);
            if (p2 !== null) rolls.push(p2);
          }
        }
        fi++;
      }
    }
    return rolls;
  }

  function isFrame10Complete(balls) {
    const s0 = balls[frameSlot(9, 0)] || '';
    const s1 = balls[frameSlot(9, 1)] || '';
    const s2 = balls[frameSlot(9, 2)] || '';
    if (!s0) return false;
    if (s0.toUpperCase() === 'X') return Boolean(s1) && Boolean(s2);
    if (!s1) return false;
    if (s1 === '/') return Boolean(s2);
    return true;
  }

  function isFrameComplete(balls, frame) {
    if (frame < 9) {
      const s0 = balls[frameSlot(frame, 0)] || '';
      if (!s0) return false;
      if (s0.toUpperCase() === 'X') return true;
      const s1 = balls[frameSlot(frame, 1)];
      return s1 !== '' && s1 != null;
    }
    return isFrame10Complete(balls);
  }

  function scoreGame(balls) {
    const rolls = rollsFromBalls(balls);
    if (!rolls.length) return { total: null, frameTotals: Array(10).fill(null) };

    const frameTotals = [];
    let total = 0;
    let idx = 0;

    for (let f = 0; f < 10; f++) {
      if (idx >= rolls.length) { frameTotals.push(null); continue; }
      let frameScore;
      if (f === 9) {
        frameScore = 0;
        while (idx < rolls.length) frameScore += rolls[idx++];
      } else if (rolls[idx] === 10) {
        frameScore = 10 + (rolls[idx + 1] ?? 0) + (rolls[idx + 2] ?? 0);
        idx += 1;
      } else if (idx + 1 < rolls.length && rolls[idx] + rolls[idx + 1] === 10) {
        frameScore = 10 + (rolls[idx + 2] ?? 0);
        idx += 2;
      } else {
        frameScore = (rolls[idx] ?? 0) + (rolls[idx + 1] ?? 0);
        idx += 2;
      }
      total += frameScore;
      frameTotals.push(isFrameComplete(balls, f) ? total : null);
    }

    for (let f = 0; f < 10; f++) {
      if (!isFrameComplete(balls, f)) return { total: null, frameTotals, rolls };
    }
    return { total, frameTotals, rolls };
  }

  function ballsToRowDict(gameMeta, player) {
    const { total } = scoreGame(player.balls || emptyBalls());
    const row = {};
    for (const col of CSV_HEADER) row[col] = '';
    row.game_id = gameMeta.game_id;
    row.date = gameMeta.date || '';
    row.lane = gameMeta.lane != null && gameMeta.lane !== '' ? String(gameMeta.lane) : '';
    row.session_game = gameMeta.session_game != null && gameMeta.session_game !== ''
      ? String(gameMeta.session_game) : '';
    row.completed_time = gameMeta.completed_time || '';
    row.player = player.player || '';
    row.nickname = player.nickname || '';
    row.final_score = total != null ? String(total) : '';

    const balls = player.balls || emptyBalls();
    for (let f = 0; f < 10; f++) {
      row[`f${f + 1}_b1`] = balls[frameSlot(f, 0)] ?? '';
      row[`f${f + 1}_b2`] = balls[frameSlot(f, 1)] ?? '';
      if (f === 9) row.f10_b3 = balls[frameSlot(f, 2)] ?? '';
    }
    return row;
  }

  function rowDictToPlayer(row) {
    const balls = emptyBalls();
    for (let f = 0; f < 10; f++) {
      balls[frameSlot(f, 0)] = row[`f${f + 1}_b1`] || '';
      balls[frameSlot(f, 1)] = row[`f${f + 1}_b2`] || '';
      if (f === 9) balls[frameSlot(f, 2)] = row.f10_b3 || '';
    }
    const { player, nickname } = normalizePlayerRow(row);
    return { player, nickname, balls };
  }

  function groupRowsByGame(rows) {
    const map = new Map();
    for (const row of rows) {
      const gid = row.game_id || '(no id)';
      if (!map.has(gid)) {
        map.set(gid, {
          game_id: row.game_id,
          date: row.date,
          lane: row.lane,
          session_game: row.session_game,
          completed_time: row.completed_time,
          players: [],
        });
      }
      map.get(gid).players.push(rowDictToPlayer(row));
    }
    return [...map.values()];
  }

  function flattenGames(games) {
    const rows = [];
    for (const g of games) {
      const meta = {
        game_id: g.game_id,
        date: g.date,
        lane: g.lane,
        session_game: g.session_game,
        completed_time: g.completed_time,
      };
      for (const p of g.players) {
        rows.push(ballsToRowDict(meta, p));
      }
    }
    return rows;
  }

  /* ── Validation ── */

  function validateRow(row) {
    const issues = [];
    const badCells = new Set();

    for (const field of ['date', 'lane', 'session_game']) {
      if (!String(row[field] ?? '').trim()) {
        issues.push(`Missing ${field}`);
        badCells.add(field);
      }
    }
    if (!String(row.player ?? '').trim() && !String(row.nickname ?? '').trim()) {
      issues.push('Missing player or nickname');
      badCells.add('player');
    }

    const game = parseGame(row);
    const computed = game.calculated_score;
    const final = game.final_score;

    if (computed == null) {
      issues.push('Incomplete frames');
    } else if (final != null && computed !== final) {
      issues.push(`Score mismatch: computed ${computed} vs final ${final}`);
      badCells.add('final_score');
    }

    let status = 'green';
    if (issues.some(i => i.includes('mismatch') || i.includes('Incomplete'))) status = 'red';
    else if (issues.length) status = 'yellow';

    return { status, issues, badCells, computed, game };
  }

  function findDuplicateKeys(rows) {
    const seen = new Map();
    const dups = [];
    rows.forEach((row, i) => {
      const key = `${row.game_id}|${(row.nickname || row.player || '').toUpperCase()}`;
      if (seen.has(key)) dups.push({ row: i + 2, key, first: seen.get(key) + 2 });
      else seen.set(key, i);
    });
    return dups;
  }

  /* ── Compact / bulk paste (scoreboard notation) ── */

  function parseTimeSegment(text) {
    const t = text.trim();
    const m24 = t.match(/^(\d{1,2}):(\d{2})$/);
    if (m24) {
      const h = parseInt(m24[1], 10);
      if (h >= 0 && h <= 23) return `${String(h).padStart(2, '0')}:${m24[2]}`;
    }
    const m12 = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (m12) {
      let h = parseInt(m12[1], 10);
      const pm = m12[3].toUpperCase() === 'PM';
      if (h === 12) h = pm ? 12 : 0;
      else if (pm) h += 12;
      return `${String(h).padStart(2, '0')}:${m12[2]}`;
    }
    return null;
  }

  function parseBulkHeaderLine(line) {
    let date = new Date().toISOString().slice(0, 10);
    let lane = null;
    let sessionGame = null;
    let completedTime = null;
    const parts = line.split('|').map(p => p.trim()).filter(Boolean);
    for (const part of parts) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(part)) date = part;
      else if (/^lane\s*\d+/i.test(part)) lane = parseInt(part.match(/\d+/)[0], 10);
      else if (/^(?:game|g)\s*#?\s*(\d+)$/i.test(part) || /^#\s*(\d+)$/.test(part)) {
        sessionGame = parseInt(part.match(/(\d+)/)[0], 10);
      } else if (/^\d+$/.test(part) && lane == null && !/^\d{4}-\d{2}-\d{2}$/.test(part)) {
        lane = parseInt(part, 10);
      } else {
        const parsed = parseTimeSegment(part);
        if (parsed) completedTime = parsed;
      }
    }
    return { date, lane, sessionGame, completedTime };
  }

  function parseCompactLine(line) {
    const balls = emptyBalls();
    const frames = line.trim().split(/\s+/).filter(Boolean);
    let fi = 0;

    for (const raw of frames) {
      if (fi >= 10) break;
      const fr = raw.toUpperCase();

      if (fi < 9) {
        if (fr === 'X' || fr === 'X-') {
          balls[frameSlot(fi, 0)] = 'X';
          fi++;
          continue;
        }
        if (fr.includes('/')) {
          if (fr === '/' || fr === '-/') {
            balls[frameSlot(fi, 0)] = '0';
            balls[frameSlot(fi, 1)] = '/';
          } else {
            const pins = fr.match(/^(\d)/)?.[1] ?? '0';
            balls[frameSlot(fi, 0)] = pins;
            balls[frameSlot(fi, 1)] = '/';
          }
          fi++;
          continue;
        }
        const parts = raw.split('-');
        balls[frameSlot(fi, 0)] = parts[0] ?? '';
        balls[frameSlot(fi, 1)] = parts.length > 1 ? parts.slice(1).join('-') || '0' : '0';
        fi++;
      } else {
        if (fr.replace(/-/g, '') === 'XXX' || fr === 'X-X-X') {
          balls[frameSlot(9, 0)] = 'X';
          balls[frameSlot(9, 1)] = 'X';
          balls[frameSlot(9, 2)] = 'X';
          fi++;
          continue;
        }
        const tokens = raw.split('-');
        let bi = 0;
        for (let ti = 0; ti < tokens.length && bi < 3; ti++) {
          const t = tokens[ti];
          if (!t && ti === tokens.length - 1 && tokens.length > 1) {
            balls[frameSlot(9, bi++)] = '0';
            break;
          }
          if (!t) continue;
          if (t.toUpperCase() === 'X') balls[frameSlot(9, bi++)] = 'X';
          else if (t === '/') balls[frameSlot(9, bi++)] = '/';
          else balls[frameSlot(9, bi++)] = t;
        }
        fi++;
      }
    }
    return balls;
  }

  /** Parse bulk text blocks into game objects for admin import. */
  function parseBulkGames(text) {
    const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    const games = [];

    for (const block of blocks) {
      const lines = block.split(/\n/).map(l => l.trim()).filter(Boolean);
      if (!lines.length) continue;

      let date = new Date().toISOString().slice(0, 10);
      let lane = '';
      let sessionGame = '';
      let completedTime = '';
      let startIdx = 0;

      if (lines[0].includes('|') || /^\d{4}-\d{2}-\d{2}/.test(lines[0]) || /lane\s*\d/i.test(lines[0])) {
        const header = parseBulkHeaderLine(lines[0]);
        date = header.date;
        lane = header.lane != null ? String(header.lane) : '';
        sessionGame = header.sessionGame != null ? String(header.sessionGame) : '';
        completedTime = header.completedTime || '';
        startIdx = 1;
      }

      const players = [];
      for (let i = startIdx; i < lines.length; i++) {
        const m = lines[i].match(/^([^:]+):\s*(.+)$/);
        if (!m) continue;
        const nick = m[1].trim();
        const { player, nickname } = normalizePlayerRow({ nickname: nick, player: '' });
        players.push({
          player: player || nick,
          nickname: nickname || nick,
          balls: parseCompactLine(m[2].trim()),
        });
      }

      if (players.length) {
        games.push({
          game_id: generateGameId(),
          date,
          lane,
          session_game: sessionGame,
          completed_time: completedTime,
          players,
        });
      }
    }
    return games;
  }

  /* ── CSV I/O ── */

  function parseCSVLine(line) {
    const out = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') inQ = false;
        else cur += c;
      } else if (c === '"') inQ = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out;
  }

  function parseCSVText(text) {
    if (typeof Papa !== 'undefined') {
      const result = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: h => h.trim() });
      return result.data.filter(row => {
        const { player, nickname } = normalizePlayerRow(row);
        return player || nickname;
      });
    }
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const headers = parseCSVLine(lines[0]);
    return lines.slice(1).map(line => {
      const cells = parseCSVLine(line);
      const row = {};
      headers.forEach((h, i) => { row[h.trim()] = cells[i] ?? ''; });
      return row;
    }).filter(row => {
      const { player, nickname } = normalizePlayerRow(row);
      return player || nickname;
    });
  }

  function rowsToCSV(rows) {
    const normalized = rows.map(r => {
      const out = {};
      for (const col of CSV_HEADER) out[col] = r[col] ?? '';
      return out;
    });
    const lines = [CSV_HEADER.join(',')];
    for (const row of normalized) {
      lines.push(CSV_HEADER.map(col => {
        const s = String(row[col] ?? '');
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(','));
    }
    return lines.join('\n') + '\n';
  }

  function formatDate(d) {
    if (!d) return '—';
    const parts = d.includes('-') ? d.split('-') : d.split('/');
    if (parts.length === 3 && d.includes('-')) {
      const [y, m, day] = parts;
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${months[parseInt(m, 10) - 1]} ${parseInt(day, 10)}, ${y}`;
    }
    if (parts.length === 3) {
      const [m, day, y] = parts;
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${months[parseInt(m, 10) - 1]} ${parseInt(day, 10)}, ${y}`;
    }
    return d;
  }

  return {
    CSV_HEADER,
    FRAME_COLS,
    generateGameId,
    normalizePlayerRow,
    parseBallCell,
    buildFrame,
    parseGame,
    calcBowlingScore,
    framePinTotal,
    framesToRolls,
    emptyBalls,
    frameSlot,
    scoreGame,
    isFrameComplete,
    ballsToRowDict,
    rowDictToPlayer,
    groupRowsByGame,
    flattenGames,
    validateRow,
    findDuplicateKeys,
    parseCompactLine,
    parseBulkGames,
    parseBulkHeaderLine,
    parseCSVLine,
    parseCSVText,
    rowsToCSV,
    formatDate,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BowlingCore;
}
