/**
 * Lane Legends — router and app init
 */
const App = (() => {
  const routes = {
    overview: {
      title: 'Season overview',
      subtitle: '',
      page: OverviewPage,
      customHeader: true,
    },
    player: {
      title: 'Player Dive',
      subtitle: 'Deep stats for individual bowlers',
      page: PlayerPage,
    },
    frames: {
      title: 'Frame Analysis',
      subtitle: 'Pin patterns across all 10 frames',
      page: FramesPage,
    },
    h2h: {
      title: 'Head-to-Head',
      subtitle: 'Direct matchup records and differentials',
      page: HeadToHeadPage,
    },
    sessions: {
      title: 'Sessions',
      subtitle: 'Game-by-game breakdown by bowling day',
      page: SessionsPage,
    },
    aliases: {
      title: 'Alter egos',
      subtitle: 'Does the name make the bowler?',
      page: AliasesPage,
    },
  };

  const THEME_KEY = 'laneLegendsTheme';
  let currentRoute = 'overview';
  let activePage = null;
  let isFirstNav = true;

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function getRouteFromHash() {
    const hash = location.hash.replace('#', '').toLowerCase();
    return routes[hash] ? hash : 'overview';
  }

  function updateNav(route) {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.route === route);
    });
  }

  function updateHeader(route) {
    const cfg = routes[route];
    if (!cfg.customHeader) {
      document.getElementById('pageTitle').textContent = cfg.title;
      document.getElementById('pageSubtitle').textContent = cfg.subtitle;
    }

    const meta = document.getElementById('headerMeta');
    if (BowlingData.hasData()) {
      const games = BowlingData.getGames().length;
      const players = [...new Set(BowlingData.getData().map(r => r.player))].length;
      meta.textContent = `${games} games · ${players} players`;
    } else {
      meta.textContent = '';
    }
  }

  function updateLegend() {
    const ul = document.getElementById('playerLegend');
    if (!BowlingData.hasData()) {
      ul.innerHTML = '<li class="text-muted" style="font-size:0.75rem;color:var(--sidebar-muted)">No players loaded</li>';
      return;
    }
    ul.innerHTML = BowlingData.getPlayers().map(p => `
      <li>
        <span class="legend-dot" style="background:${BowlingUtils.getPlayerColor(p)}"></span>
        ${p}
      </li>
    `).join('');
  }

  function renderEmptyState(container) {
    document.getElementById('pageTitle').textContent = 'Welcome';
    document.getElementById('pageSubtitle').textContent = 'Get started with your bowling stats';
    container.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-state-icon" aria-hidden="true">🎳</div>
        <h2>No bowling data yet</h2>
        <p>Add your game scores to <code>data/scores.csv</code> to populate the dashboard.</p>
        <ul class="empty-state-steps">
          <li>Export games from the score entry tool, or copy <code>data/sample_data.csv</code> as a template.</li>
          <li>Each row is one player&rsquo;s completed game with frame-by-frame ball results.</li>
          <li>Save the file, refresh this page, or use <strong>Load CSV</strong> in the sidebar.</li>
        </ul>
      </div>
    `;
  }

  function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('loading-overlay--hidden');
    overlay.setAttribute('aria-busy', 'false');
  }

  async function navigate(route, { skipTransition = false } = {}) {
    if (!routes[route]) route = 'overview';

    const container = document.getElementById('pageContent');
    const shouldAnimate = !skipTransition && !isFirstNav;

    if (shouldAnimate) {
      container.classList.add('page-content--fade-out');
      await wait(150);
    }

    Object.values(routes).forEach(r => r.page.destroy?.());

    currentRoute = route;
    activePage = routes[route].page;
    updateNav(route);
    updateLegend();

    if (!BowlingData.hasData()) {
      renderEmptyState(container);
    } else {
      updateHeader(route);
      activePage.render(container);
    }

    container.classList.remove('page-content--fade-out');
    isFirstNav = false;
  }

  function onHashChange() {
    navigate(getRouteFromHash());
  }

  async function loadData() {
    try {
      await BowlingData.loadCSV();
    } catch (_) {
      /* file:// or missing file — user can upload via sidebar */
    }
    hideLoading();
    await navigate(getRouteFromHash(), { skipTransition: true });
  }

  function setupFileUpload() {
    document.getElementById('csvFileInput').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        BowlingData.loadFromText(reader.result);
        navigate(currentRoute);
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }

  function updateThemeToggle(theme) {
    const btn = document.getElementById('themeToggle');
    const icon = btn.querySelector('.theme-toggle-icon');
    const text = btn.querySelector('.theme-toggle-text');
    if (theme === 'dark') {
      icon.textContent = '☀️';
      text.textContent = 'Light mode';
      btn.setAttribute('aria-label', 'Switch to light mode');
    } else {
      icon.textContent = '🌙';
      text.textContent = 'Dark mode';
      btn.setAttribute('aria-label', 'Switch to dark mode');
    }
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const theme = saved === 'dark' || saved === 'light'
      ? saved
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeToggle(theme);
  }

  function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    updateThemeToggle(next);
    BowlingUtils.chartDefaults();
    if (BowlingData.hasData()) navigate(currentRoute, { skipTransition: true });
  }

  function init() {
    initTheme();
    BowlingUtils.chartDefaults();
    setupFileUpload();
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    window.addEventListener('hashchange', onHashChange);

    if (!location.hash) location.hash = '#overview';
    loadData();
  }

  return { init, navigate };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
