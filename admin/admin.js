/**
 * Lane Legends Admin — unified score entry, validation, and CSV management
 */
const AdminApp = (() => {
  const SCORES_PATH = '../data/scores.csv';
  const DRAFT_KEY = 'laneLegendsAdminDraft_v1';
  const LIST_LIMIT = 80;
  let rows = [];
  let games = [];
  let currentGameId = null;
  let currentPlayerIdx = 0;
  let dirty = false;
  let photoUrl = null;
  let fileHandle = null;
  let searchQuery = '';
  let listShowCount = LIST_LIMIT;

  const DEFAULT_PLAYERS = [
    { player: 'Mattheus', nickname: 'SHREKK' },
    { player: 'Emily', nickname: 'EMLIE' },
    { player: 'Shelley', nickname: 'MAFUS' },
  ];

  function $(id) { return document.getElementById(id); }

  function showToast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  }

  function markDirty() {
    dirty = true;
    $('btnSave').disabled = false;
    updateValidationBar();
    persistDraft();
  }

  function persistDraft() {
    try {
      syncToRows();
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ rows, savedAt: Date.now() }));
    } catch (_) {}
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
  }

  function rowsToGames(rowList) {
    return BowlingCore.groupRowsByGame(rowList).map(g => ({
      game_id: g.game_id || BowlingCore.generateGameId(),
      date: g.date || '',
      lane: g.lane || '',
      session_game: g.session_game || '',
      completed_time: g.completed_time || '',
      players: g.players.map(p => ({
        player: p.player,
        nickname: p.nickname,
        balls: p.balls || BowlingCore.emptyBalls(),
      })),
    }));
  }

  function gamesToRows(gameList) {
    return BowlingCore.flattenGames(gameList);
  }

  function syncFromRows() {
    games = rowsToGames(rows);
  }

  function syncToRows() {
    rows = gamesToRows(games);
  }

  function getCurrentGame() {
    return games.find(g => g.game_id === currentGameId) || null;
  }

  function gameStatus(game) {
    const gameRows = BowlingCore.flattenGames([game]);
    let worst = 'green';
    for (const row of gameRows) {
      const v = BowlingCore.validateRow(row);
      if (v.status === 'red') return 'red';
      if (v.status === 'yellow') worst = 'yellow';
    }
    return worst;
  }

  function overallValidation() {
    syncToRows();
    const dups = BowlingCore.findDuplicateKeys(rows);
    const issues = [];
    let red = 0;
    let yellow = 0;

    rows.forEach((row, i) => {
      const v = BowlingCore.validateRow(row);
      if (v.status === 'red') red++;
      else if (v.status === 'yellow') yellow++;
    });

    if (dups.length) issues.push(`${dups.length} duplicate row(s)`);
    if (red) issues.push(`${red} invalid row(s)`);
    else if (yellow) issues.push(`${yellow} row(s) with warnings`);

    return {
      ok: !red && !dups.length,
      message: issues.length ? issues.join(' · ') : `${rows.length} rows — all valid`,
      red,
      dups,
    };
  }

  function updateValidationBar() {
    const v = overallValidation();
    const bar = $('validationBar');
    bar.textContent = v.message;
    bar.className = 'validation-bar ' + (v.ok ? 'ok' : v.red ? 'err' : 'warn');
  }

  function suggestSessionGame(date) {
    const sameDay = games.filter(g => g.date === date && g.session_game);
    if (!sameDay.length) return 1;
    return Math.max(...sameDay.map(g => parseInt(g.session_game, 10) || 0)) + 1;
  }

  function compareGames(a, b) {
    const dc = (b.date || '').localeCompare(a.date || '');
    if (dc !== 0) return dc;
    return (parseInt(a.session_game, 10) || 999) - (parseInt(b.session_game, 10) || 999);
  }

  function displayLabel(p) {
    const nick = (p.nickname || '').trim();
    const pl = (p.player || '').trim();
    if (nick && pl && nick.toUpperCase() !== pl.toUpperCase()) return `${nick} (${pl})`;
    return nick || pl || 'Player';
  }

  function renderGameList() {
    const list = $('gameList');
    const q = searchQuery.toLowerCase();
    const filtered = games
      .filter(g => {
        if (!q) return true;
        const hay = [
          g.date, g.lane, g.session_game, g.game_id,
          ...g.players.map(p => `${p.player} ${p.nickname}`),
        ].join(' ').toLowerCase();
        return hay.includes(q);
      })
      .sort(compareGames);

    if (!filtered.length) {
      list.innerHTML = '<p style="padding:1rem;color:var(--muted);font-size:0.85rem">No games found.</p>';
      return;
    }

    const showing = filtered.slice(0, listShowCount);
    const hidden = filtered.length - showing.length;

    list.innerHTML = showing.map(g => {
      const st = gameStatus(g);
      const scores = g.players.map(p => {
        const sc = BowlingCore.scoreGame(p.balls).total;
        return `${displayLabel(p)}: ${sc ?? '—'}`;
      }).join(', ');
      const active = g.game_id === currentGameId ? ' active' : '';
      return `
        <div class="game-item${active}" data-id="${esc(g.game_id)}">
          <div class="game-item-title">
            <span class="status-dot ${st}"></span>
            ${BowlingCore.formatDate(g.date)} · Lane ${g.lane || '?'} · G${g.session_game || '?'}
          </div>
          <div class="game-item-meta">${esc(scores)}</div>
        </div>`;
    }).join('');

    if (hidden > 0) {
      list.innerHTML += `<div class="list-more">${hidden} more — refine search or <button type="button" id="btnShowMore">show all ${filtered.length}</button></div>`;
      $('btnShowMore')?.addEventListener('click', () => {
        listShowCount = filtered.length;
        renderGameList();
      });
    }

    list.querySelectorAll('.game-item').forEach(el => {
      el.addEventListener('click', () => selectGame(el.dataset.id));
    });
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function selectGame(id) {
    currentGameId = id;
    currentPlayerIdx = 0;
    renderGameList();
    renderEditor();
  }

  function newGame() {
    const today = new Date().toISOString().slice(0, 10);
    const game = {
      game_id: BowlingCore.generateGameId(),
      date: today,
      lane: '',
      session_game: String(suggestSessionGame(today)),
      completed_time: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
      players: DEFAULT_PLAYERS.map(p => ({
        ...p,
        balls: BowlingCore.emptyBalls(),
      })),
    };
    games.unshift(game);
    markDirty();
    selectGame(game.game_id);
  }

  function deleteGame() {
    const g = getCurrentGame();
    if (!g || !confirm('Delete this game and all player scores?')) return;
    games = games.filter(x => x.game_id !== g.game_id);
    currentGameId = games[0]?.game_id || null;
    markDirty();
    renderGameList();
    renderEditor();
  }

  function isBallDisabled(balls, frame, ballIdx) {
    if (frame < 9) {
      return ballIdx === 1 && (balls[BowlingCore.frameSlot(frame, 0)] || '').toUpperCase() === 'X';
    }
    const s0 = balls[BowlingCore.frameSlot(9, 0)] || '';
    const s1 = balls[BowlingCore.frameSlot(9, 1)] || '';
    if (ballIdx === 0) return false;
    if (ballIdx === 1) return !s0;
    if (!s0) return true;
    if (s0.toUpperCase() === 'X') return !s1;
    if (!s1) return true;
    if (s1 === '/') return false;
    return true;
  }

  function renderEditor() {
    const editor = $('editor');
    const game = getCurrentGame();

    if (!game) {
      editor.innerHTML = `
        <div class="empty-editor">
          <p>Select a game from the list or create a new one.</p>
          <p style="margin-top:0.75rem"><button type="button" class="primary" id="btnNewEmpty">+ New Game</button></p>
        </div>`;
      $('btnNewEmpty')?.addEventListener('click', newGame);
      $('editorTitle').textContent = 'Score Admin';
      return;
    }

    const player = game.players[currentPlayerIdx];
    const { total, frameTotals } = BowlingCore.scoreGame(player.balls);

    $('editorTitle').textContent = `${BowlingCore.formatDate(game.date)} — Lane ${game.lane || '?'} — Game ${game.session_game || '?'}`;

    editor.innerHTML = `
      <div class="meta-grid">
        <label>Date<input type="date" id="metaDate" value="${isoDate(game.date)}"></label>
        <label>Lane<input type="number" id="metaLane" min="1" max="99" value="${esc(game.lane)}"></label>
        <label>Session #<input type="number" id="metaSession" min="1" max="99" value="${esc(game.session_game)}"></label>
        <label>Time<input type="time" id="metaTime" value="${esc(game.completed_time)}"></label>
      </div>
      <div class="editor-layout">
        <div>
          <div class="player-tabs" id="playerTabs"></div>
          <div class="player-fields">
            <label>Nickname<input type="text" id="playerNick" value="${esc(player.nickname)}"></label>
            <label>Player<input type="text" id="playerName" value="${esc(player.player)}"></label>
            <button type="button" id="btnAddPlayer">+ Player</button>
            <button type="button" class="danger" id="btnRemovePlayer">Remove player</button>
          </div>
          <div class="scoreboard-wrap">
            <div class="frames" id="framesGrid"></div>
          </div>
          <div style="display:flex;align-items:center;gap:1rem;margin-top:0.5rem">
            <span style="color:var(--muted);font-size:0.85rem">Final score</span>
            <span class="final-score" id="finalScore">${total ?? '—'}</span>
          </div>
          <details class="quick-paste">
            <summary>Quick paste (compact notation)</summary>
            <textarea id="quickPaste" placeholder="Example: 4- 0-7 0- 5- 3-5 X- 0- 3-6"></textarea>
            <button type="button" id="btnQuickPaste" style="margin-top:0.5rem">Apply to current player</button>
          </details>
        </div>
        <div class="photo-panel">
          <h3>Scoreboard photo</h3>
          <div id="photoArea"></div>
          <input type="file" id="photoInput" accept="image/*" hidden>
          <button type="button" id="btnPhoto" style="margin-top:0.5rem;width:100%">Upload photo</button>
          <button type="button" id="btnClearPhoto" style="margin-top:0.35rem;width:100%">Clear photo</button>
        </div>
      </div>
      <div style="margin-top:1rem;display:flex;gap:0.5rem">
        <button type="button" class="danger" id="btnDeleteGame">Delete game</button>
      </div>`;

    // Meta bindings
    $('metaDate').addEventListener('change', e => { game.date = e.target.value; markDirty(); renderGameList(); });
    $('metaLane').addEventListener('change', e => { game.lane = e.target.value; markDirty(); renderGameList(); });
    $('metaSession').addEventListener('change', e => { game.session_game = e.target.value; markDirty(); renderGameList(); });
    $('metaTime').addEventListener('change', e => { game.completed_time = e.target.value; markDirty(); });

    $('playerNick').addEventListener('input', e => {
      player.nickname = e.target.value.trim();
      const resolved = resolvePlayerFromNickname(player.nickname);
      if (resolved && !$('playerName').value.trim()) {
        player.player = resolved;
        $('playerName').value = resolved;
      }
      markDirty();
      renderPlayerTabs(game);
    });
    $('playerName').addEventListener('input', e => { player.player = e.target.value.trim(); markDirty(); });

    $('btnAddPlayer').addEventListener('click', () => {
      game.players.push({ player: '', nickname: '', balls: BowlingCore.emptyBalls() });
      currentPlayerIdx = game.players.length - 1;
      markDirty();
      renderEditor();
    });
    $('btnRemovePlayer').addEventListener('click', () => {
      if (game.players.length <= 1) { alert('Need at least one player.'); return; }
      game.players.splice(currentPlayerIdx, 1);
      currentPlayerIdx = Math.max(0, currentPlayerIdx - 1);
      markDirty();
      renderEditor();
    });
    $('btnDeleteGame').addEventListener('click', deleteGame);

    renderPlayerTabs(game);
    renderFramesGrid(game, player, frameTotals);
    renderPhotoPanel();

    $('btnPhoto').addEventListener('click', () => $('photoInput').click());
    $('photoInput').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      photoUrl = URL.createObjectURL(file);
      renderPhotoPanel();
      e.target.value = '';
    });
    $('btnClearPhoto').addEventListener('click', () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      photoUrl = null;
      renderPhotoPanel();
    });

    $('btnQuickPaste')?.addEventListener('click', () => {
      const text = $('quickPaste')?.value?.trim();
      if (!text) return;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 1) {
        player.balls = BowlingCore.parseCompactLine(lines[0]);
      } else {
        lines.forEach((line, i) => {
          if (game.players[i]) game.players[i].balls = BowlingCore.parseCompactLine(line);
        });
      }
      markDirty();
      renderEditor();
      showToast('Applied pasted scores');
    });
  }

  function isoDate(d) {
    if (!d) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const p = d.split('/');
    if (p.length === 3) return `${p[2]}-${p[0].padStart(2, '0')}-${p[1].padStart(2, '0')}`;
    return d;
  }

  function renderPlayerTabs(game) {
    const tabs = $('playerTabs');
    tabs.innerHTML = game.players.map((p, i) => {
      const sc = BowlingCore.scoreGame(p.balls).total;
      const row = BowlingCore.ballsToRowDict(game, p);
      const st = BowlingCore.validateRow(row).status;
      return `<button type="button" class="player-tab ${i === currentPlayerIdx ? 'active' : ''} ${st !== 'green' ? 'invalid' : ''}" data-idx="${i}">${esc(displayLabel(p))}${sc != null ? ` (${sc})` : ''}</button>`;
    }).join('');
    tabs.querySelectorAll('.player-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        currentPlayerIdx = parseInt(tab.dataset.idx, 10);
        renderEditor();
      });
    });
  }

  function renderFramesGrid(game, player, frameTotals) {
    const grid = $('framesGrid');
    grid.innerHTML = '';
    for (let f = 0; f < 10; f++) {
      const frameEl = document.createElement('div');
      frameEl.className = 'frame' + (f === 9 ? ' frame-10' : '');
      frameEl.innerHTML = `<div class="frame-num">${f + 1}</div>`;
      const ballsRow = document.createElement('div');
      ballsRow.className = 'frame-balls';
      const count = f === 9 ? 3 : 2;
      for (let b = 0; b < count; b++) {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'ball-input';
        inp.maxLength = 2;
        inp.dataset.frame = f;
        inp.dataset.ball = b;
        const slot = BowlingCore.frameSlot(f, b);
        inp.value = player.balls[slot] || '';
        inp.disabled = isBallDisabled(player.balls, f, b);
        if (inp.value.toUpperCase() === 'X') inp.classList.add('strike');
        if (inp.value === '/') inp.classList.add('spare');
        inp.addEventListener('input', onBallInput);
        inp.addEventListener('keydown', onBallKeydown);
        ballsRow.appendChild(inp);
      }
      frameEl.appendChild(ballsRow);
      const tot = document.createElement('div');
      tot.className = 'frame-total' + (frameTotals[f] != null ? ' filled' : '');
      tot.textContent = frameTotals[f] ?? '';
      frameEl.appendChild(tot);
      grid.appendChild(frameEl);
    }
  }

  function onBallInput(e) {
    const inp = e.target;
    let v = inp.value.toUpperCase().replace(/SPARE/g, '/');
    if (v.length > 1 && v !== '10') v = v.slice(-1);
    if (v && !/^[0-9X\/]$/.test(v)) { inp.value = ''; return; }

    const frame = parseInt(inp.dataset.frame, 10);
    const ball = parseInt(inp.dataset.ball, 10);
    const game = getCurrentGame();
    const player = game.players[currentPlayerIdx];
    const slot = BowlingCore.frameSlot(frame, ball);

    if (frame === 9) {
      if (ball === 0) {
        player.balls[BowlingCore.frameSlot(9, 1)] = '';
        player.balls[BowlingCore.frameSlot(9, 2)] = '';
      } else if (ball === 1) {
        player.balls[BowlingCore.frameSlot(9, 2)] = '';
      }
    } else if (ball === 0 && v === 'X') {
      player.balls[BowlingCore.frameSlot(frame, 0)] = 'X';
      player.balls[BowlingCore.frameSlot(frame, 1)] = '';
      markDirty();
      renderEditor();
      return;
    }

    player.balls[slot] = v === '10' ? 'X' : v;
    markDirty();
    renderEditor();
  }

  function onBallKeydown(e) {
    if (e.key === 'Enter') e.preventDefault();
  }

  function renderPhotoPanel() {
    const area = $('photoArea');
    if (!area) return;
    if (photoUrl) {
      area.innerHTML = `<img src="${photoUrl}" alt="Scoreboard reference">`;
    } else {
      area.innerHTML = '<div class="photo-placeholder">Upload a photo to reference while transcribing</div>';
    }
  }

  async function loadScores() {
    try {
      const draftRaw = localStorage.getItem(DRAFT_KEY);
      if (draftRaw) {
        try {
          const draft = JSON.parse(draftRaw);
          if (draft?.rows?.length) {
            if (confirm('Unsaved draft found. Restore draft instead of reloading from server?')) {
              rows = draft.rows;
              syncFromRows();
              dirty = true;
              $('btnSave').disabled = false;
              renderGameList();
              renderEditor();
              updateValidationBar();
              showToast(`Restored draft (${rows.length} rows)`);
              return;
            }
            clearDraft();
          }
        } catch (_) {}
      }

      const resp = await fetch(SCORES_PATH + '?t=' + Date.now());
      if (!resp.ok) throw new Error('Fetch failed');
      const text = await resp.text();
      ingestText(text, { fromServer: true });
      showToast(`Loaded ${rows.length} rows`);
    } catch (_) {
      $('validationBar').textContent = 'Could not load data/scores.csv — use Load CSV or run from local server (Open Admin.bat)';
      $('validationBar').className = 'validation-bar warn';
    }
  }

  function ingestText(text, { fromServer = false } = {}) {
    rows = BowlingCore.parseCSVText(text);
    syncFromRows();
    dirty = false;
    $('btnSave').disabled = true;
    if (fromServer) clearDraft();
    listShowCount = LIST_LIMIT;
    if (games.length && !currentGameId) currentGameId = games.sort(compareGames)[0]?.game_id;
    renderGameList();
    renderEditor();
    updateValidationBar();
  }

  function importBulkGames() {
    const text = $('bulkText').value.trim();
    if (!text) { alert('Paste at least one game.'); return; }
    const imported = BowlingCore.parseBulkGames(text);
    if (!imported.length) {
      alert('Could not parse any games. Check the format.');
      return;
    }
    games.unshift(...imported);
    markDirty();
    $('bulkModal').classList.add('hidden');
    $('bulkText').value = '';
    selectGame(imported[0].game_id);
    showToast(`Imported ${imported.length} game(s)`);
  }

  async function saveScores() {
    syncToRows();
    const v = overallValidation();
    if (!v.ok && !confirm(`Dataset has issues (${v.message}). Save anyway?`)) return;

    const csv = BowlingCore.rowsToCSV(rows);

    if (fileHandle && 'createWritable' in fileHandle) {
      try {
        const writable = await fileHandle.createWritable();
        await writable.write(csv);
        await writable.close();
        dirty = false;
        $('btnSave').disabled = true;
        clearDraft();
        showToast('Saved to data/scores.csv');
        return;
      } catch (_) { /* fall through */ }
    }

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'scores.csv',
          startIn: 'downloads',
          types: [{ description: 'CSV', accept: { 'text/csv': ['.csv'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(csv);
        await writable.close();
        fileHandle = handle;
        dirty = false;
        $('btnSave').disabled = true;
        clearDraft();
        showToast('Saved — replace data/scores.csv in repo and git push');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'scores.csv';
    a.click();
    dirty = false;
    $('btnSave').disabled = true;
    clearDraft();
    showToast('Downloaded scores.csv — move to data/ and git push');
  }

  async function pickCsvFile() {
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'CSV', accept: { 'text/csv': ['.csv'] } }],
        });
        fileHandle = handle;
        const file = await handle.getFile();
        ingestText(await file.text());
        showToast('Loaded from file');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }
    $('fileInput').click();
  }

  function init() {
    $('btnNew').addEventListener('click', newGame);
    $('btnSave').addEventListener('click', saveScores);
    $('btnReload').addEventListener('click', loadScores);
    $('btnLoadFile').addEventListener('click', pickCsvFile);
    $('btnBulk').addEventListener('click', () => $('bulkModal').classList.remove('hidden'));
    $('btnBulkClose').addEventListener('click', () => $('bulkModal').classList.add('hidden'));
    $('btnBulkApply').addEventListener('click', importBulkGames);
    $('btnSave').disabled = true;

    $('searchInput').addEventListener('input', e => {
      searchQuery = e.target.value;
      listShowCount = LIST_LIMIT;
      renderGameList();
    });

    $('fileInput').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { ingestText(reader.result); showToast('Loaded CSV'); };
      reader.readAsText(file);
      e.target.value = '';
    });

    window.addEventListener('beforeunload', e => {
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    });

    loadScores();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => AdminApp.init());
