import { createMotion } from '../../motion/animator.js';
import { MotionSettings } from '../../motion/presets.js';
import { Storage } from '../../core/storage/storage.js';
import { createSegmented } from '../../ui/segmented.js';
import { createSlider } from '../../ui/controls.js';
import { createRowList } from '../../ui/rows.js';
import { createStage } from '../../ui/stage.js';
import { Fx } from '../../ui/fx-tier.js';
import { Radio } from './radio.js';
import { createYtLists } from './yt-lists.js';
import { loadApi, lookup, nextIndex, parseYouTube, previousIndex } from './youtube.js';

const MODES = ['station', 'yt'];
const MODE_KEY = 'yoworingo.v2.radio-mode';
const WIDE_REM = 34;
const XL_REM = 52;
const MAX_STATIONS = 150;
const SPIN = 33.3 * 6;
const PIP_W = 356;
const PIP_H = 200;
const PIP_BAR = 34;
const STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function blur(t, max) {
  return t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * max).toFixed(2)}px)` : '';
}

function rem() {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

function spring(config) {
  return MotionSettings.reduced ? MotionSettings.spring('focus') : config;
}

function readJson(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch (err) {
        reject(new Error('這個檔案不是有效的 JSON'));
      }
    };
    reader.onerror = () => reject(new Error('讀取檔案失敗'));
    reader.readAsText(file);
  });
}

export function createRadioApp({ root, area, island, dialogs, store, wm, menubar }) {
  const win = root.closest('.wm-window');
  const $ = (name) => root.querySelector(`[data-rd="${name}"]`);
  Radio.loadStations();
  const lists = createYtLists();

  let mode = MODES.includes(Storage.get(MODE_KEY, 'station')) ? Storage.get(MODE_KEY, 'station') : 'station';
  let wide = false;
  let xl = false;
  let filter = 'all';
  let query = '';

  root.dataset.mode = mode;

  function shake(el) {
    if (MotionSettings.reduced) return;
    const motion = createMotion({ x: 0 }, { response: 0.3, damping: 0.3, restDelta: 0.05 });
    motion.onUpdate(({ x }) => {
      el.style.transform = Math.abs(x) < 0.05 ? '' : `translate3d(${x}px, 0, 0)`;
    });
    motion.to({ x: 0 }, { velocity: { x: 520 } });
  }

  function swapText(el, text) {
    if (el.dataset.target === text) return;
    el.dataset.target = text;
    if (MotionSettings.reduced || !el.textContent) {
      el.textContent = text;
      return;
    }
    if (!el._swap) {
      el._swap = createMotion({ e: 1 }, { response: 0.3, damping: 1, restDelta: 0.002 });
      el._swap.onUpdate(({ e }) => {
        const t = clamp01(e);
        el.style.opacity = t > 0.999 ? '' : String(t);
        el.style.filter = blur(t, 4);
      });
    }
    el._swap.to({ e: 0 }, { response: 0.14, damping: 1 }).then(() => {
      el.textContent = el.dataset.target;
      el._swap.to({ e: 1 }, { response: 0.34, damping: 0.8 });
    });
  }

  function setPlayIcon(button, playing) {
    button.classList.toggle('is-playing', playing);
    button.setAttribute('aria-label', playing ? '暫停' : '播放');
  }

  const segment = createSegmented($('mode'), {
    onChange(index) {
      setMode(MODES[index]);
    },
  });
  if (mode === 'yt') segment.select(1);

  function setMode(next) {
    if (mode === next) return;
    mode = next;
    root.dataset.mode = mode;
    Storage.set(MODE_KEY, mode);
    root.querySelectorAll(`.rd-view--${mode === 'yt' ? 'yt' : 'station'}`).forEach((view, i) => {
      if (MotionSettings.reduced) return;
      const motion = createMotion({ e: 0 }, { response: 0.42, damping: 0.74, restDelta: 0.002 });
      motion.onUpdate(({ e }) => {
        const t = clamp01(e);
        view.style.opacity = t > 0.999 ? '' : String(t);
        view.style.transform = t > 0.999 ? '' : `translate3d(${(1 - e) * (mode === 'yt' ? 16 : -16)}px, 0, 0)`;
        view.style.filter = blur(t, 4);
      });
      motion.set({ e: 0 });
      window.setTimeout(() => motion.to({ e: 1 }, { response: 0.42, damping: 0.74 }), i * 50);
    });
    syncLayer(true);
    syncMenubar();
  }

  const disc = $('disc');
  const arm = $('arm');
  const label = $('label');
  const labelText = $('label-text');
  const stationName = $('station-name');
  const stationMeta = $('station-meta');
  const stationPlay = $('station-play');
  const favButton = $('fav');
  const stationsEl = $('stations');
  const chipsEl = $('chips');
  const stationEmpty = $('station-empty');
  const searchInput = $('search');

  const spin = createMotion({ v: 0 }, { response: 1.1, damping: 1, restDelta: 0.5 });
  let angle = 0;
  let spinning = false;
  let last = 0;
  function spinFrame(now) {
    const dt = last ? Math.min(0.064, (now - last) / 1000) : 0;
    last = now;
    angle = (angle + spin.get('v') * dt) % 360;
    disc.style.transform = `rotate(${angle.toFixed(2)}deg)`;
    if (spin.get('v') > 0.5 || radioPlaying) window.requestAnimationFrame(spinFrame);
    else {
      spinning = false;
      last = 0;
    }
  }

  const armMotion = createMotion({ a: 0 }, { response: 0.7, damping: 0.62, restDelta: 0.05 });
  armMotion.onUpdate(({ a }) => {
    arm.style.transform = `rotate(${a.toFixed(2)}deg)`;
  });

  let radioPlaying = false;
  function setRadioPlaying(on) {
    if (on === radioPlaying) return;
    radioPlaying = on;
    armMotion.to({ a: on ? 24 : 0 }, spring({ response: 0.7, damping: 0.62 }));
    if (MotionSettings.reduced) return;
    spin.to({ v: on ? SPIN : 0 }, { response: on ? 1.4 : 1.1, damping: 1 });
    if (!spinning) {
      spinning = true;
      window.requestAnimationFrame(spinFrame);
    }
  }

  function stationTag(station) {
    const meta = Radio.getState().metadata;
    if (meta && meta.nowPlaying) return meta.nowPlaying;
    return station ? station.description || station.region : '';
  }

  function renderStationNow(state) {
    const station = state.currentStation;
    const has = Radio.hasStations();
    swapText(stationName, station ? station.name : '還沒有電台');
    swapText(stationMeta, state.error || (has ? stationTag(station) : '匯入你的電台清單後就能收聽'));
    stationMeta.classList.toggle('is-error', !!state.error);
    labelText.textContent = station ? station.name : 'RingoOS';
    if (station) label.style.background = `linear-gradient(135deg, ${station.gradient[0]}, ${station.gradient[1]})`;
    favButton.classList.toggle('is-on', !!station && Radio.isFavorite(station.id));
    favButton.setAttribute('aria-pressed', String(!!station && Radio.isFavorite(station.id)));
    favButton.disabled = !station;
    setPlayIcon(stationPlay, state.isPlaying);
    setRadioPlaying(state.isPlaying);
  }

  function renderChips() {
    const regions = Radio.getRegions();
    const chips = [['all', '全部'], ['fav', '收藏'], ['recent', '最近'], ...regions.map((r) => [r.region, r.region])];
    chipsEl.textContent = '';
    chips.forEach(([value, text]) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip chip--sm';
      chip.setAttribute('role', 'radio');
      chip.setAttribute('aria-checked', String(value === filter));
      chip.dataset.value = value;
      chip.textContent = text;
      chipsEl.appendChild(chip);
    });
  }

  function visibleStations() {
    let list;
    if (filter === 'fav') list = Radio.getFavorites();
    else if (filter === 'recent') list = Radio.getRecents();
    else list = Radio.searchStations('', filter);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q));
    return list.slice(0, MAX_STATIONS);
  }

  function renderStations() {
    const state = Radio.getState();
    const has = Radio.hasStations();
    stationEmpty.hidden = has;
    root.classList.toggle('has-stations', has);
    if (!has) {
      stationsEl.textContent = '';
      return;
    }
    const list = visibleStations();
    stationsEl.textContent = '';
    list.forEach((station) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'rd-station';
      row.setAttribute('role', 'option');
      row.dataset.id = station.id;
      const current = state.currentStationId === station.id;
      row.setAttribute('aria-selected', String(current));
      row.classList.toggle('is-playing', current && state.isPlaying);
      row.innerHTML = '<span class="rd-station__dot"></span><span class="rd-station__main"><span class="rd-station__name"></span><span class="rd-station__desc"></span></span><span class="eq rd-station__eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
      row.querySelector('.rd-station__dot').style.background = `linear-gradient(135deg, ${station.gradient[0]}, ${station.gradient[1]})`;
      row.querySelector('.rd-station__name').textContent = station.name;
      row.querySelector('.rd-station__desc').textContent = station.description || station.region;
      stationsEl.appendChild(row);
    });
    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'rd-none';
      empty.textContent = filter === 'fav' ? '還沒有收藏的電台，按星星就能收藏' : filter === 'recent' ? '最近還沒聽過電台' : '找不到符合的電台';
      stationsEl.appendChild(empty);
    }
  }

  chipsEl.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    filter = chip.dataset.value;
    chipsEl.querySelectorAll('.chip').forEach((other) => other.setAttribute('aria-checked', String(other === chip)));
    renderStations();
  });

  searchInput.addEventListener('input', () => {
    query = searchInput.value;
    renderStations();
  });

  stationsEl.addEventListener('click', (event) => {
    const row = event.target.closest('.rd-station');
    if (!row) return;
    const state = Radio.getState();
    if (state.currentStationId === row.dataset.id && state.isPlaying) return;
    pauseYt();
    Radio.switchStation(row.dataset.id);
    Radio.play(row.dataset.id);
  });

  stationPlay.addEventListener('click', () => {
    if (!Radio.hasStations()) {
      shake(stationPlay);
      return;
    }
    if (!Radio.getState().isPlaying) pauseYt();
    Radio.togglePlay();
  });

  favButton.addEventListener('click', () => {
    const station = Radio.getState().currentStation;
    if (station) Radio.toggleFavorite(station.id);
  });

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json,.json';
  fileInput.hidden = true;
  root.appendChild(fileInput);
  $('import').addEventListener('click', () => fileInput.click());
  $('import-again').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const count = Radio.importStations(await readJson(file));
      filter = 'all';
      renderChips();
      renderStations();
      island.toast({ text: '已匯入電台', note: `${count} 台`, duration: 2600 });
    } catch (err) {
      island.toast({ text: err.message || '匯入失敗', duration: 4200 });
    }
  });

  Radio.subscribe((state) => {
    renderStationNow(state);
    if (state.isPlaying && ytPlaying) pauseYt();
    stationsEl.querySelectorAll('.rd-station').forEach((row) => {
      const current = state.currentStationId === row.dataset.id;
      row.setAttribute('aria-selected', String(current));
      row.classList.toggle('is-playing', current && state.isPlaying);
    });
    syncMenubar();
  });

  const volume = createSlider($('volume'), {
    min: 0,
    max: 1,
    step: 0.01,
    value: Radio.getState().volume,
    format: (v) => `${Math.round(v * 100)}%`,
    onInput(v) {
      Radio.setVolume(v);
      if (player && player.setVolume) player.setVolume(Math.round(v * 100));
    },
  });

  const slot = $('slot');
  const slotEmpty = $('slot-empty');
  const ytTitle = $('yt-title');
  const ytMeta = $('yt-meta');
  const ytPlay = $('yt-play');
  const shuffleButton = $('shuffle');
  const repeatButton = $('repeat');
  const listsEl = $('lists');
  const addForm = $('add');
  const addInput = $('add-input');
  const addState = $('add-state');
  const queueEl = $('queue');
  const listCount = $('list-count');
  const queueStage = createStage($('queue-stage'), { initial: 'rows' });

  const layer = document.createElement('div');
  layer.className = 'yt-layer';
  layer.hidden = true;
  layer.innerHTML = '<div class="yt-pip-bar"><span class="yt-pip-bar__title"></span><button type="button" class="yt-pip-bar__btn" data-pip="back" aria-label="回到電台視窗"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 9.5V13h3.5M13 6.5V3H9.5M3 13l4.2-4.2M13 3L8.8 7.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button type="button" class="yt-pip-bar__btn" data-pip="close" aria-label="停止播放"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button></div><div class="yt-frame"><div class="yt-host"></div></div>';
  area.appendChild(layer);
  const pipBar = layer.querySelector('.yt-pip-bar');
  const pipTitle = layer.querySelector('.yt-pip-bar__title');
  const frameEl = layer.querySelector('.yt-frame');

  let player = null;
  let playerReady = null;
  let ytPlaying = false;
  let ytState = -1;
  let current = null;
  let started = false;
  let layerMode = 'hidden';
  let pipOffset = { x: 0, y: 0 };

  const box = createMotion({ x: 0, y: 0, w: 0, h: 0, r: 14, o: 0 }, { response: 0.5, damping: 0.78, restDelta: { x: 0.2, y: 0.2, w: 0.2, h: 0.2, r: 0.05, o: 0.002 } });
  box.onUpdate(({ x, y, w, h, r, o }) => {
    layer.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    layer.style.width = `${Math.max(0, w)}px`;
    layer.style.height = `${Math.max(0, h)}px`;
    layer.style.borderRadius = `${r}px`;
    layer.style.opacity = String(clamp01(o));
  });

  function ensurePlayer() {
    if (playerReady) return playerReady;
    playerReady = loadApi().then((YT) => new Promise((resolve) => {
      const instance = new YT.Player(layer.querySelector('.yt-host'), {
        host: 'https://www.youtube-nocookie.com',
        width: '100%',
        height: '100%',
        playerVars: { playsinline: 1, rel: 0, autoplay: 0, origin: window.location.origin },
        events: {
          onReady() {
            instance.setVolume(Math.round(Radio.getState().volume * 100));
            resolve(instance);
          },
          onStateChange: (event) => handleState(event.data),
          onError: (event) => handleError(event.data),
        },
      });
      player = instance;
    })).catch((err) => {
      playerReady = null;
      island.toast({ text: '連不上 YouTube，檢查一下網路再試', duration: 4200 });
      throw err;
    });
    return playerReady;
  }

  function items() {
    const list = lists.active;
    return list ? list.items : [];
  }

  function currentItem() {
    if (!current) return null;
    const list = lists.lists.find((other) => other.id === current.listId);
    return list ? list.items.find((item) => item.id === current.itemId) || null : null;
  }

  function playItem(item) {
    if (!item) return;
    Radio.pause();
    current = { listId: lists.active.id, itemId: item.id };
    started = true;
    renderYtNow();
    markCurrent();
    syncLayer(true);
    ensurePlayer().then((p) => {
      if (item.kind === 'playlist') {
        p.loadPlaylist({ list: item.ref, listType: 'playlist', index: 0 });
        window.setTimeout(() => {
          try {
            p.setShuffle(lists.shuffle);
            p.setLoop(false);
          } catch (err) {}
        }, 600);
      } else {
        p.loadVideoById(item.ref);
      }
    }).catch(() => {});
  }

  function pauseYt() {
    if (player && ytPlaying && player.pauseVideo) player.pauseVideo();
  }

  function stopYt() {
    if (player && player.stopVideo) player.stopVideo();
    ytPlaying = false;
    started = false;
    current = null;
    renderYtNow();
    markCurrent();
    syncLayer(true);
    syncMenubar();
  }

  function step(direction) {
    const list = items();
    if (!list.length) return;
    const item = currentItem();
    const index = item ? list.indexOf(item) : -1;
    if (item && item.kind === 'playlist' && player) {
      const at = player.getPlaylistIndex ? player.getPlaylistIndex() : -1;
      const size = player.getPlaylist ? (player.getPlaylist() || []).length : 0;
      if (direction > 0 && at >= 0 && at < size - 1) {
        player.nextVideo();
        return;
      }
      if (direction < 0 && at > 0) {
        player.previousVideo();
        return;
      }
    }
    const options = { shuffle: lists.shuffle, repeat: lists.repeat === 'one' ? 'all' : lists.repeat };
    const target = index < 0 ? 0 : direction > 0 ? nextIndex(list.length, index, options) : previousIndex(list.length, index, options);
    if (target >= 0) playItem(list[target]);
  }

  function handleEnded() {
    const list = items();
    const item = currentItem();
    if (!item) return;
    if (lists.repeat === 'one') {
      player.seekTo(0, true);
      player.playVideo();
      return;
    }
    if (item.kind === 'playlist') {
      const at = player.getPlaylistIndex ? player.getPlaylistIndex() : -1;
      const size = player.getPlaylist ? (player.getPlaylist() || []).length : 0;
      if (at >= 0 && at < size - 1) return;
    }
    const index = list.indexOf(item);
    const target = nextIndex(list.length, index, { shuffle: lists.shuffle, repeat: lists.repeat });
    if (target >= 0) playItem(list[target]);
    else {
      ytPlaying = false;
      renderYtNow();
      syncMenubar();
    }
  }

  function handleState(code) {
    ytState = code;
    const was = ytPlaying;
    ytPlaying = code === STATE.PLAYING || code === STATE.BUFFERING;
    if (ytPlaying && !was && Radio.getState().isPlaying) Radio.pause();
    if (code === STATE.ENDED) handleEnded();
    renderYtNow();
    syncLayer();
    syncMenubar();
  }

  function handleError(code) {
    const blocked = code === 101 || code === 150;
    island.toast({ text: blocked ? '這支影片不允許在其他網站播放' : '這支影片沒辦法播放', note: '跳到下一首', duration: 3600 });
    const list = items();
    const item = currentItem();
    const index = item ? list.indexOf(item) : -1;
    const target = nextIndex(list.length, index, { shuffle: lists.shuffle, repeat: lists.repeat === 'one' ? 'off' : lists.repeat });
    if (target >= 0 && target !== index) playItem(list[target]);
  }

  function videoTitle() {
    try {
      const data = player && player.getVideoData ? player.getVideoData() : null;
      return data && data.title ? data.title : '';
    } catch (err) {
      return '';
    }
  }

  function renderYtNow() {
    const item = currentItem();
    const inner = item && item.kind === 'playlist' ? videoTitle() : '';
    const title = item ? (inner || item.title || 'YouTube') : (items().length ? '選一首開始播' : 'YouTube');
    swapText(ytTitle, title);
    const meta = item
      ? (item.kind === 'playlist' ? `播放清單 · ${item.title || ''}` : item.author || 'YouTube')
      : (lists.active ? `${lists.active.name} · ${items().length} 首` : '還沒有清單');
    swapText(ytMeta, meta);
    pipTitle.textContent = title;
    setPlayIcon(ytPlay, ytPlaying);
    slotEmpty.hidden = started;
    shuffleButton.classList.toggle('is-on', lists.shuffle);
    shuffleButton.setAttribute('aria-pressed', String(lists.shuffle));
    repeatButton.classList.toggle('is-on', lists.repeat !== 'off');
    repeatButton.classList.toggle('is-one', lists.repeat === 'one');
    repeatButton.setAttribute('aria-label', `循環：${{ off: '關閉', all: '整份清單', one: '單曲' }[lists.repeat]}`);
  }

  ytPlay.addEventListener('click', () => {
    if (ytPlaying) {
      player.pauseVideo();
      return;
    }
    if (current && player && ytState !== -1) {
      Radio.pause();
      player.playVideo();
      return;
    }
    const list = items();
    if (!list.length) {
      shake(ytPlay);
      addInput.focus();
      return;
    }
    playItem(lists.shuffle ? list[Math.floor(Math.random() * list.length)] : list[0]);
  });
  $('next').addEventListener('click', () => step(1));
  $('prev').addEventListener('click', () => step(-1));
  shuffleButton.addEventListener('click', () => {
    lists.setShuffle(!lists.shuffle);
    const item = currentItem();
    if (item && item.kind === 'playlist' && player && player.setShuffle) player.setShuffle(lists.shuffle);
    renderYtNow();
  });
  repeatButton.addEventListener('click', () => {
    lists.cycleRepeat();
    renderYtNow();
  });

  function syncMenubar() {
    if (ytPlaying) {
      menubar.setPlayingLabel(ytTitle.dataset.target || 'YouTube');
      menubar.setPlaying(true);
      return;
    }
    const state = Radio.getState();
    if (state.isPlaying && state.currentStation) {
      menubar.setPlayingLabel(state.currentStation.name);
      menubar.setPlaying(true);
      return;
    }
    menubar.setPlaying(false);
  }

  function slotRect() {
    const r = slot.getBoundingClientRect();
    const a = area.getBoundingClientRect();
    return { x: r.left - a.left, y: r.top - a.top, w: r.width, h: r.height, a };
  }

  function pipRect() {
    const a = area.getBoundingClientRect();
    const w = PIP_W;
    const h = PIP_H + PIP_BAR;
    const x = Math.max(8, Math.min(a.width - w - 8, a.width - w - 20 + pipOffset.x));
    const y = Math.max(8, Math.min(a.height - h - 8, a.height - h - 96 + pipOffset.y));
    return { x, y, w, h };
  }

  function desiredMode() {
    if (!started) return 'hidden';
    const record = store.get('radio');
    if (!record || record.state === 'closed') return 'hidden';
    if (record.state === 'open' && mode === 'yt' && slot.offsetWidth > 0 && !win.classList.contains('is-morphing')) return 'docked';
    if (record.state === 'open' && mode === 'yt') return 'morphing';
    return 'pip';
  }

  let following = false;

  function follow() {
    if (layerMode !== 'docked' || !following) {
      following = false;
      return;
    }
    const r = slotRect();
    const body = win.querySelector('.wm-window__body').getBoundingClientRect();
    const top = Math.max(0, body.top - r.a.top - r.y);
    const bottom = Math.max(0, r.y + r.h - (body.bottom - r.a.top));
    if (Math.abs(box.get('x') - r.x) > 0.5 || Math.abs(box.get('y') - r.y) > 0.5 || Math.abs(box.get('w') - r.w) > 0.5 || Math.abs(box.get('h') - r.h) > 0.5) {
      if (box.get('o') > 0.98 && !layer.dataset.landing) box.set({ x: r.x, y: r.y, w: r.w, h: r.h });
    }
    layer.style.clipPath = top || bottom ? `inset(${top}px 0 ${bottom}px 0 round 14px)` : '';
    layer.style.zIndex = win.style.zIndex || '10';
    window.requestAnimationFrame(follow);
  }

  function syncLayer(animate = false) {
    const next = desiredMode();
    if (next === 'morphing') {
      box.to({ o: 0 }, { response: 0.16, damping: 1 });
      return;
    }
    const changed = next !== layerMode;
    layerMode = next;
    layer.classList.toggle('is-pip', next === 'pip');
    pipBar.hidden = next !== 'pip';
    if (next === 'hidden') {
      box.to({ o: 0 }, { response: 0.2, damping: 1 }).then(() => {
        if (layerMode === 'hidden') layer.hidden = true;
      });
      following = false;
      return;
    }
    layer.hidden = false;
    if (next === 'docked') {
      const r = slotRect();
      layer.style.zIndex = win.style.zIndex || '10';
      if ((changed || animate) && box.get('o') > 0.05 && !MotionSettings.reduced) {
        layer.dataset.landing = '1';
        box.to({ x: r.x, y: r.y, w: r.w, h: r.h, r: 14, o: 1 }, { response: 0.5, damping: 0.78 }).then(() => { delete layer.dataset.landing; });
      } else {
        box.set({ x: r.x, y: r.y, w: r.w, h: r.h, r: 14 });
        box.to({ o: 1 }, { response: 0.24, damping: 1 });
      }
      if (!following) {
        following = true;
        window.requestAnimationFrame(follow);
      }
      return;
    }
    following = false;
    layer.style.clipPath = '';
    layer.style.zIndex = '1200';
    const r = pipRect();
    if (box.get('o') < 0.05 || MotionSettings.reduced) {
      box.set({ x: r.x, y: r.y, w: r.w, h: r.h, r: 18 });
      box.to({ o: 1 }, { response: 0.3, damping: 1 });
    } else {
      box.to({ x: r.x, y: r.y, w: r.w, h: r.h, r: 18, o: 1 }, { response: 0.55, damping: 0.74 });
    }
  }

  pipBar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-pip]');
    if (!button) return;
    if (button.dataset.pip === 'close') {
      stopYt();
      return;
    }
    if (mode !== 'yt') segment.select(1);
    wm.open('radio');
  });

  let pipDrag = null;
  pipBar.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('[data-pip]')) return;
    pipDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, ox: pipOffset.x, oy: pipOffset.y };
    try { pipBar.setPointerCapture(event.pointerId); } catch (err) {}
  });
  pipBar.addEventListener('pointermove', (event) => {
    if (!pipDrag || event.pointerId !== pipDrag.id) return;
    pipOffset = { x: pipDrag.ox + event.clientX - pipDrag.x, y: pipDrag.oy + event.clientY - pipDrag.y };
    const r = pipRect();
    box.to({ x: r.x, y: r.y }, { response: 0.1, damping: 1 });
  });
  const endPip = () => {
    if (!pipDrag) return;
    pipDrag = null;
    const r = pipRect();
    pipOffset = { x: r.x - (area.getBoundingClientRect().width - PIP_W - 20), y: r.y - (area.getBoundingClientRect().height - PIP_H - PIP_BAR - 96) };
    box.to({ x: r.x, y: r.y }, spring({ response: 0.42, damping: 0.66 }));
  };
  pipBar.addEventListener('pointerup', endPip);
  pipBar.addEventListener('pointercancel', endPip);

  store.subscribe(({ type, id }) => {
    if (id !== 'radio') {
      if (layerMode === 'docked') layer.style.zIndex = win.style.zIndex || '10';
      return;
    }
    if (type === 'close') {
      stopYt();
      if (Radio.getState().isPlaying) Radio.pause();
      return;
    }
    window.setTimeout(() => syncLayer(true), type === 'minimize' ? 0 : 420);
    syncLayer(true);
  });

  function renderLists() {
    listsEl.textContent = '';
    lists.lists.forEach((list) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip chip--sm';
      chip.setAttribute('role', 'radio');
      chip.setAttribute('aria-checked', String(lists.active && lists.active.id === list.id));
      chip.dataset.id = list.id;
      chip.textContent = list.name;
      chip.title = '按兩下可以改名';
      listsEl.appendChild(chip);
    });
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'chip chip--sm chip--add';
    add.dataset.add = '1';
    add.textContent = '＋ 新清單';
    listsEl.appendChild(add);
    $('list-remove').hidden = !lists.active;
  }

  function inlineName(anchor, initial, commit) {
    const wrap = document.createElement('span');
    wrap.className = 'chip chip--sm chip--input';
    const input = document.createElement('input');
    input.className = 'chip__input';
    input.maxLength = 24;
    input.value = initial;
    input.placeholder = '清單名稱';
    input.setAttribute('aria-label', '清單名稱');
    wrap.appendChild(input);
    anchor.replaceWith(wrap);
    input.focus();
    input.select();
    let done = false;
    const finish = (save) => {
      if (done) return;
      done = true;
      if (save && input.value.trim()) commit(input.value.trim());
      else renderLists();
    };
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        finish(true);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      }
    });
    input.addEventListener('blur', () => finish(true));
  }

  listsEl.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip || chip.classList.contains('chip--input')) return;
    if (chip.dataset.add) {
      inlineName(chip, '', (name) => lists.createList(name));
      return;
    }
    lists.setActive(chip.dataset.id);
  });
  listsEl.addEventListener('dblclick', (event) => {
    const chip = event.target.closest('.chip[data-id]');
    if (!chip) return;
    const list = lists.lists.find((other) => other.id === chip.dataset.id);
    if (list) inlineName(chip, list.name, (name) => lists.renameList(list.id, name));
  });

  $('list-remove').addEventListener('click', async (event) => {
    const list = lists.active;
    if (!list) return;
    const ok = await dialogs.confirm({
      source: event.currentTarget,
      frame: win,
      title: `刪除「${list.name}」？`,
      text: `這份清單有 ${list.items.length} 首，刪除後可以從靈動島復原`,
      confirmLabel: '刪除',
    });
    if (!ok) return;
    if (current && current.listId === list.id) stopYt();
    const removed = lists.removeList(list.id);
    if (removed) island.toast({ text: '已刪除清單', note: removed.list.name, action: '復原', onAction: () => lists.restoreList(removed.list, removed.index) });
  });

  function renderQueueRow(row) {
    const holder = document.createElement('template');
    holder.innerHTML = '<span class="yt-row__thumb"><img alt="" loading="lazy" referrerpolicy="no-referrer"><span class="eq yt-row__eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span></span><span class="yt-row__main"><span class="yt-row__title"></span><span class="yt-row__meta"></span></span><span class="yt-row__grip" data-row-own aria-label="拖曳排序" role="button" tabindex="-1"><svg viewBox="0 0 12 16" aria-hidden="true"><circle cx="4" cy="4" r="1.2"/><circle cx="8" cy="4" r="1.2"/><circle cx="4" cy="8" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="4" cy="12" r="1.2"/><circle cx="8" cy="12" r="1.2"/></svg></span>';
    const fragment = holder.content;
    const img = fragment.querySelector('img');
    if (row.thumb) img.src = row.thumb;
    else img.remove();
    fragment.querySelector('.yt-row__title').textContent = row.title || (row.kind === 'playlist' ? 'YouTube 播放清單' : row.ref);
    fragment.querySelector('.yt-row__meta').textContent = row.kind === 'playlist' ? `播放清單${row.author ? ` · ${row.author}` : ''}` : row.author || 'YouTube';
    return fragment;
  }

  const seen = new Map();
  const queue = createRowList(queueEl, {
    render: renderQueueRow,
    onSelect(row) {
      if (!row) return;
      const item = items().find((other) => other.id === row.id);
      queueMicrotask(() => queue.clearSelection());
      if (!item) return;
      const playingThis = current && current.itemId === item.id;
      if (playingThis && ytPlaying) return;
      if (playingThis && player && ytState !== -1) {
        Radio.pause();
        player.playVideo();
        return;
      }
      playItem(item);
    },
    onDelete(row) {
      const removed = lists.removeItem(row.id);
      seen.delete(row.id);
      if (!removed) return;
      if (current && current.itemId === row.id) stopYt();
      island.toast({ text: '已移出清單', note: (removed.item.title || '').slice(0, 14), action: '復原', onAction: () => lists.restoreItem(removed) });
    },
  });

  function signature(item) {
    return `${item.title}|${item.author}|${item.thumb}`;
  }

  let draggingId = null;

  function reconcileQueue(reset = false) {
    const list = items().map((item) => ({ ...item, type: 'yt' }));
    if (reset) {
      queue.reset(list);
      seen.clear();
      list.forEach((item) => seen.set(item.id, signature(item)));
    } else {
      const ids = new Set(list.map((item) => item.id));
      queue.ids().forEach((id) => { if (!ids.has(id)) queue.removeId(id); });
      list.forEach((item, index) => {
        if (queue.has(item.id)) {
          if (seen.get(item.id) !== signature(item)) queue.update(item);
        } else {
          queue.insertAt(item, index, 'top');
        }
        seen.set(item.id, signature(item));
      });
      queue.order(list.map((item) => item.id), { except: draggingId });
    }
    queueStage.show(list.length ? 'rows' : 'empty');
    listCount.textContent = lists.active ? `${lists.active.name} · ${list.length} 首` : '';
    markCurrent();
  }

  function markCurrent() {
    queue.ids().forEach((id) => {
      const el = queue.element(id);
      if (!el) return;
      const on = !!current && current.itemId === id;
      el.classList.toggle('is-current', on);
      el.classList.toggle('is-live', on && ytPlaying);
    });
  }

  let activeListId = lists.active ? lists.active.id : null;
  lists.subscribe((reason) => {
    renderLists();
    const now = lists.active ? lists.active.id : null;
    const switched = now !== activeListId;
    activeListId = now;
    if (reason !== 'mode') reconcileQueue(switched || reason === 'reload');
    renderYtNow();
  });

  queueEl.addEventListener('pointerdown', (event) => {
    const grip = event.target.closest('.yt-row__grip');
    if (!grip || event.button !== 0) return;
    const rowEl = grip.closest('.row');
    const id = queue.ids().find((other) => queue.element(other) === rowEl);
    if (!id) return;
    event.preventDefault();
    const rect = rowEl.getBoundingClientRect();
    const drag = { pointer: event.pointerId, grab: event.clientY - rect.top, id };
    draggingId = id;
    rowEl.classList.add('is-dragging');
    try { grip.setPointerCapture(event.pointerId); } catch (err) {}
    const move = (ev) => {
      if (ev.pointerId !== drag.pointer) return;
      const el = queue.element(id);
      if (!el) return;
      el.style.translate = '0 0';
      const natural = el.getBoundingClientRect().top;
      const desired = ev.clientY - drag.grab;
      el.style.translate = `0 ${(desired - natural).toFixed(1)}px`;
      const others = queue.ids().filter((other) => other !== id).map((other) => queue.element(other));
      const center = desired + el.offsetHeight / 2;
      let target = 0;
      others.forEach((other) => {
        const r = other.getBoundingClientRect();
        if (center > r.top + r.height / 2) target += 1;
      });
      const now = items().findIndex((item) => item.id === id);
      if (target !== now) {
        lists.moveItem(id, target);
        const after = el.getBoundingClientRect().top - (desired - natural);
        el.style.translate = `0 ${(desired - after).toFixed(1)}px`;
      }
    };
    const up = (ev) => {
      if (ev.pointerId !== drag.pointer) return;
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', up);
      draggingId = null;
      const el = queue.element(id);
      if (!el) return;
      el.classList.remove('is-dragging');
      const offset = parseFloat((el.style.translate || '0 0').split(' ')[1]) || 0;
      const settle = createMotion({ y: offset }, { response: 0.42, damping: 0.7, restDelta: 0.1 });
      settle.onUpdate(({ y }) => { el.style.translate = Math.abs(y) < 0.1 ? '' : `0 ${y.toFixed(1)}px`; });
      settle.to({ y: 0 }, spring({ response: 0.42, damping: 0.7 }));
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
  });

  let adding = false;
  addForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (adding) return;
    const parsed = parseYouTube(addInput.value);
    if (!parsed) {
      addState.textContent = addInput.value.trim() ? '看不懂這個網址，請貼 YouTube 影片或播放清單的網址' : '先貼上網址';
      addState.classList.add('is-error');
      shake(addForm);
      return;
    }
    const exists = items().find((item) => item.kind === parsed.kind && item.ref === parsed.ref);
    if (exists) {
      addState.textContent = '這首已經在清單裡了';
      addState.classList.remove('is-error');
      const el = queue.element(exists.id);
      if (el) {
        el.classList.remove('is-updated');
        void el.offsetWidth;
        el.classList.add('is-updated');
      }
      return;
    }
    adding = true;
    addState.classList.remove('is-error');
    addState.textContent = '讀取標題中…';
    let info = { title: '', author: '', thumb: parsed.kind === 'video' ? `https://i.ytimg.com/vi/${parsed.ref}/mqdefault.jpg` : '' };
    try {
      info = await lookup(parsed);
    } catch (err) {
      if (err && (err.status === 401 || err.status === 403)) {
        addState.textContent = '這支影片不開放嵌入，可能沒辦法在這裡播放';
        addState.classList.add('is-error');
      }
    }
    lists.addItem({ ...parsed, ...info });
    addInput.value = '';
    if (!addState.classList.contains('is-error')) addState.textContent = '';
    adding = false;
  });

  addInput.addEventListener('input', () => {
    if (addState.textContent && !adding) {
      addState.textContent = '';
      addState.classList.remove('is-error');
    }
  });

  function measure() {
    const width = root.clientWidth;
    if (!width) return;
    const unit = rem();
    wide = width >= WIDE_REM * unit;
    xl = width >= XL_REM * unit;
    root.classList.toggle('is-wide', wide);
    root.classList.toggle('is-xl', xl);
    segment.measure();
    if (layerMode === 'docked') syncLayer();
  }

  new ResizeObserver(measure).observe(root);
  window.addEventListener('resize', () => syncLayer());

  renderChips();
  renderStations();
  renderStationNow(Radio.getState());
  renderLists();
  reconcileQueue(true);
  renderYtNow();
  syncMenubar();
  measure();
  armMotion.set({ a: 0 });

  return {
    measure,
    refreshGlass: () => segment.refreshGlass(),
    intro() {
      measure();
      window.setTimeout(measure, 80);
      window.setTimeout(() => syncLayer(true), 450);
      if (MotionSettings.reduced) return;
      const pop = createMotion({ s: 0 }, { response: 0.6, damping: 0.6, restDelta: 0.001 });
      const deck = $('deck');
      pop.onUpdate(({ s }) => {
        deck.style.transform = Math.abs(s - 1) < 0.001 ? '' : `scale(${0.86 + 0.14 * s}) rotate(${(1 - s) * -8}deg)`;
        deck.style.opacity = s >= 0.999 ? '' : String(clamp01(s));
      });
      pop.set({ s: 0 });
      window.setTimeout(() => pop.to({ s: 1 }, { response: 0.6, damping: 0.6 }), 60);
    },
    stopAll() {
      stopYt();
      Radio.pause();
    },
  };
}
