import { Radio } from './radio.js';

const MAX_RENDERED_RESULTS = 150;

const PLAY_ICON = '<path d="M8 5.5v13l11-6.5-11-6.5z"/>';
const PAUSE_ICON = '<path d="M8 5.5h3v13H8z"/><path d="M13 5.5h3v13h-3z"/>';

const browserState = {
  query: '',
  region: 'all',
  initialized: false,
};

function buildIconSvg(pathMarkup) {
  return `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor">${pathMarkup}</svg>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderStationInfo(state) {
  const station = state.currentStation;
  const badge = document.getElementById('radio-disc-label');
  if (!station) {
    document.getElementById('radio-station-name').textContent = Radio.EMPTY_MESSAGE;
    document.getElementById('radio-station-desc').textContent = '到「設定 → 資料備份」匯入電台清單 JSON';
    if (badge) badge.style.background = '';
    return;
  }
  document.getElementById('radio-station-name').textContent = station.name;
  document.getElementById('radio-station-desc').textContent = station.description || '';
  if (badge) {
    badge.style.background = `linear-gradient(135deg, ${station.gradient[0]}, ${station.gradient[1]})`;
  }
}

function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch (err) {
        reject(new Error('無法解析這個 JSON 檔案，請確認檔案未損毀'));
      }
    };
    reader.onerror = () => reject(new Error('讀取檔案時發生錯誤'));
    reader.readAsText(file);
  });
}

function setImportStatus(message, type) {
  ['radio-import-status', 'radio-status'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message;
    el.className = 'io-status' + (type === 'success' ? ' is-success' : type === 'error' ? ' is-error' : '');
  });
}

function renderStationsSummary() {
  const el = document.getElementById('radio-stations-summary');
  if (!el) return;
  const count = Radio.getStations().length;
  el.textContent = count
    ? `目前有 ${count} 個電台，清單只存在這台裝置的瀏覽器裡。`
    : '還沒有電台清單。匯入一個 JSON 檔（電台陣列，每一台需要 id、name、streamUrl），清單只會存在這台裝置的瀏覽器裡。';
}

function initStationImport() {
  const input = document.getElementById('radio-import-input');
  const importBtn = document.getElementById('radio-import-btn');
  const clearBtn = document.getElementById('radio-clear-btn');
  if (!input) return;

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-radio-import]')) input.click();
  });
  if (importBtn) importBtn.addEventListener('click', () => input.click());
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      Radio.clearStations();
      setImportStatus('已清除電台清單', 'default');
    });
  }

  input.addEventListener('change', async () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    try {
      const count = Radio.importStations(await readJsonFile(file));
      setImportStatus(`已匯入 ${count} 個電台`, 'success');
    } catch (err) {
      setImportStatus(err.message, 'error');
    }
  });

  renderStationsSummary();
}

function rebuildBrowser() {
  const chipsEl = document.getElementById('radio-region-chips');
  if (chipsEl) delete chipsEl.dataset.built;
  browserState.initialized = false;
  browserState.query = '';
  const searchInput = document.getElementById('radio-search-input');
  if (searchInput) searchInput.value = '';
  initBrowser(Radio.getState());
  renderStationsSummary();
}

function renderNowPlaying(state) {
  const el = document.getElementById('radio-now-playing');
  if (!el) return;
  if (state.metadata && state.metadata.nowPlaying) {
    el.hidden = false;
    el.textContent = `現正播放：${state.metadata.nowPlaying}`;
  } else {
    el.hidden = true;
    el.textContent = '';
  }
}

function renderPlayState(state) {
  const btn = document.getElementById('radio-play-btn');
  const disc = document.getElementById('radio-disc');
  const deck = document.getElementById('radio-deck');
  if (!btn || !disc || !deck) return;

  btn.innerHTML = buildIconSvg(state.isPlaying ? PAUSE_ICON : PLAY_ICON);
  btn.setAttribute('aria-label', state.isPlaying ? '暫停' : '播放');
  disc.classList.toggle('is-playing', state.isPlaying);
  deck.classList.toggle('is-playing', state.isPlaying);
}

function renderStatus(state) {
  const el = document.getElementById('radio-status');
  if (!el) return;
  if (state.error) {
    el.textContent = state.error;
    el.className = 'io-status is-error';
  } else {
    el.textContent = '';
    el.className = 'io-status';
  }
}

function renderVolume(state) {
  const slider = document.getElementById('radio-volume');
  if (!slider) return;
  if (document.activeElement !== slider) {
    slider.value = Math.round(state.volume * 100);
  }
}

function renderRegionChips() {
  const chipsEl = document.getElementById('radio-region-chips');
  if (!chipsEl || chipsEl.dataset.built === '1') return;

  if (!chipsEl.dataset.bound) {
    chipsEl.dataset.bound = '1';
    chipsEl.addEventListener('click', (event) => {
      const btn = event.target.closest('.radio-chip');
      if (!btn) return;
      browserState.region = btn.dataset.region;
      renderStationList();
      highlightActiveChip();
    });
  }

  if (!Radio.hasStations()) {
    chipsEl.innerHTML = '';
    return;
  }

  const regions = Radio.getRegions();
  const specialChips = `
    <button type="button" class="radio-chip radio-chip--special" data-region="__favorites__">★ 最愛<span class="radio-chip__count" id="radio-fav-count">${Radio.getFavorites().length}</span></button>
    <button type="button" class="radio-chip radio-chip--special" data-region="__recent__"><svg class="radio-chip__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg> 最近<span class="radio-chip__count" id="radio-recent-count">${Radio.getRecents().length}</span></button>
  `;
  const allChip = `<button type="button" class="radio-chip" data-region="all">全部</button>`;
  const chips = regions
    .map((r) => `<button type="button" class="radio-chip" data-region="${escapeHtml(r.region)}">${escapeHtml(r.region)}<span class="radio-chip__count">${r.count}</span></button>`)
    .join('');
  chipsEl.innerHTML = specialChips + allChip + chips;
  chipsEl.dataset.built = '1';
}

function highlightActiveChip() {
  const chipsEl = document.getElementById('radio-region-chips');
  if (!chipsEl) return;
  chipsEl.querySelectorAll('.radio-chip').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.region === browserState.region);
  });
}

function matchesQuery(station) {
  const q = browserState.query.trim().toLowerCase();
  if (!q) return true;
  return station.name.toLowerCase().includes(q) || station.id.toLowerCase().includes(q);
}

function renderStationList() {
  const listEl = document.getElementById('radio-station-list');
  const countEl = document.getElementById('radio-result-count');
  if (!listEl || !countEl) return;

  if (!Radio.hasStations()) {
    countEl.textContent = '';
    listEl.innerHTML = `<div class="radio-browser__empty">${Radio.EMPTY_MESSAGE}<br><button type="button" class="btn btn--secondary btn--sm" data-radio-import>匯入電台清單</button></div>`;
    return;
  }

  const state = Radio.getState();
  let results;
  let emptyHint = '試試別的關鍵字或分類';

  if (browserState.region === '__favorites__') {
    results = Radio.getFavorites().filter(matchesQuery);
    emptyHint = '還沒有加入最愛的電台，點清單右邊的星星試試';
  } else if (browserState.region === '__recent__') {
    results = Radio.getRecents().filter(matchesQuery);
    emptyHint = '還沒有播放紀錄，選一台聽聽看吧';
  } else {
    const regionFilter = browserState.region === 'all' ? null : browserState.region;
    results = Radio.searchStations(browserState.query, regionFilter);
  }

  countEl.textContent = results.length === 0
    ? '沒有符合的電台'
    : results.length > MAX_RENDERED_RESULTS
      ? `共 ${results.length} 個，顯示前 ${MAX_RENDERED_RESULTS} 筆（輸入關鍵字可縮小範圍）`
      : `共 ${results.length} 個`;

  const shown = results.slice(0, MAX_RENDERED_RESULTS);
  if (shown.length === 0) {
    listEl.innerHTML = `<div class="radio-browser__empty">${emptyHint}</div>`;
    return;
  }

  listEl.innerHTML = shown.map((s) => {
    const isFav = Radio.isFavorite(s.id);
    return `
    <div class="radio-station-item${s.id === state.currentStationId ? ' is-active' : ''}">
      <button type="button" class="radio-station-item__main" data-station-id="${escapeHtml(s.id)}">
        <span class="radio-station-item__name">${escapeHtml(s.name)}</span>
        <span class="radio-station-item__region">${escapeHtml(s.region)}</span>
      </button>
      <button type="button" class="radio-station-item__star${isFav ? ' is-fav' : ''}" data-fav-id="${escapeHtml(s.id)}" aria-label="${isFav ? '移除最愛' : '加入最愛'}">${isFav ? '★' : '☆'}</button>
    </div>
  `;
  }).join('');
}

function initBrowser(state) {
  if (!browserState.initialized) {
    browserState.region = (state.currentStation && state.currentStation.region) || 'all';
    browserState.initialized = true;
  }

  renderRegionChips();
  highlightActiveChip();
  renderStationList();

  const searchInput = document.getElementById('radio-search-input');
  const listEl = document.getElementById('radio-station-list');

  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = '1';
    searchInput.addEventListener('input', () => {
      browserState.query = searchInput.value;
      renderStationList();
    });
  }

  if (listEl && !listEl.dataset.bound) {
    listEl.dataset.bound = '1';
    listEl.addEventListener('click', (event) => {
      const favBtn = event.target.closest('.radio-station-item__star');
      if (favBtn) {
        Radio.toggleFavorite(favBtn.dataset.favId);
        renderStationList();
        return;
      }
      const playBtn = event.target.closest('.radio-station-item__main');
      if (!playBtn) return;
      Radio.play(playBtn.dataset.stationId);
    });
  }
}

function render(state) {
  renderStationInfo(state);
  renderNowPlaying(state);
  renderPlayState(state);
  renderStatus(state);
  renderVolume(state);

  const favCountEl = document.getElementById('radio-fav-count');
  const recentCountEl = document.getElementById('radio-recent-count');
  if (favCountEl) favCountEl.textContent = Radio.getFavorites().length;
  if (recentCountEl) recentCountEl.textContent = Radio.getRecents().length;

  if (browserState.region === '__recent__') {
    renderStationList();
    return;
  }

  document.querySelectorAll('.radio-station-item.is-active').forEach((el) => el.classList.remove('is-active'));
  if (!state.currentStationId) return;
  const activeBtn = document.querySelector(`.radio-station-item__main[data-station-id="${CSS.escape(state.currentStationId)}"]`);
  if (activeBtn) activeBtn.closest('.radio-station-item').classList.add('is-active');
}

function initRadioWindow() {
  if (!Radio) return;

  const playBtn = document.getElementById('radio-play-btn');
  const volumeSlider = document.getElementById('radio-volume');
  const disc = document.getElementById('radio-disc');

  if (playBtn) {
    playBtn.addEventListener('click', () => Radio.togglePlay());
  }
  if (disc) {
    disc.addEventListener('click', () => Radio.togglePlay());
  }
  if (volumeSlider) {
    volumeSlider.addEventListener('input', () => {
      Radio.setVolume(Number(volumeSlider.value) / 100);
    });
  }

  const initialState = Radio.getState();
  renderStationInfo(initialState);
  renderNowPlaying(initialState);
  renderPlayState(initialState);
  renderStatus(initialState);
  renderVolume(initialState);
  initBrowser(initialState);
  initStationImport();

  Radio.subscribe(render);
  window.addEventListener('yoworingo:radio-stations-change', rebuildBrowser);
}

export function boot() {
  try {
    initRadioWindow();
  } catch (err) {
    console.error('Life Ledger：電台模組初始化失敗（不影響其他功能）', err);
  }
}
