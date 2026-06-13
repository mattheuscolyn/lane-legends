/**
 * Overview page — Season overview (home)
 */
const OverviewPage = (() => {
  let charts = [];
  let timelineMeta = [];

  function destroyCharts() {
    charts.forEach(c => BowlingUtils.destroyChart(c));
    charts = [];
  }

  function getAllPlayerNames() {
    return [...new Set(BowlingData.getData().map(r => r.player))].sort();
  }

  function monthlyAvgDelta(playerName, data) {
    const now = new Date();
    const ym = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
    const thisKey = ym(now.getFullYear(), now.getMonth() + 1);
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastKey = ym(last.getFullYear(), last.getMonth() + 1);

    const games = data.filter(r => r.player === playerName && r.final_score != null);
    const thisScores = games.filter(g => g.date && g.date.slice(0, 7) === thisKey).map(g => g.final_score);
    const lastScores = games.filter(g => g.date && g.date.slice(0, 7) === lastKey).map(g => g.final_score);

    if (!thisScores.length || !lastScores.length) return null;
    return BowlingUtils.round1(BowlingUtils.avg(thisScores) - BowlingUtils.avg(lastScores));
  }

  function buildSeasonSummary(data) {
    const sessions = BowlingData.getSessions();
    const games = BowlingData.getGames();
    const lastSession = sessions.length ? sessions[0].date : null;
    return {
      totalSessions: sessions.length,
      totalGames: games.length,
      lastSession,
    };
  }

  function buildPlayerCards(data) {
    const names = getAllPlayerNames();
    const cards = names.map(name => {
      const stats = BowlingUtils.getPlayerStats(data, name);
      const delta = monthlyAvgDelta(name, data);
      return {
        name,
        avg: stats.avgScore,
        high: stats.highGame,
        delta,
        color: BowlingUtils.getPlayerColor(name),
      };
    });
    cards.sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
    if (cards.length) cards[0].isLeader = true;
    return cards;
  }

  function buildTimeline(data) {
    const games = BowlingData.getGames();
    timelineMeta = games.map(g => ({
      date: g.date,
      lane: g.lane,
      sessionGame: g.sessionGame,
      formattedDate: BowlingUtils.formatDate(g.date),
    }));

    const labels = games.map((g, i) => {
      if (i === 0 || g.date !== games[i - 1].date) {
        return BowlingUtils.formatDate(g.date).replace(/, \d{4}/, '');
      }
      return '';
    });

    const players = getAllPlayerNames();
    const datasets = players.map(name => ({
      label: name,
      data: games.map(g => {
        const r = g.players.find(p => p.player === name);
        return r?.finalScore ?? null;
      }),
      borderColor: BowlingUtils.getPlayerColor(name),
      backgroundColor: BowlingUtils.getPlayerColor(name),
      tension: 0.25,
      spanGaps: false,
      pointRadius: 3,
      pointHoverRadius: 5,
      borderWidth: 2,
    }));

    return { labels, datasets, games };
  }

  function buildRecentSessions() {
    return BowlingData.getSessions().slice(0, 4).map(session => {
      const playerAvgs = {};
      const playerScores = {};

      for (const game of session.games) {
        for (const p of game.players) {
          if (!playerScores[p.player]) playerScores[p.player] = [];
          if (p.finalScore != null) playerScores[p.player].push(p.finalScore);
        }
      }

      for (const [player, scores] of Object.entries(playerScores)) {
        playerAvgs[player] = BowlingUtils.round1(BowlingUtils.avg(scores));
      }

      const avgEntries = Object.entries(playerAvgs).filter(([, v]) => v != null);
      const topAvg = avgEntries.length
        ? Math.max(...avgEntries.map(([, v]) => v))
        : null;
      const winners = avgEntries.filter(([, v]) => v === topAvg).map(([p]) => p);

      return {
        date: session.date,
        formattedDate: BowlingUtils.formatDate(session.date),
        gameCount: session.gameCount,
        lanes: session.lanes,
        playerScores,
        playerAvgs,
        winners,
      };
    });
  }

  function updatePageHeader(summary) {
    document.getElementById('pageTitle').textContent = 'Season overview';
    const last = summary.lastSession
      ? BowlingUtils.formatDate(summary.lastSession)
      : '—';
    document.getElementById('pageSubtitle').textContent =
      `${summary.totalSessions} session${summary.totalSessions !== 1 ? 's' : ''} · ${summary.totalGames} game${summary.totalGames !== 1 ? 's' : ''} · Last session ${last}`;
  }

  function render(container) {
    destroyCharts();

    if (!BowlingData.hasData()) {
      updatePageHeader({ totalSessions: 0, totalGames: 0, lastSession: null });
      container.innerHTML = '<div class="empty-state"><h3>No data yet</h3><p>Load scores.csv to see your season overview.</p></div>';
      return;
    }

    const data = BowlingData.getData();
    const summary = buildSeasonSummary(data);
    const playerCards = buildPlayerCards(data);
    const timeline = buildTimeline(data);
    const recentSessions = buildRecentSessions();
    const allStats = getAllPlayerNames().map(name => ({
      name,
      ...BowlingUtils.getPlayerStats(data, name),
      color: BowlingUtils.getPlayerColor(name),
    }));

    updatePageHeader(summary);

    container.innerHTML = `
      <div class="player-card-row">
        ${playerCards.map(c => `
          <div class="player-stat-card${c.isLeader ? ' player-stat-card--leader' : ''}">
            ${c.isLeader ? '<span class="crown-badge" title="Season leader">👑</span>' : ''}
            <div class="player-stat-name">
              <span class="legend-dot" style="background:${c.color}"></span>
              ${c.name}
            </div>
            <div class="player-stat-avg">${c.avg != null ? c.avg.toFixed(1) : '—'}</div>
            <div class="player-stat-label">Season avg</div>
            <div class="player-stat-best">Best: <strong>${c.high ?? '—'}</strong></div>
            ${c.delta != null ? `
              <div class="player-stat-delta ${c.delta >= 0 ? 'positive' : 'negative'}">
                ${c.delta >= 0 ? '↑' : '↓'} ${c.delta >= 0 ? '+' : ''}${c.delta} from last month
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>

      <div class="panel overview-timeline-panel">
        <div class="panel-header">
          <div class="panel-title">Score timeline</div>
        </div>
        <div class="chart-wrap chart-wrap--timeline">
          <canvas id="chartTimeline"></canvas>
        </div>
      </div>

      <div class="chart-grid overview-bottom-grid">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">Strike leaders</div>
            <div class="panel-sub">Strike rate (% of frames)</div>
          </div>
          <div class="chart-wrap chart-wrap--hbar">
            <canvas id="chartStrikes"></canvas>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">Spare conversion</div>
            <div class="panel-sub">Spare rate (% of frames)</div>
          </div>
          <div class="chart-wrap chart-wrap--hbar">
            <canvas id="chartSpares"></canvas>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">Recent sessions</div>
          <div class="panel-sub">Last ${recentSessions.length} bowling days</div>
        </div>
        <div class="recent-sessions">
          ${recentSessions.map(s => `
            <div class="recent-session">
              <div class="recent-session-head">
                <span class="recent-session-date">${s.formattedDate}</span>
                <span class="recent-session-meta">${s.gameCount} game${s.gameCount !== 1 ? 's' : ''}${s.lanes.length ? ` · Lane${s.lanes.length > 1 ? 's' : ''} ${s.lanes.join(', ')}` : ''}</span>
              </div>
              <div class="recent-session-scores">
                ${Object.entries(s.playerScores).sort(([a], [b]) => a.localeCompare(b)).map(([player, scores]) => {
                  const isWinner = s.winners.includes(player);
                  return `
                    <div class="recent-session-player${isWinner ? ' recent-session-player--winner' : ''}">
                      <span class="player-chip">
                        <span class="legend-dot" style="background:${BowlingUtils.getPlayerColor(player)}"></span>
                        ${player}
                        ${isWinner ? '<span class="winner-tag">W</span>' : ''}
                      </span>
                      <span class="recent-session-game-scores">${scores.join(' · ')}</span>
                      <span class="recent-session-avg">${s.playerAvgs[player] != null ? `${s.playerAvgs[player]} avg` : ''}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const hbarOptions = (values, colors) => ({
      type: 'bar',
      data: {
        labels: allStats.map(s => s.name),
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderRadius: 4,
          barThickness: 18,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.parsed.x}%`,
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            max: 100,
            grid: { color: '#eef0f5' },
            ticks: { callback: v => `${v}%` },
          },
          y: { grid: { display: false } },
        },
      },
    });

    charts.push(new Chart(document.getElementById('chartTimeline'), {
      type: 'line',
      data: {
        labels: timeline.labels,
        datasets: timeline.datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: true },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 10, padding: 14 },
          },
          tooltip: {
            filter: item => item.parsed.y != null,
            callbacks: {
              title(items) {
                if (!items.length) return '';
                const idx = items[0].dataIndex;
                const meta = timelineMeta[idx];
                return meta ? meta.formattedDate : '';
              },
              label(ctx) {
                const idx = ctx.dataIndex;
                const meta = timelineMeta[idx];
                const score = ctx.parsed.y;
                const parts = [
                  `${ctx.dataset.label}: ${score}`,
                ];
                if (meta) {
                  if (meta.lane != null) parts.push(`Lane ${meta.lane}`);
                  if (meta.sessionGame != null) parts.push(`Game ${meta.sessionGame}`);
                }
                return parts;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: false,
            min: 40,
            grid: { color: '#eef0f5' },
          },
          x: {
            grid: { display: false },
            ticks: {
              maxRotation: 0,
              autoSkip: false,
              callback(val, index) {
                return timeline.labels[index] || '';
              },
            },
          },
        },
      },
    }));

    charts.push(new Chart(
      document.getElementById('chartStrikes'),
      hbarOptions(
        allStats.map(s => s.strikeRate ?? 0),
        allStats.map(s => s.color),
      ),
    ));

    charts.push(new Chart(
      document.getElementById('chartSpares'),
      hbarOptions(
        allStats.map(s => s.spareRate ?? 0),
        allStats.map(s => s.color),
      ),
    ));
  }

  return { render, destroy: destroyCharts };
})();
