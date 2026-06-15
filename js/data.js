/**
 * Lane Legends — CSV parsing and data model
 */
const BowlingData = (() => {
  let parsedData = [];

  function parseGame(row) {
    return BowlingCore.parseGame(row);
  }

  function ingestRows(rows) {
    parsedData = rows
      .map(row => parseGame(row))
      .filter(g => g.player);
    BowlingUtils.resetPlayerColors();
    return parsedData;
  }

  function parseCSVText(text) {
    return BowlingCore.parseCSVText(text);
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

  function getData() { return parsedData; }

  function getPlayers() {
    return [...new Set(parsedData.map(r => r.player))].sort().slice(0, 3);
  }

  function hasData() { return parsedData.length > 0; }

  function toLegacy(game) {
    return {
      ...game,
      gameId: game.game_id,
      sessionGame: game.session_game,
      completedTime: game.completed_time,
      finalScore: game.final_score,
      strikes: game.frames.filter(f => f.isStrike).length,
      spares: game.frames.filter(f => f.isSpare).length,
      framePins: game.frames.map(f => BowlingCore.framePinTotal(f)),
    };
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
      .map(s => ({ ...s, lanes: [...s.lanes], gameCount: s.games.length }));
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

  return {
    parseGame,
    loadCSV,
    loadFromText,
    getData,
    getPlayers,
    hasData,
    getGames,
    getSessions,
    getPlayerStats,
  };
})();
