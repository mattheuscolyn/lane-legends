/**
 * Lane Legends — bowling score math and shared helpers
 */
const BowlingUtils = (() => {
  const PLAYER_COLORS = ['#7c6fff', '#1d9e75', '#d85a30'];
  const playerColorMap = new Map();
  let colorsInitialized = false;

  function initPlayerColors() {
    if (colorsInitialized) return;
    const data = typeof BowlingData !== 'undefined' ? BowlingData.getData() : [];
    const names = [...new Set(data.map(r => r.player))].sort().slice(0, 3);
    names.forEach((name, i) => playerColorMap.set(name, PLAYER_COLORS[i]));
    colorsInitialized = true;
  }

  function resetPlayerColors() {
    playerColorMap.clear();
    colorsInitialized = false;
  }

  function getPlayerColor(playerName) {
    initPlayerColors();
    return playerColorMap.get(playerName) || '#888888';
  }

  function avg(arr) {
    const valid = arr.filter(v => v != null && !isNaN(v));
    if (!valid.length) return null;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  }

  function round1(n) {
    return n == null || isNaN(n) ? null : Math.round(n * 10) / 10;
  }

  function framesToRolls(frames) {
    return BowlingCore.framesToRolls(frames);
  }

  function calcBowlingScore(frames) {
    return BowlingCore.calcBowlingScore(frames);
  }

  function framePinTotal(frame) {
    return BowlingCore.framePinTotal(frame);
  }

  function getSessionGames(data, date) {
    const sessionRows = data.filter(r => r.date === date);
    const grouped = {};
    for (const row of sessionRows) {
      if (!grouped[row.player]) grouped[row.player] = [];
      grouped[row.player].push(row);
    }
    for (const player of Object.keys(grouped)) {
      grouped[player].sort((a, b) => {
        const sg = (a.session_game ?? 999) - (b.session_game ?? 999);
        if (sg !== 0) return sg;
        return (a.completed_time || '').localeCompare(b.completed_time || '');
      });
    }
    return grouped;
  }

  /** Effective alias for grouping: explicit nickname, or real name when blank. */
  function resolveNickname(game) {
    const nick = game.nickname != null ? String(game.nickname).trim() : '';
    return nick || game.player;
  }

  function countSessionWins(data, playerName, sessionDates) {
    let wins = 0;
    for (const date of sessionDates) {
      const sessionGames = getSessionGames(data, date);
      const avgs = Object.entries(sessionGames).map(([player, rows]) => ({
        player,
        avg: avg(rows.map(r => r.final_score).filter(Boolean)),
      })).filter(x => x.avg != null);

      if (!avgs.length) continue;
      const best = avgs.reduce((a, b) => (b.avg > a.avg ? b : a));
      const playerEntry = avgs.find(x => x.player === playerName);
      if (playerEntry && playerEntry.avg === best.avg) {
        const tied = avgs.filter(x => x.avg === best.avg);
        if (tied.length === 1 || tied[0].player === playerName) wins++;
      }
    }
    return wins;
  }

  function buildNicknameStat(games, nickname, playerName, data) {
    const scores = games.map(g => g.final_score).filter(s => s != null);
    let strikeFrames = 0;
    let totalFrames = 0;

    for (const game of games) {
      game.frames.forEach(frame => {
        totalFrames++;
        if (frame.isStrike) strikeFrames++;
      });
    }

    const dates = games.map(g => g.date).filter(Boolean);
    const sessionDates = [...new Set(dates)];

    const stat = {
      nickname,
      gamesPlayed: games.length,
      avgScore: round1(avg(scores)),
      highGame: scores.length ? Math.max(...scores) : null,
      wins: countSessionWins(data, playerName, sessionDates),
      strikeRate: totalFrames ? round1((strikeFrames / totalFrames) * 100) : null,
      firstUsed: dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null,
      lastUsed: dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null,
    };

    return stat;
  }

  function getNicknameStats(data, playerName) {
    const games = data.filter(r => r.player === playerName);
    const grouped = new Map();

    for (const game of games) {
      const nick = resolveNickname(game);
      if (!grouped.has(nick)) grouped.set(nick, []);
      grouped.get(nick).push(game);
    }

    return [...grouped.entries()]
      .map(([nickname, rows]) => buildNicknameStat(rows, nickname, playerName, data))
      .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));
  }

  function getGroupNicknameStats(data) {
    const grouped = new Map();

    for (const game of data) {
      if (!game.player) continue;
      const nick = resolveNickname(game);
      const key = `${game.player}\0${nick}`;
      if (!grouped.has(key)) grouped.set(key, { player: game.player, nickname: nick, games: [] });
      grouped.get(key).games.push(game);
    }

    return [...grouped.values()]
      .map(({ player, nickname, games }) => ({
        player,
        ...buildNicknameStat(games, nickname, player, data),
      }))
      .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));
  }

  function getPlayerStats(data, playerName) {
    const games = data.filter(r => r.player === playerName);
    const scores = games.map(g => g.final_score).filter(s => s != null);

    let strikeFrames = 0;
    let spareFrames = 0;
    let openFrames = 0;
    const firstBallByFrame = Array.from({ length: 10 }, () => []);
    const sessionGameScores = {};
    const laneScores = {};

    for (const game of games) {
      game.frames.forEach((frame, i) => {
        if (frame.isStrike) strikeFrames++;
        else if (frame.isSpare) spareFrames++;
        else if (frame.balls.length && frame.balls[0] != null) openFrames++;

        const first = frame.balls[0];
        if (first != null) firstBallByFrame[i].push(first);
      });

      if (game.session_game != null) {
        if (!sessionGameScores[game.session_game]) sessionGameScores[game.session_game] = [];
        if (game.final_score != null) sessionGameScores[game.session_game].push(game.final_score);
      }

      if (game.lane != null && game.final_score != null) {
        if (!laneScores[game.lane]) laneScores[game.lane] = [];
        laneScores[game.lane].push(game.final_score);
      }
    }

    const totalFrames = games.length * 10;
    const avgBySessionGame = {};
    for (const [sg, sc] of Object.entries(sessionGameScores)) {
      avgBySessionGame[sg] = round1(avg(sc));
    }

    const avgByLane = {};
    for (const [lane, sc] of Object.entries(laneScores)) {
      avgByLane[lane] = round1(avg(sc));
    }

    const sessions = [...new Set(games.map(g => g.date))];
    let sessionWins = 0;
    for (const date of sessions) {
      const sessionGames = getSessionGames(data, date);
      const avgs = Object.entries(sessionGames).map(([player, rows]) => ({
        player,
        avg: avg(rows.map(r => r.final_score).filter(Boolean)),
      })).filter(x => x.avg != null);

      if (!avgs.length) continue;
      const best = avgs.reduce((a, b) => (b.avg > a.avg ? b : a));
      const playerEntry = avgs.find(x => x.player === playerName);
      if (playerEntry && playerEntry.avg === best.avg) {
        const tied = avgs.filter(x => x.avg === best.avg);
        if (tied.length === 1 || tied[0].player === playerName) sessionWins++;
      }
    }

    const nicknameStats = getNicknameStats(data, playerName);
    const distinctNicknames = new Set(
      games
        .map(g => (g.nickname != null ? String(g.nickname).trim() : ''))
        .filter(Boolean)
    );

    return {
      avgScore: round1(avg(scores)),
      highGame: scores.length ? Math.max(...scores) : null,
      lowGame: scores.length ? Math.min(...scores) : null,
      totalGames: games.length,
      strikeRate: totalFrames ? round1((strikeFrames / totalFrames) * 100) : null,
      spareRate: totalFrames ? round1((spareFrames / totalFrames) * 100) : null,
      openRate: totalFrames ? round1((openFrames / totalFrames) * 100) : null,
      avgByFrame: firstBallByFrame.map(balls => round1(avg(balls))),
      avgBySessionGame,
      avgByLane,
      winRate: sessions.length ? round1((sessionWins / sessions.length) * 100) : null,
      nicknameCount: distinctNicknames.size,
      luckyNickname: nicknameStats.length ? nicknameStats[0].nickname : null,
      cursedNickname: nicknameStats.length ? nicknameStats[nicknameStats.length - 1].nickname : null,
      games,
    };
  }

  function generateFunFacts(data, playerName) {
    const stats = getPlayerStats(data, playerName);
    const facts = [];

    if (!stats.totalGames) {
      return ['No games on record yet — time to hit the lanes!'];
    }

    const laneEntries = Object.entries(stats.avgByLane)
      .map(([lane, avgScore]) => ({ lane: parseInt(lane, 10), avgScore }))
      .sort((a, b) => b.avgScore - a.avgScore);

    if (laneEntries.length) {
      const best = laneEntries[0];
      facts.push(`Best lane: Lane ${best.lane} (${best.avgScore} avg across ${stats.games.filter(g => g.lane === best.lane).length} games).`);
    }

    const sgEntries = Object.entries(stats.avgBySessionGame)
      .map(([sg, avgScore]) => ({ sg: parseInt(sg, 10), avgScore }))
      .sort((a, b) => b.avgScore - a.avgScore);

    if (sgEntries.length) {
      const best = sgEntries[0];
      const ord = ['1st', '2nd', '3rd'][best.sg - 1] || `Game ${best.sg}`;
      facts.push(`Strongest when fresh: ${ord} game of the night averages ${best.avgScore}.`);
    }

    const sorted = [...stats.games].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    let bestStreak = 1;
    let current = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].final_score > sorted[i - 1].final_score) {
        current++;
        bestStreak = Math.max(bestStreak, current);
      } else {
        current = 1;
      }
    }
    if (bestStreak >= 2) {
      facts.push(`Longest hot streak: ${bestStreak} consecutive games with improving scores.`);
    } else if (stats.highGame != null) {
      facts.push(`Personal best: ${stats.highGame} — the number to chase.`);
    }

    const players = [...new Set(data.map(r => r.player))].filter(p => p !== playerName);
    let nemesis = null;
    let mostLosses = 0;
    for (const opp of players) {
      const gameIds = [...new Set(
        data.filter(r => r.player === playerName).map(r => r.game_id)
      )];
      let losses = 0;
      let matchups = 0;
      for (const gid of gameIds) {
        const mine = data.find(r => r.game_id === gid && r.player === playerName);
        const theirs = data.find(r => r.game_id === gid && r.player === opp);
        if (mine?.final_score != null && theirs?.final_score != null) {
          matchups++;
          if (theirs.final_score > mine.final_score) losses++;
        }
      }
      if (matchups && losses > mostLosses) {
        mostLosses = losses;
        nemesis = { opp, losses, matchups };
      }
    }
    if (nemesis) {
      facts.push(`Nemesis alert: ${nemesis.opp} has outscored you in ${nemesis.losses} of ${nemesis.matchups} shared games.`);
    }

    if (stats.winRate != null) {
      facts.push(`Session win rate: ${stats.winRate}% of bowling days with the highest session average.`);
    }

    return facts.slice(0, 5);
  }

  function formatDate(d) {
    return BowlingCore.formatDate(d);
  }

  function formatTime(time24) {
    if (!time24) return '';
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${mStr} ${ampm}`;
  }

  function chartDefaults() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    Chart.defaults.font.family = '"Segoe UI", system-ui, sans-serif';
    Chart.defaults.color = dark ? '#9a96a8' : '#5c6370';
    Chart.defaults.borderColor = dark ? '#2a2d3e' : '#e2e5ec';
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
  }

  function destroyChart(instance) {
    if (instance) instance.destroy();
  }

  return {
    getPlayerColor,
    resetPlayerColors,
    calcBowlingScore,
    framePinTotal,
    getSessionGames,
    resolveNickname,
    getNicknameStats,
    getGroupNicknameStats,
    getPlayerStats,
    generateFunFacts,
    formatDate,
    formatTime,
    avg,
    round1,
    chartDefaults,
    destroyChart,
  };
})();
