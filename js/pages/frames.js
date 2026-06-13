/**
 * Frame Analysis page
 */
const FramesPage = (() => {
  let charts = [];
  let playerFilter = 'all';
  let metric = 'firstBall';
  let tooltipEl = null;

  const METRICS = {
    firstBall: { label: 'First ball avg', key: 'avgFirstBall', max: 10, suffix: '' },
    strike: { label: 'Strike %', key: 'strikePct', max: 100, suffix: '%' },
    spare: { label: 'Spare conversion %', key: 'spareConversionPct', max: 100, suffix: '%' },
  };

  function destroyCharts() {
    charts.forEach(c => BowlingUtils.destroyChart(c));
    charts = [];
    hideTooltip();
  }

  function hideTooltip() {
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }
  }

  function getPlayers() {
    return BowlingData.getPlayers();
  }

  function getFilteredGames(data) {
    if (playerFilter === 'all') return data;
    return data.filter(g => g.player === playerFilter);
  }

  function computeFrameStats(games, frameIdx) {
    const firstBalls = [];
    let strikes = 0;
    let spareOpportunities = 0;
    let spareConverted = 0;
    let total = 0;

    for (const game of games) {
      const frame = game.frames[frameIdx];
      if (!frame || frame.balls[0] == null) continue;
      total++;
      firstBalls.push(frame.balls[0]);
      if (frame.isStrike) {
        strikes++;
      } else {
        spareOpportunities++;
        if (frame.isSpare) spareConverted++;
      }
    }

    return {
      avgFirstBall: BowlingUtils.round1(BowlingUtils.avg(firstBalls)),
      strikePct: total ? BowlingUtils.round1((strikes / total) * 100) : null,
      spareConversionPct: spareOpportunities
        ? BowlingUtils.round1((spareConverted / spareOpportunities) * 100)
        : null,
      sampleSize: total,
    };
  }

  function computeAllFrameStats(data, games) {
    return Array.from({ length: 10 }, (_, i) => computeFrameStats(games, i));
  }

  function computePlayerFrameStats(data, player) {
    const games = data.filter(g => g.player === player);
    return computeAllFrameStats(data, games);
  }

  function findWorstFrames(data) {
    const players = getPlayers();
    const worst = {};
    for (const p of players) {
      const stats = computePlayerFrameStats(data, p);
      let worstIdx = 0;
      let worstVal = Infinity;
      stats.forEach((s, i) => {
        if (s.avgFirstBall != null && s.avgFirstBall < worstVal) {
          worstVal = s.avgFirstBall;
          worstIdx = i;
        }
      });
      worst[p] = worstIdx;
    }
    return worst;
  }

  function framesWithWarnings(worstByPlayer) {
    const set = new Set();
    Object.values(worstByPlayer).forEach(idx => set.add(idx));
    return set;
  }

  function metricValue(stats, metricKey) {
    const cfg = METRICS[metricKey];
    return stats[cfg.key];
  }

  function heatColor(value, max, baseColor) {
    if (value == null) return '#e8eaef';
    const t = Math.max(0, Math.min(1, value / max));
    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);
    const mix = c => Math.round(c + (255 - c) * (0.2 + t * 0.65));
    return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
  }

  function buildTroubleIndex(data) {
    const games = BowlingData.getData();
    const frameStats = computeAllFrameStats(data, games);
    const ranked = frameStats
      .map((s, i) => ({ frame: i + 1, avg: s.avgFirstBall ?? 0, stats: s }))
      .sort((a, b) => a.avg - b.avg);

    const comments = [
      (f) => `Frame ${f.frame} — everyone struggles here.`,
      (f) => `Frame ${f.frame} — the group's weakest spot.`,
      (f) => `Frame ${f.frame} — pins don't fall easy.`,
      (f) => `Frame ${f.frame} — room to improve.`,
      (f) => `Frame ${f.frame} — below average for the crew.`,
    ];

    return ranked.slice(0, 5).map((item, i) => ({
      ...item,
      comment: comments[i] ? comments[i](item) : `Frame ${item.frame} — tough frame.`,
    }));
  }

  function computeTenthFrameBreakdown(data, player) {
    const games = data.filter(g => g.player === player);
    const pinTotals = [];
    let fillBalls = 0;
    let fillStrikes = 0;

    for (const game of games) {
      const f = game.frames[9];
      if (!f || !f.balls.length) continue;
      pinTotals.push(BowlingUtils.framePinTotal(f));

      const b0 = f.balls[0];
      const b1 = f.balls[1];
      const b2 = f.balls[2];

      if (b0 === 10) {
        if (b1 != null) { fillBalls++; if (b1 === 10) fillStrikes++; }
        if (b2 != null) { fillBalls++; if (b2 === 10) fillStrikes++; }
      } else if (f.isSpare && b2 != null) {
        fillBalls++;
        if (b2 === 10) fillStrikes++;
      }
    }

    const avgPins = BowlingUtils.round1(BowlingUtils.avg(pinTotals));
    return {
      player,
      avgScore: avgPins,
      pctOfMax: avgPins != null ? BowlingUtils.round1((avgPins / 30) * 100) : null,
      fillStrikePct: fillBalls ? BowlingUtils.round1((fillStrikes / fillBalls) * 100) : null,
      games: pinTotals.length,
    };
  }

  function renderLaneSvg(frameStats, worstByPlayer, warnFrames, accentColor) {
    const cfg = METRICS[metric];
    const boxW = 56;
    const gap = 8;
    const startX = 80;
    const y = 70;
    const laneW = 10 * boxW + 9 * gap;
    const svgW = laneW + 160;
    const svgH = 180;

    const boxes = frameStats.map((stats, i) => {
      const val = metricValue(stats, metric);
      const fill = heatColor(val, cfg.max, accentColor);
      const x = startX + i * (boxW + gap);
      const isWarn = warnFrames.has(i);
      const textFill = val != null && metric === 'firstBall' && val < 4 ? '#fff' : '#1a1d2e';
      const display = val != null ? `${val}${cfg.suffix}` : '—';

      return `
        <g class="lane-frame-box" data-frame-idx="${i}" tabindex="0" role="button"
           aria-label="Frame ${i + 1}">
          <rect x="${x}" y="${y}" width="${boxW}" height="${boxW}" rx="6"
            fill="${fill}" stroke="#c5cad6" stroke-width="1.5"
            class="lane-frame-rect"/>
          <text x="${x + boxW / 2}" y="${y + 22}" text-anchor="middle"
            font-size="10" fill="${textFill}" opacity="0.7" font-weight="600">F${i + 1}</text>
          <text x="${x + boxW / 2}" y="${y + 40}" text-anchor="middle"
            font-size="13" fill="${textFill}" font-weight="700">${display}</text>
          ${isWarn ? `<text x="${x + boxW - 8}" y="${y + 14}" text-anchor="middle"
            font-size="11" fill="#d85a30">⚠</text>` : ''}
        </g>
      `;
    }).join('');

    return `
      <svg viewBox="0 0 ${svgW} ${svgH}" class="lane-diagram-svg" aria-label="Bowling lane frame diagram">
        <defs>
          <linearGradient id="laneGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#d4a574"/>
            <stop offset="100%" stop-color="#b8895a"/>
          </linearGradient>
        </defs>
        <rect x="${startX - 20}" y="${y - 24}" width="${laneW + 40}" height="${boxW + 48}" rx="12"
          fill="url(#laneGrad)" opacity="0.35"/>
        <rect x="${startX - 8}" y="${y - 12}" width="${laneW + 16}" height="${boxW + 24}" rx="8"
          fill="#c9a06c" opacity="0.5"/>
        <line x1="${startX + laneW / 2}" y1="${y + boxW + 16}" x2="${startX + laneW / 2}" y2="${svgH - 10}"
          stroke="#8b6914" stroke-width="3" stroke-linecap="round"/>
        <polygon points="${startX + laneW / 2 - 10},${svgH - 10} ${startX + laneW / 2 + 10},${svgH - 10} ${startX + laneW / 2},${svgH - 2}"
          fill="#8b6914"/>
        ${boxes}
      </svg>
    `;
  }

  function showTooltip(frameIdx, frameStats, worstByPlayer, anchorRect, container) {
    hideTooltip();
    const stats = frameStats[frameIdx];
    const players = getPlayers();
    const data = BowlingData.getData();

    const warnLines = players
      .filter(p => worstByPlayer[p] === frameIdx)
      .map(p => `<div class="lane-tooltip-warn">⚠ Weakest frame for ${p}</div>`)
      .join('');

    tooltipEl = document.createElement('div');
    tooltipEl.className = 'lane-tooltip';
    tooltipEl.innerHTML = `
      <div class="lane-tooltip-title">Frame ${frameIdx + 1}</div>
      <div class="lane-tooltip-row"><span>Avg first ball</span><strong>${stats.avgFirstBall ?? '—'}</strong></div>
      <div class="lane-tooltip-row"><span>Strike %</span><strong>${stats.strikePct ?? '—'}%</strong></div>
      <div class="lane-tooltip-row"><span>Spare conversion</span><strong>${stats.spareConversionPct ?? '—'}%</strong></div>
      ${warnLines}
    `;

    const host = container.getBoundingClientRect();
    tooltipEl.style.left = `${anchorRect.left - host.left + anchorRect.width / 2}px`;
    tooltipEl.style.top = `${anchorRect.top - host.top - 8}px`;
    container.style.position = 'relative';
    container.appendChild(tooltipEl);
  }

  function render(container) {
    destroyCharts();

    if (!BowlingData.hasData()) {
      container.innerHTML = '<div class="empty-state"><h3>No data yet</h3><p>Load scores.csv for frame-by-frame analysis.</p></div>';
      return;
    }

    const data = BowlingData.getData();
    const players = getPlayers();
    const filteredGames = getFilteredGames(data);
    const frameStats = computeAllFrameStats(data, filteredGames);
    const worstByPlayer = findWorstFrames(data);
    const warnFrames = framesWithWarnings(worstByPlayer);
    const accentColor = playerFilter === 'all'
      ? '#7c6fff'
      : BowlingUtils.getPlayerColor(playerFilter);
    const troubleIndex = buildTroubleIndex(data);
    const tenthBreakdown = players.map(p => computeTenthFrameBreakdown(data, p));

    container.innerHTML = `
      <div class="frames-controls">
        <div class="frames-toggle-group">
          <span class="frames-toggle-label">Player</span>
          <div class="frames-toggle-btns">
            <button type="button" class="frames-toggle-btn${playerFilter === 'all' ? ' active' : ''}"
              data-player="all">All Players</button>
            ${players.map(p => `
              <button type="button" class="frames-toggle-btn${playerFilter === p ? ' active' : ''}"
                data-player="${p}" style="--tab-color:${BowlingUtils.getPlayerColor(p)}">
                <span class="legend-dot" style="background:${BowlingUtils.getPlayerColor(p)}"></span>${p}
              </button>
            `).join('')}
          </div>
        </div>
        <div class="frames-toggle-group">
          <span class="frames-toggle-label">Metric</span>
          <div class="frames-toggle-btns">
            ${Object.entries(METRICS).map(([key, cfg]) => `
              <button type="button" class="frames-toggle-btn${metric === key ? ' active' : ''}"
                data-metric="${key}">${cfg.label}</button>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="panel frames-lane-panel">
        <div class="panel-header">
          <div>
            <div class="panel-title">Lane diagram</div>
            <div class="panel-sub">${METRICS[metric].label}${playerFilter === 'all' ? ' · all players' : ` · ${playerFilter}`} · hover for details</div>
          </div>
        </div>
        <div class="lane-diagram-wrap" id="laneDiagram">
          ${renderLaneSvg(frameStats, worstByPlayer, warnFrames, accentColor)}
        </div>
      </div>

      <div class="panel frames-panel">
        <div class="panel-header">
          <div>
            <div class="panel-title">Frame comparison</div>
            <div class="panel-sub">${METRICS[metric].label} by player</div>
          </div>
        </div>
        <div class="chart-wrap chart-wrap--frames-bar">
          <canvas id="chartFrameGrouped"></canvas>
        </div>
      </div>

      <div class="frames-bottom-grid">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">Frame trouble index</div>
            <div class="panel-sub">Hardest frames for the group</div>
          </div>
          <ol class="trouble-list">
            ${troubleIndex.map((item, i) => `
              <li class="trouble-item">
                <span class="trouble-rank">${i + 1}</span>
                <div>
                  <div class="trouble-frame">Frame ${item.frame} · ${item.avg} avg first ball</div>
                  <div class="trouble-comment">${item.comment}</div>
                </div>
              </li>
            `).join('')}
          </ol>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">10th frame breakdown</div>
            <div class="panel-sub">Up to 3 balls · max 30 pins</div>
          </div>
          <div class="tenth-breakdown">
            ${tenthBreakdown.map(row => `
              <div class="tenth-player-row">
                <div class="tenth-player-name">
                  <span class="legend-dot" style="background:${BowlingUtils.getPlayerColor(row.player)}"></span>
                  ${row.player}
                </div>
                <div class="tenth-stat">
                  <span class="tenth-stat-val">${row.avgScore ?? '—'}</span>
                  <span class="tenth-stat-lbl">avg / 30</span>
                </div>
                <div class="tenth-stat">
                  <span class="tenth-stat-val">${row.fillStrikePct ?? '—'}%</span>
                  <span class="tenth-stat-lbl">fill strike</span>
                </div>
                <div class="tenth-stat">
                  <span class="tenth-stat-val">${row.pctOfMax ?? '—'}%</span>
                  <span class="tenth-stat-lbl">of max</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll('[data-player]').forEach(btn => {
      btn.addEventListener('click', () => {
        playerFilter = btn.dataset.player;
        render(container);
      });
    });

    container.querySelectorAll('[data-metric]').forEach(btn => {
      btn.addEventListener('click', () => {
        metric = btn.dataset.metric;
        render(container);
      });
    });

    const laneDiagram = container.querySelector('#laneDiagram');
    laneDiagram?.querySelectorAll('.lane-frame-box').forEach(box => {
      const idx = parseInt(box.dataset.frameIdx, 10);
      box.addEventListener('mouseenter', () => {
        const rect = box.querySelector('.lane-frame-rect').getBoundingClientRect();
        showTooltip(idx, frameStats, worstByPlayer, rect, container);
      });
      box.addEventListener('mouseleave', hideTooltip);
      box.addEventListener('focus', () => {
        const rect = box.querySelector('.lane-frame-rect').getBoundingClientRect();
        showTooltip(idx, frameStats, worstByPlayer, rect, container);
      });
      box.addEventListener('blur', hideTooltip);
    });

    const metricCfg = METRICS[metric];
    const playerStatsMap = players.map(p => ({
      name: p,
      color: BowlingUtils.getPlayerColor(p),
      stats: computePlayerFrameStats(data, p),
    }));

    charts.push(new Chart(document.getElementById('chartFrameGrouped'), {
      type: 'bar',
      data: {
        labels: Array.from({ length: 10 }, (_, i) => `F${i + 1}`),
        datasets: playerStatsMap.map(({ name, color, stats }) => ({
          label: name,
          data: stats.map(s => metricValue(s, metric)),
          backgroundColor: color,
          borderRadius: 3,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10 } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const v = ctx.parsed.y;
                return `${ctx.dataset.label}: ${v ?? '—'}${metricCfg.suffix}`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: metric === 'firstBall' ? 10 : 100,
            grid: { color: '#eef0f5' },
            ticks: {
              callback: v => `${v}${metricCfg.suffix}`,
            },
          },
          x: { grid: { display: false } },
        },
      },
    }));
  }

  return { render, destroy: destroyCharts };
})();
