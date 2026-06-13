/**
 * Lane Legends — CSV parsing and data model
 */
const BowlingData = (() => {
  let parsedData = [];

  /** Session nicknames → real player names */
  const NICKNAME_TO_PLAYER = {
    SHREKK: 'Mattheus',
    MATE: 'Mattheus',
    MA: 'Mattheus',
    MAP: 'Mattheus',
    MAE: 'Mattheus',
    MEH: 'Mattheus',
    MAFUS: 'Shelley',
    SHRIMP: 'Shelley',
    SHEL: 'Shelley',
    SHE: 'Shelley',
    WIMBY: 'Shelley',
    EMLIE: 'Emily',
    EH: 'Emily',
  };

  function resolvePlayerFromNickname(nickname) {
    const key = String(nickname || '').trim().toUpperCase();
    return NICKNAME_TO_PLAYER[key] || null;
  }

  function normalizePlayerRow(row) {
    const rawPlayer = row.player != null ? String(row.player).trim() : '';
    const rawNickname = row.nickname != null ? String(row.nickname).trim() : '';

    if (rawPlayer && rawNickname) {
      return { player: rawPlayer, nickname: rawNickname };
    }
    if (rawPlayer && !rawNickname) {
      return { player: rawPlayer, nickname: '' };
    }
    if (rawNickname && !rawPlayer) {
      return {
        player: resolvePlayerFromNickname(rawNickname) || rawNickname,
        nickname: rawNickname,
      };
    }
    return { player: '', nickname: '' };
  }

  function parseBallCell(val) {
    if (val == null || String(val).trim() === '') return null;
    const v = String(val).trim().toUpperCase();
    if (v === 'X') return 'X';
    if (v === '/') return '/';
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
      if (r1 === 'X') {
        balls.push(10);
        isStrike = true;
      } else if (r2str === '/') {
        const first = typeof r1 === 'number' ? r1 : 0;
        balls.push(first);
        balls.push(10 - first);
        isSpare = true;
      } else {
        if (typeof r1 === 'number') balls.push(r1);
        if (typeof r2 === 'number') balls.push(r2);
      }
    } else {
      if (r1 === 'X') {
        balls.push(10);
        isStrike = true;
        if (r2str === 'X') {
          balls.push(10);
        } else if (r2str === '/') {
          balls.push(10);
        } else if (typeof r2 === 'number') {
          balls.push(r2);
        }
        if (r3 === 'X') balls.push(10);
        else if (typeof r3 === 'number') balls.push(r3);
      } else if (typeof r1 === 'number') {
        balls.push(r1);
        if (r2str === '/') {
          balls.push(10 - r1);
          isSpare = true;
          if (r3 === 'X') balls.push(10);
          else if (typeof r3 === 'number') balls.push(r3);
        } else if (typeof r2 === 'number') {
          balls.push(r2);
        }
      }
    }

    return { balls, isStrike, isSpare, frameScore: null };
  }

  function parseGame(row) {
    const frames = [];
    for (let f = 0; f < 10; f++) {
      const n = f + 1;
      const raw1 = row[`f${n}_b1`];
      const raw2 = row[`f${n}_b2`];
      const raw3 = f === 9 ? row.f10_b3 : undefined;
      frames.push(buildFrame(f, raw1, raw2, raw3));
    }

    const { total, frameTotals } = BowlingUtils.calcBowlingScore(frames);
    frames.forEach((frame, i) => {
      frame.frameScore = frameTotals[i];
    });

    const csvScore = row.final_score !== '' && row.final_score != null
      ? parseInt(row.final_score, 10)
      : null;

    const { player, nickname } = normalizePlayerRow(row);
    const displayName = nickname || player;

    const game = {
      game_id: row.game_id || '',
      date: row.date || '',
      lane: row.lane !== '' && row.lane != null ? parseInt(row.lane, 10) : null,
      session_game: row.session_game !== '' && row.session_game != null
        ? parseInt(row.session_game, 10) : null,
      completed_time: row.completed_time || null,
      player,
      nickname,
      displayName,
      final_score: !isNaN(csvScore) && csvScore != null ? csvScore : total,
      frames,
      calculated_score: total,
      sortKey: `${row.date}|${String(row.session_game || 999).padStart(3, '0')}|${row.completed_time || '99:99'}`,
    };

    return game;
  }

  function ingestRows(rows) {
    parsedData = rows
      .map(row => parseGame(row))
      .filter(g => g.player);
    BowlingUtils.resetPlayerColors();
    return parsedData;
  }

  function parseCSVText(text) {
    const result = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim(),
    });

    if (result.errors.length) {
      console.warn('CSV parse warnings:', result.errors);
    }

    return result.data.filter(row => {
      const { player, nickname } = normalizePlayerRow(row);
      return player || nickname;
    });
  }

  async function fetchCSVRows(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const text = await response.text();
      const rows = parseCSVText(text);
      return rows.length ? rows : null;
    } catch (_) {
      return null;
    }
  }

  async function loadCSV() {
    let rows = await fetchCSVRows('data/scores.csv');
    if (!rows) rows = await fetchCSVRows('data/sample_data.csv');
    if (!rows) {
      parsedData = [];
      BowlingUtils.resetPlayerColors();
      return parsedData;
    }
    return ingestRows(rows);
  }

  function loadFromText(text) {
    return ingestRows(parseCSVText(text));
  }

  function getData() {
    return parsedData;
  }

  function getPlayers() {
    return [...new Set(parsedData.map(r => r.player))].sort().slice(0, 3);
  }

  function hasData() {
    return parsedData.length > 0;
  }

  /* ── Compatibility adapters for dashboard pages ── */

  function toLegacy(game) {
    return {
      ...game,
      gameId: game.game_id,
      sessionGame: game.session_game,
      completedTime: game.completed_time,
      finalScore: game.final_score,
      strikes: game.frames.filter(f => f.isStrike).length,
      spares: game.frames.filter(f => f.isSpare).length,
      framePins: game.frames.map(f => BowlingUtils.framePinTotal(f)),
    };
  }

  function getRecords() {
    return parsedData.map(toLegacy);
  }

  function getGames() {
    const map = new Map();
    for (const g of parsedData) {
      if (!map.has(g.game_id)) {
        map.set(g.game_id, {
          gameId: g.game_id,
          date: g.date,
          lane: g.lane,
          sessionGame: g.session_game,
          completedTime: g.completed_time,
          sortKey: g.sortKey,
          players: [],
        });
      }
      map.get(g.game_id).players.push(toLegacy(g));
    }
    return [...map.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }

  function getSessions() {
    const map = new Map();
    for (const g of getGames()) {
      if (!map.has(g.date)) {
        map.set(g.date, { date: g.date, games: [], lanes: new Set() });
      }
      const s = map.get(g.date);
      s.games.push(g);
      if (g.lane) s.lanes.add(g.lane);
    }
    return [...map.values()]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(s => ({
        ...s,
        lanes: [...s.lanes],
        gameCount: s.games.length,
      }));
  }

  function getPlayerStats(name) {
    const stats = BowlingUtils.getPlayerStats(parsedData, name);
    return {
      name,
      games: stats.totalGames,
      avg: stats.avgScore,
      high: stats.highGame,
      low: stats.lowGame,
      strikeRate: stats.strikeRate,
      spareRate: stats.spareRate,
      openRate: stats.openRate,
      winRate: stats.winRate,
      nicknameCount: stats.nicknameCount,
      luckyNickname: stats.luckyNickname,
      cursedNickname: stats.cursedNickname,
      totalStrikes: stats.games.reduce((s, g) => s + g.frames.filter(f => f.isStrike).length, 0),
      totalSpares: stats.games.reduce((s, g) => s + g.frames.filter(f => f.isSpare).length, 0),
      avgByFrame: stats.avgByFrame,
      avgBySessionGame: stats.avgBySessionGame,
      avgByLane: stats.avgByLane,
      funFacts: BowlingUtils.generateFunFacts(parsedData, name),
      scores: stats.games.map(g => g.final_score).filter(Boolean),
      records: stats.games.map(toLegacy),
    };
  }

  function getAllPlayerStats() {
    return getPlayers().map(getPlayerStats);
  }

  function getAvgFramePins(playerName) {
    const games = parsedData.filter(r => r.player === playerName);
    if (!games.length) return Array(10).fill(null);
    const sums = Array(10).fill(0);
    const counts = Array(10).fill(0);
    for (const g of games) {
      g.frames.forEach((frame, i) => {
        const pins = BowlingUtils.framePinTotal(frame);
        sums[i] += pins;
        counts[i]++;
      });
    }
    return sums.map((s, i) => counts[i] ? BowlingUtils.round1(s / counts[i]) : null);
  }

  function getHeadToHead(p1, p2) {
    const matchups = [];
    for (const g of getGames()) {
      const r1 = g.players.find(p => p.player === p1);
      const r2 = g.players.find(p => p.player === p2);
      if (r1 && r2 && r1.finalScore != null && r2.finalScore != null) {
        matchups.push({
          gameId: g.gameId,
          date: g.date,
          sessionGame: g.sessionGame,
          score1: r1.finalScore,
          score2: r2.finalScore,
          winner: r1.finalScore > r2.finalScore ? p1 : r2.finalScore > r1.finalScore ? p2 : null,
        });
      }
    }
    return {
      matchups,
      p1Wins: matchups.filter(m => m.winner === p1).length,
      p2Wins: matchups.filter(m => m.winner === p2).length,
      ties: matchups.filter(m => m.winner === null).length,
      total: matchups.length,
    };
  }

  return {
    parseGame,
    loadCSV,
    loadFromText,
    getData,
    getPlayers,
    hasData,
    getRecords,
    getGames,
    getSessions,
    getPlayerStats,
    getAllPlayerStats,
    getAvgFramePins,
    getHeadToHead,
    resolvePlayerFromNickname,
    NICKNAME_TO_PLAYER,
  };
})();
