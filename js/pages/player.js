/**
 * Player Dive page
 */
const PlayerPage = (() => {
  let charts = [];
  let selectedPlayer = null;
  let activePopover = null;

  function destroyCharts() {
    charts.forEach(c => BowlingUtils.destroyChart(c));
    charts = [];
    closePopover();
  }

  function closePopover() {
    if (activePopover) {
      activePopover.remove();
      activePopover = null;
    }
  }

  function getPlayers() {
    return BowlingData.getPlayers();
  }

  function calcCurrentStreak(gamesSorted, seasonAvg) {
    if (!gamesSorted.length || seasonAvg == null) return 0;
    let streak = 0;
    for (let i = gamesSorted.length - 1; i >= 0; i--) {
      if (gamesSorted[i].final_score > seasonAvg) streak++;
      else break;
    }
    return streak;
  }

  function rollingAverage(scores, window = 5) {
    return scores.map((_, i) => {
      if (i < window - 1) return null;
      const slice = scores.slice(i - window + 1, i + 1);
      return BowlingUtils.round1(BowlingUtils.avg(slice));
    });
  }

  function scoreBucket(score) {
    if (score >= 200) return '200+';
    if (score >= 180) return '180–199';
    if (score >= 160) return '160–179';
    if (score >= 140) return '140–159';
    if (score >= 120) return '120–139';
    if (score >= 100) return '100–119';
    if (score >= 80) return '80–99';
    return null;
  }

  const BUCKETS = ['80–99', '100–119', '120–139', '140–159', '160–179', '180–199', '200+'];

  function histogramCounts(scores) {
    const counts = Object.fromEntries(BUCKETS.map(b => [b, 0]));
    for (const s of scores) {
      const b = scoreBucket(s);
      if (b) counts[b]++;
    }
    return BUCKETS.map(b => counts[b]);
  }

  function getFrameBreakdown(games, frameIdx) {
    let strikes = 0;
    let spares = 0;
    let opens = 0;
    const firstBalls = [];

    for (const game of games) {
      const frame = game.frames[frameIdx];
      if (!frame || frame.balls[0] == null) continue;
      firstBalls.push(frame.balls[0]);
      if (frame.isStrike) strikes++;
      else if (frame.isSpare) spares++;
      else opens++;
    }

    const total = strikes + spares + opens;
    return {
      avgPins: BowlingUtils.round1(BowlingUtils.avg(firstBalls)),
      strikePct: total ? BowlingUtils.round1((strikes / total) * 100) : 0,
      sparePct: total ? BowlingUtils.round1((spares / total) * 100) : 0,
      openPct: total ? BowlingUtils.round1((opens / total) * 100) : 0,
    };
  }

  /** Lighter tint = higher avg (0–10) */
  function heatmapBg(avg, accent) {
    if (avg == null) return '#eef0f5';
    const t = Math.max(0, Math.min(1, avg / 10));
    const r = parseInt(accent.slice(1, 3), 16);
    const g = parseInt(accent.slice(3, 5), 16);
    const b = parseInt(accent.slice(5, 7), 16);
    const mix = (c) => Math.round(c + (255 - c) * (0.25 + t * 0.65));
    return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
  }

  function textColorForBg(avg) {
    return avg != null && avg < 4 ? '#fff' : 'var(--text)';
  }

  function render(container) {
    destroyCharts();
    closePopover();

    if (!BowlingData.hasData()) {
      container.innerHTML = '<div class="empty-state"><h3>No data yet</h3><p>Load scores.csv to dive into player stats.</p></div>';
      return;
    }

    const players = getPlayers();
    if (!selectedPlayer || !players.includes(selectedPlayer)) {
      selectedPlayer = players[0];
    }

    const data = BowlingData.getData();
    const color = BowlingUtils.getPlayerColor(selectedPlayer);
    const stats = BowlingUtils.getPlayerStats(data, selectedPlayer);
    const playerGames = [...stats.games].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    const scores = playerGames.map(g => g.final_score).filter(s => s != null);
    const streak = calcCurrentStreak(playerGames, stats.avgScore);
    const rolling = rollingAverage(scores);
    const labels = playerGames.map(g => {
      const d = BowlingUtils.formatDate(g.date).replace(/, \d{4}/, '');
      return g.session_game ? `${d} G${g.session_game}` : d;
    });
    const funFacts = BowlingUtils.generateFunFacts(data, selectedPlayer);

    const frameAvgs = stats.avgByFrame ?? Array(10).fill(null);
    const frameCells = frameAvgs.map((avg, i) => ({
      frame: i + 1,
      avg,
      breakdown: getFrameBreakdown(playerGames, i),
      bg: heatmapBg(avg, color),
    }));

    const sessionKeys = Object.keys(stats.avgBySessionGame)
      .map(Number)
      .sort((a, b) => a - b);
    const sessionLabels = sessionKeys.map(k => `Game ${k}`);
    const sessionAvgs = sessionKeys.map(k => stats.avgBySessionGame[k]);

    container.innerHTML = `
      <div class="player-tabs" role="tablist">
        ${players.map(p => `
          <button type="button" class="player-tab-btn${p === selectedPlayer ? ' active' : ''}"
            data-player="${p}" role="tab" aria-selected="${p === selectedPlayer}"
            style="--tab-color:${BowlingUtils.getPlayerColor(p)}">
            <span class="legend-dot" style="background:${BowlingUtils.getPlayerColor(p)}"></span>
            ${p}
          </button>
        `).join('')}
      </div>

      <div class="kpi-grid player-hero-row">
        <div class="kpi-card">
          <div class="kpi-label">Season avg</div>
          <div class="kpi-value" style="color:${color}">${stats.avgScore != null ? stats.avgScore.toFixed(1) : '—'}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Personal best</div>
          <div class="kpi-value">${stats.highGame ?? '—'}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Total games</div>
          <div class="kpi-value">${stats.totalGames}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Current streak</div>
          <div class="kpi-value">${streak}<small> above avg</small></div>
        </div>
      </div>

      <div class="panel player-panel">
        <div class="panel-header">
          <div>
            <div class="panel-title">Rolling average</div>
            <div class="panel-sub">5-game rolling avg · faint dots = raw scores</div>
          </div>
        </div>
        <div class="chart-wrap chart-wrap--rolling">
          <canvas id="chartRolling"></canvas>
        </div>
      </div>

      <div class="panel player-panel">
        <div class="panel-header">
          <div>
            <div class="panel-title">Frame performance</div>
            <div class="panel-sub">Avg first-ball pins · click a frame for details</div>
          </div>
        </div>
        <div class="frame-heatmap" id="frameHeatmap">
          ${frameCells.map((cell, i) => `
            <button type="button" class="frame-heatmap-cell" data-frame-idx="${i}"
              style="background:${cell.bg};color:${textColorForBg(cell.avg)}"
              aria-label="Frame ${cell.frame}">
              <span class="frame-heatmap-num">F${cell.frame}</span>
              <span class="frame-heatmap-avg">${cell.avg ?? '—'}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="chart-grid player-mid-grid">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">Ball distribution</div>
            <div class="panel-sub">Frame outcome breakdown</div>
          </div>
          <div class="chart-wrap chart-wrap--donut">
            <canvas id="chartDonut"></canvas>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">Score distribution</div>
            <div class="panel-sub">Games by score range</div>
          </div>
          <div class="chart-wrap chart-wrap--donut">
            <canvas id="chartHistogram"></canvas>
          </div>
        </div>
      </div>

      <div class="panel player-panel">
        <div class="panel-header">
          <div>
            <div class="panel-title">By session position</div>
            <div class="panel-sub">Avg score in game 1 vs 2 vs 3 of the night</div>
          </div>
        </div>
        <div class="chart-wrap chart-wrap--session">
          <canvas id="chartSessionPos"></canvas>
        </div>
      </div>

      ${funFacts.length ? `
        <div class="fun-facts-section">
          <h3 class="fun-facts-heading">Fun facts</h3>
          <div class="fun-facts-grid">
            ${funFacts.map(f => `
              <blockquote class="fun-fact-card" style="border-left-color:${color}">
                ${f}
              </blockquote>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;

    container.querySelectorAll('.player-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedPlayer = btn.dataset.player;
        render(container);
      });
    });

    const heatmap = container.querySelector('#frameHeatmap');
    heatmap?.addEventListener('click', e => {
      const cell = e.target.closest('.frame-heatmap-cell');
      if (!cell) return;
      closePopover();

      const idx = parseInt(cell.dataset.frameIdx, 10);
      const bd = getFrameBreakdown(playerGames, idx);
      const pop = document.createElement('div');
      pop.className = 'frame-popover';
      pop.innerHTML = `
        <div class="frame-popover-title">Frame ${idx + 1}</div>
        <div class="frame-popover-row"><span>Avg pins</span><strong>${bd.avgPins ?? '—'}</strong></div>
        <div class="frame-popover-row"><span>Strike</span><strong>${bd.strikePct}%</strong></div>
        <div class="frame-popover-row"><span>Spare</span><strong>${bd.sparePct}%</strong></div>
        <div class="frame-popover-row"><span>Open</span><strong>${bd.openPct}%</strong></div>
      `;

      const rect = cell.getBoundingClientRect();
      const host = container.getBoundingClientRect();
      pop.style.left = `${rect.left - host.left + rect.width / 2}px`;
      pop.style.top = `${rect.bottom - host.top + 6}px`;
      container.style.position = 'relative';
      container.appendChild(pop);
      activePopover = pop;

      setTimeout(() => {
        document.addEventListener('click', function handler(ev) {
          if (!pop.contains(ev.target) && !cell.contains(ev.target)) {
            closePopover();
            document.removeEventListener('click', handler);
          }
        });
      }, 0);
    });

    const seasonAvg = stats.avgScore ?? 0;

    charts.push(new Chart(document.getElementById('chartRolling'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Raw score',
            data: scores,
            borderColor: 'transparent',
            backgroundColor: color + '55',
            pointRadius: 4,
            pointHoverRadius: 5,
            showLine: false,
            order: 2,
          },
          {
            label: '5-game rolling avg',
            data: rolling,
            borderColor: color,
            backgroundColor: color + '22',
            borderWidth: 2.5,
            tension: 0.35,
            pointRadius: 0,
            spanGaps: true,
            fill: true,
            order: 1,
          },
          {
            label: 'Season avg',
            data: labels.map(() => seasonAvg),
            borderColor: '#9aa3b2',
            borderDash: [6, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
            order: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 10, filter: item => item.text !== 'Raw score' || item.datasetIndex === 0 },
          },
          tooltip: {
            filter: item => item.datasetIndex !== 2 || item.dataIndex === 0,
          },
        },
        scales: {
          y: { beginAtZero: false, min: 40, grid: { color: '#eef0f5' } },
          x: { grid: { display: false }, ticks: { maxRotation: 45, font: { size: 10 } } },
        },
      },
    }));

    charts.push(new Chart(document.getElementById('chartDonut'), {
      type: 'doughnut',
      data: {
        labels: [
          `Strike ${stats.strikeRate ?? 0}%`,
          `Spare ${stats.spareRate ?? 0}%`,
          `Open ${stats.openRate ?? 0}%`,
        ],
        datasets: [{
          data: [stats.strikeRate ?? 0, stats.spareRate ?? 0, stats.openRate ?? 0],
          backgroundColor: [color, color + '99', color + '44'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '58%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10 } },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.label}`,
            },
          },
        },
      },
    }));

    charts.push(new Chart(document.getElementById('chartHistogram'), {
      type: 'bar',
      data: {
        labels: BUCKETS,
        datasets: [{
          label: 'Games',
          data: histogramCounts(scores),
          backgroundColor: color,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#eef0f5' } },
          x: { grid: { display: false } },
        },
      },
    }));

    if (sessionKeys.length) {
      charts.push(new Chart(document.getElementById('chartSessionPos'), {
        type: 'bar',
        data: {
          labels: sessionLabels,
          datasets: [{
            label: 'Avg score',
            data: sessionAvgs,
            backgroundColor: color,
            borderRadius: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: false, min: 40, grid: { color: '#eef0f5' } },
            x: { grid: { display: false } },
          },
        },
      }));
    }
  }

  return { render, destroy: destroyCharts };
})();
