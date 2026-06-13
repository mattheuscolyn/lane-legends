/**
 * Sessions page
 */
const SessionsPage = (() => {
  let sortOrder = 'newest';
  let laneFilter = 'all';
  let yearFilter = 'all';

  function destroyCharts() {
    /* no Chart.js on this page */
  }

  function getAllSessions() {
    return BowlingData.getSessions();
  }

  function getYears(sessions) {
    return [...new Set(sessions.map(s => s.date.slice(0, 4)))].sort().reverse();
  }

  function getAllLanes(sessions) {
    const lanes = new Set();
    sessions.forEach(s => s.lanes.forEach(l => lanes.add(l)));
    return [...lanes].sort((a, b) => a - b);
  }

  function sessionPlayerSummaries(date) {
    const data = BowlingData.getData().filter(g => g.date === date);
    const map = {};
    for (const g of data) {
      if (!map[g.player]) map[g.player] = [];
      if (g.final_score != null) map[g.player].push(g.final_score);
    }
    return Object.entries(map)
      .map(([player, scores]) => ({
        player,
        avg: BowlingUtils.round1(BowlingUtils.avg(scores)),
      }))
      .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
  }

  function sessionGroupAvg(date) {
    const scores = BowlingData.getData()
      .filter(g => g.date === date)
      .map(g => g.final_score)
      .filter(s => s != null);
    return BowlingUtils.round1(BowlingUtils.avg(scores));
  }

  function oneLineSummary(date) {
    const summaries = sessionPlayerSummaries(date);
    if (!summaries.length) return '';
    const parts = summaries.map(s => `${s.player} ${s.avg ?? '—'}`);
    const winner = summaries[0];
    const tied = summaries.filter(s => s.avg === winner.avg);
    const winText = tied.length > 1
      ? 'Tie'
      : `${winner.player} wins`;
    return `${parts.join(' · ')} — ${winText}`;
  }

  function findBestSession(sessions) {
    let best = null;
    let bestAvg = -1;
    for (const s of sessions) {
      const avg = sessionGroupAvg(s.date);
      if (avg != null && avg > bestAvg) {
        bestAvg = avg;
        best = s;
      }
    }
    return best ? { session: best, groupAvg: bestAvg, summaries: sessionPlayerSummaries(best.date) } : null;
  }

  function filterSessions(sessions) {
    return sessions.filter(s => {
      if (yearFilter !== 'all' && !s.date.startsWith(yearFilter)) return false;
      if (laneFilter !== 'all' && !s.lanes.includes(parseInt(laneFilter, 10))) return false;
      return true;
    });
  }

  function sortSessions(sessions) {
    const sorted = [...sessions];
    sorted.sort((a, b) =>
      sortOrder === 'newest' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)
    );
    return sorted;
  }

  function mostCommonLane(sessions) {
    const counts = {};
    for (const s of sessions) {
      for (const l of s.lanes) {
        counts[l] = (counts[l] || 0) + 1;
      }
    }
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return entries.length ? { lane: parseInt(entries[0][0], 10), count: entries[0][1] } : null;
  }

  function weekGamesMap(sessions) {
    const map = new Map();
    for (const s of sessions) {
      const weekKey = isoWeekKey(s.date);
      map.set(weekKey, (map.get(weekKey) || 0) + s.gameCount);
    }
    return map;
  }

  function isoWeekKey(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - day);
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  function renderCalendarHeatmap(sessions) {
    const weekMap = weekGamesMap(sessions);
    if (!weekMap.size) return '<p class="text-muted">No session data</p>';

    const weeks = [...weekMap.keys()].sort();
    const maxGames = Math.max(...weekMap.values());
    const cell = 14;
    const gap = 3;
    const cols = Math.min(weeks.length, 26);
    const rows = Math.ceil(weeks.length / cols);
    const w = cols * (cell + gap) + gap;
    const h = rows * (cell + gap) + gap + 16;

    const cells = weeks.map((wk, i) => {
      const count = weekMap.get(wk);
      const t = maxGames ? count / maxGames : 0;
      const r = Math.round(124 + (255 - 124) * (1 - t * 0.7));
      const g = Math.round(111 + (255 - 111) * (1 - t * 0.7));
      const b = Math.round(255 * (1 - t * 0.85));
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = gap + col * (cell + gap);
      const y = gap + row * (cell + gap);
      return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2"
        fill="rgb(${r},${g},${b})" stroke="#e2e5ec" stroke-width="0.5">
        <title>${wk}: ${count} game${count !== 1 ? 's' : ''}</title>
      </rect>`;
    }).join('');

    return `
      <svg viewBox="0 0 ${w} ${h}" class="session-heatmap-svg" aria-label="Weekly session heatmap">
        ${cells}
        <text x="0" y="${h - 2}" font-size="8" fill="#8fa3bc">Older ← weeks → Newer</text>
      </svg>
    `;
  }

  function ballDisplay(frame, frameIdx) {
    if (frameIdx < 9) {
      if (frame.isStrike) return ['X', ''];
      if (frame.isSpare) return [String(frame.balls[0] ?? ''), '/'];
      return [
        frame.balls[0] != null ? String(frame.balls[0]) : '',
        frame.balls[1] != null ? String(frame.balls[1]) : '',
      ];
    }

    const balls = frame.balls.filter(b => b != null);
    const cells = ['', '', ''];

    if (!balls.length) return cells;

    if (balls[0] === 10) {
      cells[0] = 'X';
      if (balls.length > 1) {
        cells[1] = balls[1] === 10 ? 'X' : String(balls[1]);
      }
      if (balls.length > 2) {
        cells[2] = balls[2] === 10 ? 'X' : String(balls[2]);
      }
    } else {
      cells[0] = String(balls[0]);
      if (frame.isSpare) {
        cells[1] = '/';
        if (balls.length > 2) cells[2] = balls[2] === 10 ? 'X' : String(balls[2]);
      } else {
        if (balls.length > 1) cells[1] = String(balls[1]);
      }
    }
    return cells;
  }

  function renderScorecard(gameRecord) {
    const g = BowlingData.getData().find(
      r => r.game_id === gameRecord.gameId && r.player === gameRecord.player
    );
    if (!g) return '';

    const color = BowlingUtils.getPlayerColor(g.player);

    const framesHtml = g.frames.map((frame, i) => {
      const balls = ballDisplay(frame, i);
      const isTenth = i === 9;
      const ballCells = isTenth
        ? `<span class="sc-ball">${balls[0]}</span><span class="sc-ball">${balls[1]}</span><span class="sc-ball sc-ball--wide">${balls[2]}</span>`
        : `<span class="sc-ball">${balls[0]}</span><span class="sc-ball">${balls[1]}</span>`;

      return `
        <div class="sc-frame${isTenth ? ' sc-frame--10' : ''}">
          <div class="sc-frame-label">${i + 1}</div>
          <div class="sc-balls">${ballCells}</div>
          <div class="sc-running">${frame.frameScore ?? ''}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="scorecard">
        <div class="scorecard-meta">
          <span class="player-chip">
            <span class="legend-dot" style="background:${color}"></span>
            <strong>${g.player}</strong>
          </span>
          <span class="scorecard-meta-detail">
            Game ${g.session_game ?? '—'} · Lane ${g.lane ?? '—'}
            ${g.completed_time ? ` · ${BowlingUtils.formatTime(g.completed_time)}` : ''}
          </span>
        </div>
        <div class="scorecard-board">
          ${framesHtml}
          <div class="sc-final">
            <div class="sc-final-label">Total</div>
            <div class="sc-final-score">${g.final_score ?? '—'}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderSessionCard(session) {
    const summaries = sessionPlayerSummaries(session.date);
    const summaryLine = oneLineSummary(session.date);

    const gamesHtml = session.games.map(game => {
      const scorecards = game.players
        .sort((a, b) => a.player.localeCompare(b.player))
        .map(p => renderScorecard(p))
        .join('');
      return `
        <div class="session-game-block">
          <div class="session-game-label">
            Game ${game.sessionGame ?? '—'}
            ${game.lane ? ` · Lane ${game.lane}` : ''}
            ${game.completedTime ? ` · ${BowlingUtils.formatTime(game.completedTime)}` : ''}
          </div>
          <div class="session-scorecards">${scorecards}</div>
        </div>
      `;
    }).join('');

    return `
      <details class="session-collapse-card">
        <summary class="session-collapse-summary">
          <div class="session-summary-main">
            <span class="session-summary-date">${BowlingUtils.formatDate(session.date)}</span>
            <span class="session-summary-meta">
              ${session.lanes.length ? `Lane${session.lanes.length > 1 ? 's' : ''} ${session.lanes.join(', ')}` : 'Lane ?'}
              · ${session.gameCount} game${session.gameCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div class="session-summary-scores">${summaryLine}</div>
          <span class="session-expand-icon" aria-hidden="true">▾</span>
        </summary>
        <div class="session-collapse-body">
          ${gamesHtml}
        </div>
      </details>
    `;
  }

  function render(container) {
    destroyCharts();

    if (!BowlingData.hasData()) {
      container.innerHTML = '<div class="empty-state"><h3>No data yet</h3><p>Load scores.csv to review bowling sessions.</p></div>';
      return;
    }

    const allSessions = getAllSessions();
    const years = getYears(allSessions);
    const lanes = getAllLanes(allSessions);
    const filtered = sortSessions(filterSessions(allSessions));
    const best = findBestSession(allSessions);
    const commonLane = mostCommonLane(allSessions);
    const avgGames = BowlingUtils.round1(BowlingUtils.avg(allSessions.map(s => s.gameCount)));

    container.innerHTML = `
      <div class="sessions-stats-bar">
        <div class="kpi-card sessions-stat-card">
          <div class="kpi-label">Total sessions</div>
          <div class="kpi-value">${allSessions.length}</div>
        </div>
        <div class="kpi-card sessions-stat-card">
          <div class="kpi-label">Avg games / session</div>
          <div class="kpi-value">${avgGames ?? '—'}</div>
        </div>
        <div class="kpi-card sessions-stat-card">
          <div class="kpi-label">Most common lane</div>
          <div class="kpi-value">${commonLane ? commonLane.lane : '—'}<small>${commonLane ? ` (${commonLane.count}×)` : ''}</small></div>
        </div>
        <div class="kpi-card sessions-stat-card sessions-heatmap-card">
          <div class="kpi-label">Weekly activity</div>
          ${renderCalendarHeatmap(allSessions)}
        </div>
      </div>

      ${best ? `
        <div class="best-session-card">
          <div class="best-session-badge">Best session ever</div>
          <div class="best-session-date">${BowlingUtils.formatDate(best.session.date)}</div>
          <div class="best-session-avg">Group avg: <strong>${best.groupAvg}</strong></div>
          <div class="best-session-scores">
            ${best.summaries.map(s => `
              <span class="best-session-player" style="color:${BowlingUtils.getPlayerColor(s.player)}">
                ${s.player} <strong>${s.avg}</strong>
              </span>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="sessions-controls">
        <div class="control-group">
          <label for="sessionSort">Sort</label>
          <select id="sessionSort">
            <option value="newest"${sortOrder === 'newest' ? ' selected' : ''}>Newest first</option>
            <option value="oldest"${sortOrder === 'oldest' ? ' selected' : ''}>Oldest first</option>
          </select>
        </div>
        ${lanes.length ? `
          <div class="control-group">
            <label for="sessionLane">Lane</label>
            <select id="sessionLane">
              <option value="all"${laneFilter === 'all' ? ' selected' : ''}>All lanes</option>
              ${lanes.map(l => `
                <option value="${l}"${laneFilter === String(l) ? ' selected' : ''}>Lane ${l}</option>
              `).join('')}
            </select>
          </div>
        ` : ''}
        ${years.length > 1 ? `
          <div class="control-group">
            <label for="sessionYear">Year</label>
            <select id="sessionYear">
              <option value="all"${yearFilter === 'all' ? ' selected' : ''}>All years</option>
              ${years.map(y => `
                <option value="${y}"${yearFilter === y ? ' selected' : ''}>${y}</option>
              `).join('')}
            </select>
          </div>
        ` : ''}
        <div class="sessions-filter-count">${filtered.length} session${filtered.length !== 1 ? 's' : ''}</div>
      </div>

      <div class="sessions-scroll-list">
        ${filtered.length
          ? filtered.map(s => renderSessionCard(s)).join('')
          : '<div class="empty-state"><p>No sessions match your filters.</p></div>'}
      </div>
    `;

    container.querySelector('#sessionSort')?.addEventListener('change', e => {
      sortOrder = e.target.value;
      render(container);
    });
    container.querySelector('#sessionLane')?.addEventListener('change', e => {
      laneFilter = e.target.value;
      render(container);
    });
    container.querySelector('#sessionYear')?.addEventListener('change', e => {
      yearFilter = e.target.value;
      render(container);
    });
  }

  return { render, destroy: destroyCharts };
})();
