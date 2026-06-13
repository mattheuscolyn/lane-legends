/**
 * Aliases page — nickname / alter ego analytics
 */
const AliasesPage = (() => {
  let charts = [];
  let selectedPlayer = null;

  function destroy() {
    charts.forEach(c => BowlingUtils.destroyChart(c));
    charts = [];
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function countUniqueNicknames(data) {
    return new Set(
      data.map(g => (g.nickname != null ? String(g.nickname).trim() : '')).filter(Boolean)
    ).size;
  }

  function isExplicitAlias(stat, data) {
    return data.some(g =>
      g.player === stat.player &&
      String(g.nickname || '').trim() === stat.nickname
    );
  }

  function getExplicitGroupStats(data) {
    return BowlingUtils.getGroupNicknameStats(data).filter(s => isExplicitAlias(s, data));
  }

  function getExplicitPlayerStats(data, player) {
    return BowlingUtils.getNicknameStats(data, player).filter(s =>
      data.some(g =>
        g.player === player &&
        String(g.nickname || '').trim() === s.nickname
      )
    );
  }

  function groupOverallAvg(data) {
    const scores = data.map(g => g.final_score).filter(s => s != null);
    return BowlingUtils.round1(BowlingUtils.avg(scores)) || 100;
  }

  function nicknameLabelPlugin() {
    return {
      id: 'aliasBubbleLabels',
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        const dataset = chart.data.datasets[0];
        if (!dataset) return;
        const meta = chart.getDatasetMeta(0);
        dataset.data.forEach((point, i) => {
          const el = meta.data[i];
          if (!el || point.nickname == null) return;
          const yOff = typeof el.height === 'function' ? el.height() + 6 : 12;
          ctx.save();
          ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
          ctx.fillStyle = getComputedStyle(document.documentElement)
            .getPropertyValue('--text').trim() || '#1a1d2e';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          const label = point.nickname.length > 14
            ? `${point.nickname.slice(0, 12)}…`
            : point.nickname;
          ctx.fillText(label, el.x, el.y - yOff);
          ctx.restore();
        });
      },
    };
  }

  function buildBubbleChart(canvasId, stats, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !stats.length) return;

    const maxHigh = Math.max(...stats.map(s => s.highGame ?? 0), 1);
    const data = stats.map(s => ({
      x: s.gamesPlayed,
      y: s.avgScore ?? 0,
      r: Math.max(6, Math.min(28, ((s.highGame ?? 0) / maxHigh) * 24 + 6)),
      nickname: s.nickname,
    }));

    const chart = new Chart(canvas, {
      type: 'bubble',
      data: {
        datasets: [{
          label: 'Aliases',
          data,
          backgroundColor: color + '55',
          borderColor: color,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(ctx) {
                const p = ctx.raw;
                return [
                  p.nickname,
                  `Games: ${p.x}`,
                  `Avg: ${p.y}`,
                  `Best: ${stats[ctx.dataIndex]?.highGame ?? '—'}`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: 'Games played' },
            min: 0,
            suggestedMax: Math.max(...data.map(d => d.x)) + 0.5,
            ticks: { stepSize: 1, precision: 0 },
          },
          y: {
            title: { display: true, text: 'Average score' },
            suggestedMin: Math.max(0, Math.min(...data.map(d => d.y)) - 15),
          },
        },
      },
      plugins: [nicknameLabelPlugin()],
    });
    charts.push(chart);
  }

  function computeFunStats(data, players) {
    const groupStats = getExplicitGroupStats(data);

    let mostNicknames = { player: '—', count: 0 };
    let biggestEffect = { player: '—', variance: 0 };
    let mostConsistent = { player: '—', variance: null };
    let bestSingle = { player: '—', nickname: '—', score: 0 };

    for (const player of players) {
      const ps = BowlingUtils.getPlayerStats(data, player);
      if (ps.nicknameCount > mostNicknames.count) {
        mostNicknames = { player, count: ps.nicknameCount };
      }

      const aliasStats = getExplicitPlayerStats(data, player);
      const avgs = aliasStats.map(s => s.avgScore).filter(a => a != null);
      if (avgs.length >= 2) {
        const mean = BowlingUtils.avg(avgs);
        const variance = avgs.reduce((sum, a) => sum + (a - mean) ** 2, 0) / avgs.length;
        if (variance > biggestEffect.variance) {
          biggestEffect = { player, variance: BowlingUtils.round1(variance) };
        }
        if (mostConsistent.variance == null || variance < mostConsistent.variance) {
          mostConsistent = { player, variance: BowlingUtils.round1(variance) };
        }
      }
    }

    for (const g of data) {
      const nick = String(g.nickname || '').trim();
      if (!nick || nick === g.player) continue;
      if (g.final_score != null && g.final_score > bestSingle.score) {
        bestSingle = { player: g.player, nickname: nick, score: g.final_score };
      }
    }

    const overallAvg = groupOverallAvg(data);

    return { mostNicknames, biggestEffect, mostConsistent, bestSingle, overallAvg, groupStats };
  }

  function renderLeaderboard(groupStats, overallAvg) {
    const top = groupStats.slice(0, 15);
    if (!top.length) {
      return '<p class="text-muted alias-empty-hint">No explicit aliases recorded yet.</p>';
    }

    return `
      <ol class="alias-leaderboard">
        ${top.map((entry, i) => {
          const rank = i + 1;
          const pct = overallAvg
            ? Math.min(100, Math.max(8, ((entry.avgScore ?? 0) / overallAvg) * 100))
            : 50;
          const isGold = rank === 1;
          const oneTime = entry.gamesPlayed === 1;
          return `
            <li class="alias-leaderboard-item${isGold ? ' alias-leaderboard-item--gold' : ''}">
              <span class="alias-rank">${rank}</span>
              <div class="alias-leaderboard-body">
                <div class="alias-leaderboard-top">
                  <div>
                    <div class="alias-name">${escapeHtml(entry.nickname)}</div>
                    <div class="alias-real-name">${escapeHtml(entry.player)}</div>
                  </div>
                  <div class="alias-leaderboard-stats">
                    <span class="alias-avg">${entry.avgScore ?? '—'}</span>
                    <span class="alias-games-meta">${entry.gamesPlayed} game${entry.gamesPlayed === 1 ? '' : 's'}</span>
                  </div>
                </div>
                <div class="alias-bar-track" aria-hidden="true">
                  <div class="alias-bar-fill" style="width:${pct}%"></div>
                </div>
                ${oneTime ? '<span class="alias-badge">one-time only</span>' : ''}
              </div>
            </li>
          `;
        }).join('')}
      </ol>
    `;
  }

  function renderAliasCards(lucky, cursed) {
    if (!lucky && !cursed) {
      return '<p class="text-muted">No custom aliases yet for this player.</p>';
    }
    return `
      <div class="alias-card-row">
        <div class="alias-luck-card alias-luck-card--lucky">
          <div class="alias-luck-label">Lucky alias</div>
          <div class="alias-luck-name">${escapeHtml(lucky?.nickname ?? '—')}</div>
          <div class="alias-luck-stat">${lucky?.avgScore ?? '—'} avg · ${lucky?.gamesPlayed ?? 0} games</div>
        </div>
        <div class="alias-luck-card alias-luck-card--cursed">
          <div class="alias-luck-label">Cursed alias</div>
          <div class="alias-luck-name">${escapeHtml(cursed?.nickname ?? '—')}</div>
          <div class="alias-luck-stat">${cursed?.avgScore ?? '—'} avg · ${cursed?.gamesPlayed ?? 0} games</div>
        </div>
      </div>
    `;
  }

  function renderNicknameTable(stats) {
    if (!stats.length) {
      return '<p class="text-muted">No alias rows to show.</p>';
    }
    return `
      <div class="alias-table-wrap">
        <table class="data-table alias-table">
          <thead>
            <tr>
              <th>Nickname</th>
              <th class="text-right">Games</th>
              <th class="text-right">Avg</th>
              <th class="text-right">Best game</th>
              <th class="text-right">W/L</th>
            </tr>
          </thead>
          <tbody>
            ${stats.map(s => {
              const sessions = new Set(
                data
                  .filter(g =>
                    g.player === selectedPlayer &&
                    String(g.nickname || '').trim() === s.nickname
                  )
                  .map(g => g.date)
              ).size;
              const losses = Math.max(0, sessions - (s.wins || 0));
              return `
                <tr>
                  <td><strong>${escapeHtml(s.nickname)}</strong></td>
                  <td class="text-right">${s.gamesPlayed}</td>
                  <td class="text-right">${s.avgScore ?? '—'}</td>
                  <td class="text-right">${s.highGame ?? '—'}</td>
                  <td class="text-right">${s.wins ?? 0}–${losses}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderFunStatsBar(fun) {
    return `
      <div class="alias-fun-bar">
        <div class="alias-fun-card">
          <div class="alias-fun-label">Most nicknames used</div>
          <div class="alias-fun-value">${escapeHtml(fun.mostNicknames.player)}</div>
          <div class="alias-fun-sub">${fun.mostNicknames.count} alias${fun.mostNicknames.count === 1 ? '' : 'es'}</div>
        </div>
        <div class="alias-fun-card">
          <div class="alias-fun-label">Biggest alter ego effect</div>
          <div class="alias-fun-value">${escapeHtml(fun.biggestEffect.player)}</div>
          <div class="alias-fun-sub">${fun.biggestEffect.variance ? `±${fun.biggestEffect.variance} avg spread` : 'Need 2+ aliases'}</div>
        </div>
        <div class="alias-fun-card">
          <div class="alias-fun-label">Most consistent</div>
          <div class="alias-fun-value">${escapeHtml(fun.mostConsistent.player)}</div>
          <div class="alias-fun-sub">${fun.mostConsistent.variance != null ? `±${fun.mostConsistent.variance} avg spread` : 'Need 2+ aliases'}</div>
        </div>
        <div class="alias-fun-card">
          <div class="alias-fun-label">Best single-game alias</div>
          <div class="alias-fun-value">${escapeHtml(fun.bestSingle.nickname)}</div>
          <div class="alias-fun-sub">${escapeHtml(fun.bestSingle.player)} · ${fun.bestSingle.score || '—'}</div>
        </div>
      </div>
    `;
  }

  function render(container) {
    destroy();

    if (!BowlingData.hasData()) {
      container.innerHTML = '<div class="empty-state"><h3>No data yet</h3><p>Load scores to explore aliases.</p></div>';
      return;
    }

    const data = BowlingData.getData();
    const players = BowlingData.getPlayers();
    const uniqueNicknames = countUniqueNicknames(data);

    if (uniqueNicknames < 3) {
      container.innerHTML = `
        <div class="empty-state-card alias-empty-card">
          <div class="empty-state-icon" aria-hidden="true">🎭</div>
          <h2>Not enough alias data yet</h2>
          <p>Keep using different nicknames each session to unlock this page.</p>
          <p class="text-muted alias-empty-count">${uniqueNicknames} of 3 unique nicknames collected so far.</p>
        </div>
      `;
      return;
    }

    if (!selectedPlayer || !players.includes(selectedPlayer)) {
      selectedPlayer = players[0];
    }

    const fun = computeFunStats(data, players);

    container.innerHTML = `
      <section class="panel alias-section">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">All-time alias hall of fame</h2>
            <p class="panel-sub">Ranked by average score · group avg ${fun.overallAvg}</p>
          </div>
        </div>
        ${renderLeaderboard(fun.groupStats, fun.overallAvg)}
      </section>

      <section class="alias-section">
        <div class="player-tabs" id="aliasPlayerTabs">
          ${players.map(p => `
            <button type="button"
              class="player-tab-btn${p === selectedPlayer ? ' active' : ''}"
              data-player="${escapeHtml(p)}"
              style="--tab-color:${BowlingUtils.getPlayerColor(p)}">
              <span class="legend-dot" style="background:${BowlingUtils.getPlayerColor(p)}"></span>
              ${escapeHtml(p)}
            </button>
          `).join('')}
        </div>
        <div id="aliasPlayerPanel"></div>
      </section>

      <section class="alias-section">
        ${renderFunStatsBar(fun)}
      </section>
    `;

    function renderPlayerPanel() {
      const panel = document.getElementById('aliasPlayerPanel');
      if (!panel) return;

      const stats = getExplicitPlayerStats(data, selectedPlayer);
      const lucky = stats[0] || null;
      const cursed = stats.length ? stats[stats.length - 1] : null;
      const color = BowlingUtils.getPlayerColor(selectedPlayer);
      const chartId = 'aliasBubbleChart';

      panel.innerHTML = `
        <div class="alias-player-block">
          ${renderAliasCards(lucky, cursed)}
          <div class="panel alias-chart-panel">
            <div class="panel-header">
              <div>
                <h3 class="panel-title">Alias map</h3>
                <p class="panel-sub">Size = best game · position = frequency vs average</p>
              </div>
            </div>
            <div class="chart-wrap chart-wrap--alias-bubble">
              <canvas id="${chartId}"></canvas>
            </div>
          </div>
          ${renderNicknameTable(stats)}
        </div>
      `;

      buildBubbleChart(chartId, stats, color);
    }

    renderPlayerPanel();

    document.getElementById('aliasPlayerTabs')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-player]');
      if (!btn) return;
      selectedPlayer = btn.dataset.player;
      document.querySelectorAll('#aliasPlayerTabs .player-tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.player === selectedPlayer);
      });
      destroy();
      renderPlayerPanel();
    });
  }

  return { render, destroy };
})();
