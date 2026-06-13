/**
 * Head-to-Head page
 */
const HeadToHeadPage = (() => {
  let charts = [];
  let playerA = null;
  let playerB = null;

  function destroyCharts() {
    charts.forEach(c => BowlingUtils.destroyChart(c));
    charts = [];
  }

  function getPlayers() {
    return BowlingData.getPlayers();
  }

  function stdDev(arr) {
    if (arr.length < 2) return 0;
    const mean = BowlingUtils.avg(arr);
    const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
    return Math.sqrt(variance);
  }

  function tenthFrameAvg(games) {
    const pins = games.map(g => BowlingUtils.framePinTotal(g.frames[9])).filter(v => v != null);
    return BowlingUtils.round1(BowlingUtils.avg(pins));
  }

  function getSharedSessions(data, pA, pB) {
    const datesA = new Set(data.filter(g => g.player === pA).map(g => g.date));
    const datesB = new Set(data.filter(g => g.player === pB).map(g => g.date));
    return [...datesA]
      .filter(d => datesB.has(d))
      .sort()
      .map(date => {
        const gamesA = data.filter(g => g.player === pA && g.date === date);
        const gamesB = data.filter(g => g.player === pB && g.date === date);
        const scoresA = gamesA.map(g => g.final_score).filter(s => s != null);
        const scoresB = gamesB.map(g => g.final_score).filter(s => s != null);
        const avgA = BowlingUtils.round1(BowlingUtils.avg(scoresA));
        const avgB = BowlingUtils.round1(BowlingUtils.avg(scoresB));
        let winner = null;
        if (avgA != null && avgB != null) {
          if (avgA > avgB) winner = pA;
          else if (avgB > avgA) winner = pB;
        }
        return {
          date,
          avgA,
          avgB,
          diff: avgA != null && avgB != null ? BowlingUtils.round1(avgA - avgB) : null,
          winner,
          gap: avgA != null && avgB != null ? Math.abs(avgA - avgB) : null,
        };
      });
  }

  function getSessionRecord(sessions, pA, pB) {
    let aWins = 0;
    let bWins = 0;
    let ties = 0;
    for (const s of sessions) {
      if (s.winner === pA) aWins++;
      else if (s.winner === pB) bWins++;
      else ties++;
    }
    return { aWins, bWins, ties, total: sessions.length };
  }

  function getSharedGamesTimeline(data, pA, pB) {
    const idsB = new Set(data.filter(g => g.player === pB).map(g => g.game_id));
    const shared = data
      .filter(g => g.player === pA && idsB.has(g.game_id))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    return shared.map(gA => {
      const gB = data.find(g => g.game_id === gA.game_id && g.player === pB);
      const d = BowlingUtils.formatDate(gA.date).replace(/, \d{4}/, '');
      const label = gA.session_game ? `${d} G${gA.session_game}` : d;
      return {
        label,
        scoreA: gA.final_score,
        scoreB: gB?.final_score ?? null,
        date: gA.date,
        lane: gA.lane,
        sessionGame: gA.session_game,
      };
    });
  }

  function buildRadarData(data, pA, pB) {
    const statsA = BowlingUtils.getPlayerStats(data, pA);
    const statsB = BowlingUtils.getPlayerStats(data, pB);
    const gamesA = statsA.games;
    const gamesB = statsB.games;
    const scoresA = gamesA.map(g => g.final_score).filter(Boolean);
    const scoresB = gamesB.map(g => g.final_score).filter(Boolean);

    const maxAvg = Math.max(statsA.avgScore ?? 0, statsB.avgScore ?? 0, 1);
    const stdA = stdDev(scoresA);
    const stdB = stdDev(scoresB);
    const maxStd = Math.max(stdA, stdB, 1);

    const tenthA = tenthFrameAvg(gamesA);
    const tenthB = tenthFrameAvg(gamesB);

    const spareA = statsA.spareRate ?? 0;
    const spareB = statsB.spareRate ?? 0;

    return {
      labels: ['Avg Score', 'Strike Rate', 'Spare Rate', 'Consistency', '10th Frame'],
      a: [
        BowlingUtils.round1(((statsA.avgScore ?? 0) / maxAvg) * 100),
        statsA.strikeRate ?? 0,
        spareA,
        BowlingUtils.round1((1 - stdA / maxStd) * 100),
        BowlingUtils.round1(((tenthA ?? 0) / 30) * 100),
      ],
      b: [
        BowlingUtils.round1(((statsB.avgScore ?? 0) / maxAvg) * 100),
        statsB.strikeRate ?? 0,
        spareB,
        BowlingUtils.round1((1 - stdB / maxStd) * 100),
        BowlingUtils.round1(((tenthB ?? 0) / 30) * 100),
      ],
    };
  }

  function getSessionGameAvgs(data, player) {
    const stats = BowlingUtils.getPlayerStats(data, player);
    return stats.avgBySessionGame;
  }

  function playerOptions(players, selected, otherSelected) {
    return players.map(p => {
      const disabled = p === otherSelected ? ' disabled' : '';
      const sel = p === selected ? ' selected' : '';
      return `<option value="${p}"${sel}${disabled}>${p}</option>`;
    }).join('');
  }

  function ensureDistinctPlayers(players) {
    if (!playerA || !players.includes(playerA)) playerA = players[0];
    if (!playerB || !players.includes(playerB) || playerB === playerA) {
      playerB = players.find(p => p !== playerA) || players[1] || players[0];
    }
  }

  function render(container) {
    destroyCharts();

    if (!BowlingData.hasData()) {
      container.innerHTML = '<div class="empty-state"><h3>No data yet</h3><p>Load scores.csv for head-to-head matchups.</p></div>';
      return;
    }

    const data = BowlingData.getData();
    const players = getPlayers();
    ensureDistinctPlayers(players);

    if (playerA === playerB) {
      container.innerHTML = `
        <div class="control-row">
          <div class="control-group">
            <label for="h2hPA">Player A</label>
            <select id="h2hPA">${playerOptions(players, playerA, playerB)}</select>
          </div>
          <div class="control-group">
            <label for="h2hPB">Player B</label>
            <select id="h2hPB">${playerOptions(players, playerB, playerA)}</select>
          </div>
        </div>
        <div class="empty-state"><p>Select two different players to compare.</p></div>
      `;
      bindSelectors(container, players);
      return;
    }

    const colorA = BowlingUtils.getPlayerColor(playerA);
    const colorB = BowlingUtils.getPlayerColor(playerB);
    const statsA = BowlingUtils.getPlayerStats(data, playerA);
    const statsB = BowlingUtils.getPlayerStats(data, playerB);
    const sessions = getSharedSessions(data, playerA, playerB);
    const record = getSessionRecord(sessions, playerA, playerB);
    const timeline = getSharedGamesTimeline(data, playerA, playerB);
    const closeSessions = sessions.filter(s => s.gap != null && s.gap < 10);
    const closeAWins = closeSessions.filter(s => s.winner === playerA).length;
    const closeBWins = closeSessions.filter(s => s.winner === playerB).length;
    const closeTies = closeSessions.filter(s => !s.winner).length;
    const radar = buildRadarData(data, playerA, playerB);
    const posA = getSessionGameAvgs(data, playerA);
    const posB = getSessionGameAvgs(data, playerB);
    const posKeys = [...new Set([...Object.keys(posA), ...Object.keys(posB)])]
      .map(Number)
      .sort((a, b) => a - b);

    container.innerHTML = `
      <div class="control-row h2h-selectors">
        <div class="control-group">
          <label for="h2hPA">Player A</label>
          <select id="h2hPA">${playerOptions(players, playerA, playerB)}</select>
        </div>
        <div class="control-group">
          <label for="h2hPB">Player B</label>
          <select id="h2hPB">${playerOptions(players, playerB, playerA)}</select>
        </div>
      </div>

      ${sessions.length === 0 ? `
        <div class="empty-state"><p>No shared sessions between ${playerA} and ${playerB}.</p></div>
      ` : `
        <div class="h2h-matchup-header">
          <div class="h2h-names">
            <span class="h2h-name" style="color:${colorA}">${playerA}</span>
            <span class="h2h-vs-text">vs</span>
            <span class="h2h-name" style="color:${colorB}">${playerB}</span>
          </div>
          <div class="h2h-summary-row">
            <div class="h2h-summary-stat">
              <span class="h2h-summary-val" style="color:${colorA}">${statsA.avgScore?.toFixed(1) ?? '—'}</span>
              <span class="h2h-summary-lbl">${playerA} avg</span>
            </div>
            <div class="h2h-record-block">
              <div class="h2h-record-label">Session record</div>
              <div class="h2h-record-scores">
                <span style="color:${colorA}">${record.aWins}</span>
                <span class="h2h-record-sep">–</span>
                <span style="color:${colorB}">${record.bWins}</span>
                ${record.ties ? `<span class="h2h-record-ties">(${record.ties} tie${record.ties !== 1 ? 's' : ''})</span>` : ''}
              </div>
            </div>
            <div class="h2h-summary-stat">
              <span class="h2h-summary-val" style="color:${colorB}">${statsB.avgScore?.toFixed(1) ?? '—'}</span>
              <span class="h2h-summary-lbl">${playerB} avg</span>
            </div>
          </div>
        </div>

        ${timeline.length ? `
          <div class="panel h2h-panel">
            <div class="panel-header">
              <div>
                <div class="panel-title">Head-to-head timeline</div>
                <div class="panel-sub">Shared games in chronological order · shaded area = score spread</div>
              </div>
            </div>
            <div class="chart-wrap chart-wrap--h2h-timeline">
              <canvas id="chartH2HTimeline"></canvas>
            </div>
          </div>
        ` : ''}

        <div class="panel h2h-panel">
          <div class="panel-header">
            <div class="panel-title">Session breakdown</div>
            <div class="panel-sub">Winner = higher session average</div>
          </div>
          <div class="h2h-table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th class="text-right">${playerA} avg</th>
                  <th class="text-right">${playerB} avg</th>
                  <th class="text-right">Diff</th>
                  <th>Winner</th>
                </tr>
              </thead>
              <tbody>
                ${[...sessions].reverse().map(s => `
                  <tr class="${s.winner ? 'h2h-row-winner' : ''}">
                    <td>${BowlingUtils.formatDate(s.date)}</td>
                    <td class="text-right" style="color:${colorA};font-weight:${s.winner === playerA ? 700 : 400}">${s.avgA ?? '—'}</td>
                    <td class="text-right" style="color:${colorB};font-weight:${s.winner === playerB ? 700 : 400}">${s.avgB ?? '—'}</td>
                    <td class="text-right">${s.diff != null ? (s.diff > 0 ? '+' : '') + s.diff : '—'}</td>
                    <td>${s.winner
                      ? `<span class="player-chip"><span class="legend-dot" style="background:${BowlingUtils.getPlayerColor(s.winner)}"></span><strong>${s.winner}</strong></span>`
                      : '<span class="text-muted">Tie</span>'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="chart-grid h2h-mid-grid">
          <div class="panel">
            <div class="panel-header">
              <div class="panel-title">Strengths comparison</div>
              <div class="panel-sub">Normalized radar · higher = stronger</div>
            </div>
            <div class="chart-wrap chart-wrap--radar">
              <canvas id="chartH2HRadar"></canvas>
            </div>
          </div>

          <div class="panel">
            <div class="panel-header">
              <div class="panel-title">Game position advantage</div>
              <div class="panel-sub">Avg score by game # in session</div>
            </div>
            <div class="chart-wrap chart-wrap--h2h-pos">
              <canvas id="chartH2HPosition"></canvas>
            </div>
          </div>
        </div>

        <div class="panel h2h-clutch-panel">
          <div class="panel-header">
            <div class="panel-title">When they're close</div>
            <div class="panel-sub">Sessions with avg gap under 10 points</div>
          </div>
          <div class="h2h-clutch-body">
            <div class="h2h-clutch-stat">
              <span class="h2h-clutch-num">${closeSessions.length}</span>
              <span class="h2h-clutch-lbl">close session${closeSessions.length !== 1 ? 's' : ''}</span>
            </div>
            ${closeSessions.length ? `
              <div class="h2h-clutch-detail">
                <strong>Clutch edge:</strong>
                ${playerA} won <strong style="color:${colorA}">${closeAWins}</strong>,
                ${playerB} won <strong style="color:${colorB}">${closeBWins}</strong>
                ${closeTies ? `, ${closeTies} tied` : ''}
                ${closeAWins > closeBWins
                  ? ` — ${playerA} performs better in tight matchups.`
                  : closeBWins > closeAWins
                    ? ` — ${playerB} performs better in tight matchups.`
                    : ' — dead even when it\'s close.'}
              </div>
            ` : `
              <div class="h2h-clutch-detail text-muted">No sessions decided by fewer than 10 pins average.</div>
            `}
          </div>
        </div>
      `}
    `;

    bindSelectors(container, players);

    if (!sessions.length) return;

    if (timeline.length) {
      const labels = timeline.map(t => t.label);
      const scoresA = timeline.map(t => t.scoreA);
      const scoresB = timeline.map(t => t.scoreB);

      charts.push(new Chart(document.getElementById('chartH2HTimeline'), {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: playerA,
              data: scoresA,
              borderColor: colorA,
              backgroundColor: colorA,
              borderWidth: 2.5,
              tension: 0.3,
              pointRadius: 4,
              pointHoverRadius: 6,
              fill: false,
            },
            {
              label: playerB,
              data: scoresB,
              borderColor: colorB,
              backgroundColor: colorB + '33',
              borderWidth: 2.5,
              tension: 0.3,
              pointRadius: 4,
              pointHoverRadius: 6,
              fill: '-1',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 10 } },
            tooltip: {
              callbacks: {
                afterBody(items) {
                  if (!items.length) return [];
                  const idx = items[0].dataIndex;
                  const t = timeline[idx];
                  const lines = [];
                  if (t.lane != null) lines.push(`Lane ${t.lane}`);
                  if (t.sessionGame != null) lines.push(`Game ${t.sessionGame}`);
                  if (t.scoreA != null && t.scoreB != null) {
                    lines.push(`Spread: ${Math.abs(t.scoreA - t.scoreB)} pins`);
                  }
                  return lines;
                },
              },
            },
          },
          scales: {
            y: { beginAtZero: false, min: 40, grid: { color: '#eef0f5' } },
            x: { grid: { display: false }, ticks: { maxRotation: 45, font: { size: 10 } } },
          },
        },
      }));
    }

    charts.push(new Chart(document.getElementById('chartH2HRadar'), {
      type: 'radar',
      data: {
        labels: radar.labels,
        datasets: [
          {
            label: playerA,
            data: radar.a,
            borderColor: colorA,
            backgroundColor: colorA + '44',
            borderWidth: 2,
            pointRadius: 3,
          },
          {
            label: playerB,
            data: radar.b,
            borderColor: colorB,
            backgroundColor: colorB + '44',
            borderWidth: 2,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } } },
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: { stepSize: 20, display: false },
            grid: { color: '#e2e5ec' },
            pointLabels: { font: { size: 11 } },
          },
        },
      },
    }));

    if (posKeys.length) {
      charts.push(new Chart(document.getElementById('chartH2HPosition'), {
        type: 'bar',
        data: {
          labels: posKeys.map(k => `Game ${k}`),
          datasets: [
            {
              label: playerA,
              data: posKeys.map(k => posA[k] ?? null),
              backgroundColor: colorA,
              borderRadius: 4,
            },
            {
              label: playerB,
              data: posKeys.map(k => posB[k] ?? null),
              backgroundColor: colorB,
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } } },
          scales: {
            y: { beginAtZero: false, min: 40, grid: { color: '#eef0f5' } },
            x: { grid: { display: false } },
          },
        },
      }));
    }
  }

  function bindSelectors(container, players) {
    const selA = container.querySelector('#h2hPA');
    const selB = container.querySelector('#h2hPB');
    selA?.addEventListener('change', e => {
      playerA = e.target.value;
      if (playerA === playerB) {
        playerB = players.find(p => p !== playerA) || playerB;
      }
      render(container);
    });
    selB?.addEventListener('change', e => {
      playerB = e.target.value;
      if (playerB === playerA) {
        playerA = players.find(p => p !== playerB) || playerA;
      }
      render(container);
    });
  }

  return { render, destroy: destroyCharts };
})();
