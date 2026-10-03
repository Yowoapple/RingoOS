import { createMotion } from '../../motion/animator.js';
import { MotionSettings } from '../../motion/presets.js';
import { Storage } from '../../core/storage/storage.js';
import { createOdometer } from '../../ui/odometer.js';
import { Fx } from '../../ui/fx-tier.js';
import { monotonePath } from '../../ui/curve.js';
import { Persona } from '../reminder/persona.js';
import { glyph } from './glyphs.js';
import { pickQuip } from './quips.js';
import { createWeatherFx } from './fx/scene.js';
import { getFxPreview, onFxPrefs, onFxPreview, readFxPrefs, setFxPrefs } from './fx/prefs.js';
import { PREVIEWS, glowFor } from './fx/plan.js';
import { AUTH_KEY, LOCATION_KEY, REFRESH_MS, getAuthKey, getLocation, loadWeather, searchPlaces, setAuthKey, setLocation, testAuthKey, uvLevel } from './provider.js';

const WIDE_REM = 34;
const XL_REM = 52;
const ART_BASE = `${import.meta.env.BASE_URL}characters/coffeebean/`;
const SEARCH_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.4 10.4l3.2 3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const LEAD = { response: 0.26, damping: 0.6 };
const TRAIL = { response: 0.42, damping: 0.74 };

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function blur(t, max) {
  return t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * max).toFixed(2)}px)` : '';
}

function rem() {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

function later(fn, ms) {
  if (MotionSettings.reduced || ms <= 0) fn();
  else window.setTimeout(fn, ms);
}

function signedTemp(v) {
  const r = Math.round(v);
  return r < 0 ? `−${Math.abs(r)}` : String(r);
}

function rise(el, { delay = 0, x = 0, y = 10, max = 4, config = { response: 0.46, damping: 0.72 } } = {}) {
  if (MotionSettings.reduced) return;
  const motion = createMotion({ e: 0 }, { response: 0.4, damping: 0.8, restDelta: 0.002 });
  motion.onUpdate(({ e }) => {
    const t = clamp01(e);
    el.style.opacity = t > 0.999 ? '' : String(t);
    el.style.transform = t > 0.999 && Math.abs(e - 1) < 0.002 ? '' : `translate3d(${(1 - e) * x}px, ${(1 - e) * y}px, 0)`;
    el.style.filter = blur(t, max);
  });
  motion.set({ e: 0 });
  later(() => motion.to({ e: 1 }, config), delay);
}

const swaps = new WeakMap();

function swapText(el, text) {
  let state = swaps.get(el);
  if (!state) {
    const motion = createMotion({ e: 1 }, { response: 0.3, damping: 1, restDelta: 0.002 });
    motion.onUpdate(({ e }) => {
      const t = clamp01(e);
      el.style.opacity = t > 0.999 ? '' : String(t);
      el.style.filter = blur(t, 5);
    });
    state = { motion, target: el.textContent };
    swaps.set(el, state);
  }
  if (state.target === text) return;
  state.target = text;
  if (!el.textContent || MotionSettings.reduced) {
    el.textContent = text;
    return;
  }
  state.motion.to({ e: 0 }, { response: 0.14, damping: 1 }).then(() => {
    el.textContent = state.target;
    state.motion.to({ e: 1 }, { response: 0.36, damping: 0.8 });
  });
}

function formatter(timeZone, options) {
  try {
    return new Intl.DateTimeFormat('zh-TW', { timeZone, ...options });
  } catch (err) {
    return new Intl.DateTimeFormat('zh-TW', options);
  }
}

function placeLabel(location) {
  return location ? location.name : '';
}

function createPlaceSearch(host, { onPick, autofocus = false, compact = false }) {
  host.classList.add('wx-search');
  host.classList.toggle('wx-search--compact', compact);
  host.innerHTML = `<label class="wx-search__field">${SEARCH_ICON}<input class="wx-search__input" autocomplete="off" spellcheck="false" placeholder="例如：虎尾、臺北、Tokyo、Paris" aria-label="搜尋城市或鄉鎮"><span class="wx-search__busy" aria-hidden="true"><i></i><i></i><i></i></span></label><div class="wx-search__list" role="listbox" aria-label="搜尋結果"><span class="wx-search__platter" aria-hidden="true"></span></div><p class="wx-search__state" aria-live="polite"></p>`;
  const input = host.querySelector('input');
  const list = host.querySelector('.wx-search__list');
  const platter = host.querySelector('.wx-search__platter');
  const state = host.querySelector('.wx-search__state');
  let results = [];
  let active = -1;
  let timer = 0;
  let controller = null;
  const edges = createMotion({ t: 0, b: 0, v: 0 }, { response: 0.3, damping: 0.8, restDelta: { t: 0.05, b: 0.05, v: 0.002 } });
  edges.onUpdate(({ t, b, v }) => {
    platter.style.transform = `translate3d(0, ${Math.min(t, b)}px, 0)`;
    platter.style.height = `${Math.max(0, Math.abs(b - t))}px`;
    platter.style.opacity = String(clamp01(v));
  });

  function highlight(index) {
    const items = Array.from(list.querySelectorAll('.wx-place-item'));
    if (index < 0 || index >= items.length) {
      edges.to({ v: 0 }, { response: 0.2, damping: 1 });
      active = -1;
      return;
    }
    active = index;
    items.forEach((item, i) => item.setAttribute('aria-selected', String(i === index)));
    const item = items[index];
    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;
    if (edges.get('v') < 0.05 || MotionSettings.reduced) {
      edges.set({ t: top, b: bottom });
      edges.to({ v: 1 }, { response: 0.2, damping: 1 });
      return;
    }
    const down = top >= edges.get('t');
    edges.to({ b: bottom }, down ? LEAD : TRAIL);
    edges.to({ t: top }, down ? TRAIL : LEAD);
    edges.to({ v: 1 }, { response: 0.2, damping: 1 });
    item.scrollIntoView({ block: 'nearest' });
  }

  function render(query) {
    list.querySelectorAll('.wx-place-item').forEach((item) => item.remove());
    edges.set({ v: 0 });
    active = -1;
    results.forEach((place, i) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'wx-place-item';
      item.setAttribute('role', 'option');
      item.innerHTML = '<span class="wx-place-item__name"></span><span class="wx-place-item__meta"></span>';
      item.querySelector('.wx-place-item__name').textContent = place.name;
      item.querySelector('.wx-place-item__meta').textContent = [place.region, place.country].filter(Boolean).join(' · ');
      item.addEventListener('pointerenter', () => highlight(i));
      item.addEventListener('click', () => onPick(place));
      list.appendChild(item);
      rise(item, { delay: i * 28, y: 6, max: 3, config: { response: 0.36, damping: 0.78 } });
    });
    if (query && !results.length) state.textContent = `找不到「${query}」，換個寫法試試，例如英文或加上縣市`;
    else state.textContent = '';
  }

  async function run() {
    const query = input.value.trim();
    if (controller) controller.abort();
    if (query.length < 2) {
      results = [];
      host.classList.remove('is-busy');
      render('');
      state.textContent = query ? '再多打一個字' : '';
      return;
    }
    controller = new AbortController();
    const mine = controller;
    host.classList.add('is-busy');
    try {
      results = await searchPlaces(query, mine.signal);
      if (mine !== controller) return;
      render(query);
    } catch (err) {
      if (err.name === 'AbortError') return;
      results = [];
      render('');
      state.textContent = '連不上地名服務，檢查一下網路再試';
    } finally {
      if (mine === controller) host.classList.remove('is-busy');
    }
  }

  input.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(run, 320);
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      highlight(Math.min(results.length - 1, active + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      highlight(Math.max(0, active - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (active >= 0 && results[active]) onPick(results[active]);
      else if (results[0]) onPick(results[0]);
      else {
        window.clearTimeout(timer);
        run();
      }
    }
  });

  if (autofocus) later(() => input.focus({ preventScroll: true }), 200);

  return {
    focus: () => input.focus({ preventScroll: true }),
    clear() {
      input.value = '';
      results = [];
      render('');
    },
  };
}

export function createWeatherApp({ root, host, island, dialogs, store, placeButton, refreshButton, updatedTag, onData, onAlert }) {
  const win = root.closest('.wm-window');
  const scene = win && store ? createWeatherFx({ win, store, content: root, tempTarget: root.querySelector('[data-wx="temp"]') }) : null;
  let realScene = null;
  function applyScene() {
    if (!scene) return;
    const id = getFxPreview();
    const item = id ? PREVIEWS.find((p) => p.id === id) : null;
    const target = item ? item.weather : realScene;
    if (!target) return;
    root.dataset.mood = target.mood;
    scene.set(target);
    scene.relayout();
    applyGlow(target);
  }
  function applyGlow(target) {
    const prefs = readFxPrefs();
    const glow = glowFor(target, { enabled: prefs.enabled, level: prefs.level, animate: !MotionSettings.reduced && Fx.tier !== 'solid' });
    if (!glow) {
      delete root.dataset.glow;
      delete root.dataset.sheen;
      delete root.dataset.shimmer;
      return;
    }
    root.dataset.glow = String(glow.heat);
    root.dataset.sheen = glow.sheen;
    if (glow.shimmer) root.dataset.shimmer = '';
    else delete root.dataset.shimmer;
  }
  onFxPreview(() => {
    if (view === 'main') applyScene();
  });
  const reglow = () => {
    if (view === 'main') applyScene();
  };
  onFxPrefs(reglow);
  MotionSettings.subscribe(reglow);
  if (typeof Fx.subscribe === 'function') Fx.subscribe(reglow);
  const fxToggle = root.querySelector('[data-wx="fx"]');
  function paintFxToggle(prefs = readFxPrefs()) {
    if (!fxToggle) return;
    fxToggle.textContent = prefs.enabled ? '天氣特效：開' : '天氣特效：關';
    fxToggle.setAttribute('aria-pressed', String(prefs.enabled));
  }
  if (fxToggle) {
    paintFxToggle();
    fxToggle.addEventListener('click', () => paintFxToggle(setFxPrefs({ enabled: !readFxPrefs().enabled })));
    onFxPrefs(paintFxToggle);
  }
  const $ = (name) => root.querySelector(`[data-wx="${name}"]`);
  const views = { setup: $('setup'), main: $('main'), error: $('error') };
  const glyphEl = $('glyph');
  const condEl = $('cond');
  const rangeEl = $('range');
  const uvCell = $('uv-cell');
  const uvText = $('uv-text');
  const sunEl = $('sun');
  const hoursEl = $('hours');
  const chartEl = $('chart');
  const daysEl = $('days');
  const quipEl = $('quip');
  const quipArt = $('quip-art');
  const quipText = $('quip-text');
  const alertEl = $('alert');
  const alertText = $('alert-text');
  const cwaWrap = $('cwa-wrap');
  const cwaButton = $('cwa');
  const placeText = placeButton.querySelector('.wx-place__text');
  const obsEl = $('obs');
  const obsWhere = $('obs-where');
  const obsForecast = $('obs-forecast');
  const descEl = $('desc');
  const comfortEl = $('comfort');
  const sourceEl = $('source');

  let view = null;
  let result = null;
  let wide = false;
  let xl = false;
  let loading = false;
  let notified = '';

  const tempOdo = createOdometer($('temp'), { value: 0, format: signedTemp });
  const apparentOdo = createOdometer($('apparent'), { value: 0, format: (v) => `${signedTemp(v)}°` });
  const humidityOdo = createOdometer($('humidity'), { value: 0, format: (v) => `${Math.round(v)}%` });
  const popOdo = createOdometer($('pop'), { value: 0, format: (v) => `${Math.round(v)}%` });
  const uvOdo = createOdometer($('uv'), { value: 0, format: (v) => String(Math.round(v)) });

  createPlaceSearch($('setup-search'), {
    autofocus: false,
    onPick(place) {
      setLocation(place);
      refresh({ force: true, intro: true });
    },
  });

  function persona() {
    return Persona.isEnabled() ? Persona.getType() : 'neutral';
  }

  function show(name, { animate = true } = {}) {
    if (view === name) return;
    const previous = view ? views[view] : null;
    view = name;
    Object.entries(views).forEach(([key, el]) => {
      if (el !== previous) el.hidden = key !== name;
    });
    placeButton.hidden = name === 'setup';
    refreshButton.hidden = name === 'setup';
    if (scene && name !== 'main') {
      scene.set(null);
      delete root.dataset.glow;
    }
    updatedTag.hidden = name !== 'main';
    if (previous && animate && !MotionSettings.reduced) {
      const out = createMotion({ e: 1 }, { response: 0.2, damping: 1, restDelta: 0.002 });
      out.onUpdate(({ e }) => {
        const t = clamp01(e);
        previous.style.opacity = String(t);
        previous.style.filter = blur(t, 6);
        previous.style.transform = `translate3d(0, ${(1 - t) * -12}px, 0)`;
      });
      previous.classList.add('is-leaving');
      out.to({ e: 0 }, { response: 0.2, damping: 1 }).then(() => {
        previous.hidden = true;
        previous.classList.remove('is-leaving');
        previous.style.opacity = '';
        previous.style.filter = '';
        previous.style.transform = '';
      });
    } else if (previous) {
      previous.hidden = true;
    }
    if (name === 'setup') later(() => root.querySelector('.wx-setup .wx-search__input')?.focus({ preventScroll: true }), 260);
  }

  function setLoading(on) {
    loading = on;
    refreshButton.classList.toggle('is-spinning', on);
    refreshButton.disabled = on;
  }

  function renderPlace(location) {
    placeText.textContent = placeLabel(location);
    placeButton.title = location ? [location.name, location.region, location.country].filter(Boolean).join(' · ') : '';
  }

  function renderUpdated() {
    if (!result || result.status !== 'ok') return;
    const fmt = formatter(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const text = `${result.offline ? '離線 · ' : ''}更新 ${fmt.format(new Date(result.fetchedAt))}`;
    updatedTag.textContent = text;
    updatedTag.classList.toggle('is-offline', !!result.offline);
  }

  let glyphTarget = null;
  const glyphMotion = createMotion({ e: 1 }, { response: 0.3, damping: 1, restDelta: 0.002 });
  glyphMotion.onUpdate(({ e }) => {
    const t = clamp01(e);
    const rest = Math.abs(e - 1) < 0.002;
    glyphEl.style.opacity = rest ? '' : String(t);
    glyphEl.style.filter = rest ? '' : blur(t, 6);
    glyphEl.style.transform = rest ? '' : `scale(${0.7 + 0.3 * Math.max(0, e)})`;
  });

  function swapGlyph(name) {
    if (glyphTarget === name) return;
    glyphTarget = name;
    if (!glyphEl.firstElementChild || MotionSettings.reduced) {
      glyphEl.innerHTML = glyph(name);
      return;
    }
    glyphMotion.to({ e: 0 }, { response: 0.16, damping: 1 }).then(() => {
      if (glyphEl.firstElementChild?.dataset.glyph !== glyphTarget) glyphEl.innerHTML = glyph(glyphTarget);
      glyphMotion.to({ e: 1 }, { response: 0.5, damping: 0.55 });
    });
  }

  function renderSun(data, fmt) {
    const now = data.current.time;
    const today = data.daily[0];
    const tomorrow = data.daily[1];
    let from;
    let to;
    let night = false;
    if (now < today.sunrise) {
      night = true;
      from = today.sunset - 86400000;
      to = today.sunrise;
    } else if (now <= today.sunset) {
      from = today.sunrise;
      to = today.sunset;
    } else {
      night = true;
      from = today.sunset;
      to = tomorrow ? tomorrow.sunrise : today.sunset + 12 * 3600000;
    }
    const progress = clamp01((now - from) / Math.max(1, to - from));
    const left = night ? '日落' : '日出';
    const right = night ? '日出' : '日落';
    const remaining = Math.max(0, to - now);
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.round((remaining % 3600000) / 60000);
    const label = `${night ? '日出' : '日落'}還有 ${hours ? `${hours} 小時 ` : ''}${minutes} 分`;
    sunEl.innerHTML = `<svg class="wx-sun__arc" viewBox="0 0 200 104" aria-hidden="true"><path class="wx-sun__track" d="M12 96 A88 88 0 0 1 188 96" pathLength="1"/><path class="wx-sun__done" d="M12 96 A88 88 0 0 1 188 96" pathLength="1"/><line class="wx-sun__ground" x1="0" y1="96" x2="200" y2="96"/><circle class="wx-sun__dot${night ? ' is-moon' : ''}" r="6"/></svg><div class="wx-sun__labels"><span><span class="wx-sun__k"></span><span class="wx-sun__t mono"></span></span><span class="wx-sun__mid"></span><span><span class="wx-sun__k"></span><span class="wx-sun__t mono"></span></span></div>`;
    const keys = sunEl.querySelectorAll('.wx-sun__k');
    const times = sunEl.querySelectorAll('.wx-sun__t');
    keys[0].textContent = left;
    keys[1].textContent = right;
    times[0].textContent = fmt.format(new Date(from));
    times[1].textContent = fmt.format(new Date(to));
    sunEl.querySelector('.wx-sun__mid').textContent = label;
    sunEl.classList.toggle('is-night', night);
    const done = sunEl.querySelector('.wx-sun__done');
    const dot = sunEl.querySelector('.wx-sun__dot');
    const paint = (p) => {
      const a = Math.PI * clamp01(p);
      dot.setAttribute('cx', (100 - 88 * Math.cos(a)).toFixed(2));
      dot.setAttribute('cy', (96 - 88 * Math.sin(a)).toFixed(2));
      done.style.strokeDasharray = `${clamp01(p)} 1`;
    };
    return { paint, progress };
  }

  let sunMotion = null;
  let sunNow = null;

  function animateSun(sun, intro) {
    sunNow = sun;
    if (!sunMotion) {
      sunMotion = createMotion({ p: 0 }, { response: 0.9, damping: 0.86, restDelta: 0.0005 });
      sunMotion.onUpdate(({ p }) => { if (sunNow) sunNow.paint(p); });
    }
    if (intro && !MotionSettings.reduced) {
      sunMotion.set({ p: 0 });
      later(() => sunMotion.to({ p: sun.progress }, { response: 1.1, damping: 0.84 }), 220);
    } else {
      sunMotion.set({ p: sun.progress });
      sun.paint(sun.progress);
    }
  }

  function renderHours(data, timeZone, intro) {
    const hourFmt = formatter(timeZone, { hour: 'numeric', hourCycle: 'h23' });
    hoursEl.textContent = '';
    data.hourly.forEach((hour, i) => {
      const item = document.createElement('div');
      item.className = 'wx-hour';
      const label = i === 0 ? '現在' : `${hourFmt.format(new Date(hour.time)).replace(/\D/g, '')} 時`;
      item.innerHTML = `<span class="wx-hour__time"></span>${glyph(hour.glyph, 'wx-g wx-hour__glyph')}<span class="wx-hour__temp mono"></span><span class="wx-hour__pop mono"></span>`;
      item.querySelector('.wx-hour__time').textContent = label;
      item.querySelector('.wx-hour__temp').textContent = `${signedTemp(hour.temperature)}°`;
      const pop = item.querySelector('.wx-hour__pop');
      pop.textContent = hour.pop >= 10 ? `${hour.pop}%` : '';
      item.classList.toggle('is-now', i === 0);
      hoursEl.appendChild(item);
      if (intro && i < 10) rise(item, { delay: 120 + i * 32, x: 16, y: 0, max: 4 });
    });
  }

  function smooth(points) {
    return points.length < 2 ? '' : monotonePath(points);
  }

  function renderChart(data, timeZone, intro) {
    const width = chartEl.clientWidth || 600;
    const unit = rem();
    const height = 9 * unit;
    const top = 1.6 * unit;
    const lineBottom = height - 3.4 * unit;
    const barBottom = height - 1.3 * unit;
    const hours = data.hourly;
    const temps = hours.map((h) => h.temperature);
    const lo = Math.min(...temps);
    const hi = Math.max(...temps);
    const span = Math.max(1, hi - lo);
    const step = width / hours.length;
    const points = hours.map((h, i) => [step * (i + 0.5), top + (1 - (h.temperature - lo) / span) * (lineBottom - top)]);
    const hourFmt = formatter(timeZone, { hour: 'numeric', hourCycle: 'h23' });
    let marks = '';
    let bars = '';
    hours.forEach((h, i) => {
      const [x, y] = points[i];
      const pop = Math.max(0, h.pop || 0);
      const barH = (pop / 100) * 1.4 * unit;
      bars += `<rect class="wx-chart__pop" x="${(x - step * 0.3).toFixed(1)}" y="${(barBottom - barH).toFixed(1)}" width="${(step * 0.6).toFixed(1)}" height="${barH.toFixed(1)}" rx="1.5"/>`;
      if (i % 3 === 0) {
        marks += `<circle class="wx-chart__pt${i === 0 ? ' is-now' : ''}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i === 0 ? 3.6 : 2.4}"/>`;
        marks += `<text class="wx-chart__t" x="${x.toFixed(1)}" y="${(y - 0.55 * unit).toFixed(1)}">${signedTemp(h.temperature)}°</text>`;
        marks += `<text class="wx-chart__h" x="${x.toFixed(1)}" y="${(height - 0.15 * unit).toFixed(1)}">${i === 0 ? '現在' : hourFmt.format(new Date(h.time)).replace(/\D/g, '')}</text>`;
      }
    });
    const line = smooth(points);
    const area = `${line} L${points[points.length - 1][0].toFixed(1)} ${lineBottom + 0.3 * unit} L${points[0][0].toFixed(1)} ${lineBottom + 0.3 * unit} Z`;
    chartEl.innerHTML = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><defs><linearGradient id="wx-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="wx-chart__fade-a"/><stop offset="1" class="wx-chart__fade-b"/></linearGradient></defs><g class="wx-chart__bars">${bars}</g><path class="wx-chart__area" d="${area}"/><path class="wx-chart__line" d="${line}" pathLength="1"/>${marks}</svg>`;
    const path = chartEl.querySelector('.wx-chart__line');
    const area2 = chartEl.querySelector('.wx-chart__area');
    const barsEl = chartEl.querySelector('.wx-chart__bars');
    if (intro && !MotionSettings.reduced) {
      const motion = createMotion({ d: 0 }, { response: 0.9, damping: 0.9, restDelta: 0.001 });
      motion.onUpdate(({ d }) => {
        const t = clamp01(d);
        path.style.strokeDasharray = `${t} 1`;
        area2.style.opacity = String(t);
        barsEl.style.transform = `scaleY(${t})`;
      });
      motion.set({ d: 0 });
      later(() => motion.to({ d: 1 }, { response: 0.9, damping: 0.9 }), 160);
    }
  }

  function renderDays(data, timeZone, intro) {
    const dayFmt = formatter(timeZone, { weekday: 'short' });
    const dateFmt = formatter(timeZone, { month: 'numeric', day: 'numeric' });
    const days = data.daily.slice(0, 7);
    const lo = Math.min(...days.map((d) => d.min));
    const hi = Math.max(...days.map((d) => d.max));
    const span = Math.max(1, hi - lo);
    daysEl.textContent = '';
    days.forEach((day, i) => {
      const row = document.createElement('div');
      row.className = 'wx-day';
      row.innerHTML = `<span class="wx-day__name"><span class="wx-day__w"></span><span class="wx-day__d mono"></span></span>${glyph(day.glyph, 'wx-g wx-day__glyph')}<span class="wx-day__pop mono"></span><span class="wx-day__min mono"></span><span class="wx-day__track"><span class="wx-day__fill"></span><span class="wx-day__now" hidden></span></span><span class="wx-day__max mono"></span>`;
      row.querySelector('.wx-day__w').textContent = i === 0 ? '今天' : dayFmt.format(new Date(day.time));
      row.querySelector('.wx-day__d').textContent = dateFmt.format(new Date(day.time));
      row.querySelector('.wx-day__pop').textContent = day.pop >= 20 ? `${day.pop}%` : '';
      row.querySelector('.wx-day__min').textContent = `${signedTemp(day.min)}°`;
      row.querySelector('.wx-day__max').textContent = `${signedTemp(day.max)}°`;
      row.title = day.text;
      const fill = row.querySelector('.wx-day__fill');
      const left = (day.min - lo) / span;
      const width = Math.max(0.04, (day.max - day.min) / span);
      fill.style.left = `${(left * 100).toFixed(2)}%`;
      fill.style.width = `${(width * 100).toFixed(2)}%`;
      if (i === 0) {
        const now = row.querySelector('.wx-day__now');
        now.hidden = false;
        now.style.left = `${(clamp01((data.current.temperature - lo) / span) * 100).toFixed(2)}%`;
      }
      daysEl.appendChild(row);
      if (intro && !MotionSettings.reduced) {
        rise(row, { delay: 160 + i * 40, y: 8, max: 3 });
        const grow = createMotion({ s: 0 }, { response: 0.6, damping: 0.6, restDelta: 0.001 });
        grow.onUpdate(({ s }) => {
          fill.style.transform = Math.abs(s - 1) < 0.001 ? '' : `scaleX(${Math.max(0, s)})`;
        });
        grow.set({ s: 0 });
        later(() => grow.to({ s: 1 }, { response: 0.6, damping: 0.6 }), 260 + i * 40);
      }
    });
  }

  function renderQuip(data) {
    const today = data.daily[0];
    const quip = pickQuip(data.current, { persona: persona(), uvMax: today ? today.uv : null, seed: new Date(data.current.time).toDateString() });
    quipEl.hidden = false;
    if (quipArt.dataset.art !== quip.art) {
      quipArt.dataset.art = quip.art;
      quipArt.src = `${ART_BASE}${quip.art}`;
    }
    swapText(quipText, quip.text);
  }

  quipArt.addEventListener('error', () => { quipEl.hidden = true; });

  function renderAlerts(location, alerts) {
    const tw = location.countryCode === 'TW';
    cwaWrap.hidden = !tw;
    cwaButton.textContent = getAuthKey() ? '已連接' : '未連接';
    cwaButton.classList.toggle('is-on', !!getAuthKey());
    if (!alerts || !alerts.length) {
      alertEl.hidden = true;
      return;
    }
    alertEl.hidden = false;
    const names = Array.from(new Set(alerts.map((alert) => alert.phenomena)));
    alertText.textContent = `${names.join('、')}特報 · ${location.county || location.name}`;
    const signature = `${location.county}|${names.join(',')}`;
    if (signature !== notified && onAlert) {
      notified = signature;
      onAlert({ text: alertText.textContent });
    }
  }

  function renderMain(intro) {
    const { data, location, alerts } = result;
    const current = data.current;
    const timeZone = data.timezone;
    const today = data.daily[0];
    root.dataset.mood = current.mood;
    const shownTemp = data.observed ? data.observed.temperature : current.temperature;
    realScene = { mood: current.mood, glyph: current.glyph, wind: current.wind, temperature: shownTemp };
    applyScene();
    renderPlace(location);
    renderUpdated();
    swapGlyph(current.glyph);
    swapText(condEl, current.text);
    rangeEl.innerHTML = '';
    if (today) {
      rangeEl.innerHTML = '<span>最高 <b class="mono"></b></span><span>最低 <b class="mono"></b></span>';
      const bold = rangeEl.querySelectorAll('b');
      bold[0].textContent = `${signedTemp(today.max)}°`;
      bold[1].textContent = `${signedTemp(today.min)}°`;
    }
    const observed = data.observed;
    const shown = observed ? observed.temperature : current.temperature;
    if (intro) tempOdo.set(shown, { from: 0 });
    else tempOdo.set(shown);
    obsEl.hidden = !observed;
    if (observed) {
      const at = formatter(timeZone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(observed.time));
      obsWhere.textContent = `${observed.name}站 · ${observed.km < 1 ? '1 公里內' : `${observed.km.toFixed(1)} 公里`} · ${at}`;
      obsForecast.textContent = `${signedTemp(current.temperature)}°`;
    }
    descEl.hidden = !current.description;
    descEl.textContent = current.description || '';
    comfortEl.textContent = current.comfort || '';
    if (data.source === 'cwa') sourceEl.textContent = `天氣：交通部中央氣象署（${data.town}）· Open-Meteo 備援`;
    else if (result.fallback) sourceEl.textContent = '氣象署暫時連不上，改用 Open-Meteo（CC BY 4.0）';
    else sourceEl.textContent = '天氣資料：Open-Meteo（CC BY 4.0）';
    sourceEl.classList.toggle('is-fallback', !!result.fallback);
    apparentOdo.set(current.apparent);
    humidityOdo.set(observed && observed.humidity !== null ? observed.humidity : current.humidity);
    popOdo.set(current.pop ?? 0);
    const uv = current.uv ?? (today ? today.uv : null);
    uvOdo.set(uv ?? 0);
    const level = uvLevel(uv);
    uvText.textContent = level ? level.text : '';
    uvCell.dataset.level = level ? level.level : '';
    const clock = formatter(timeZone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    if (today) animateSun(renderSun(data, clock), intro);
    renderHours(data, timeZone, intro && !xl);
    if (xl) renderChart(data, timeZone, intro);
    renderDays(data, timeZone, intro);
    renderQuip(data);
    renderAlerts(location, alerts);
    if (intro && !MotionSettings.reduced) {
      const glyphPop = createMotion({ s: 0 }, { response: 0.55, damping: 0.5, restDelta: 0.001 });
      glyphPop.onUpdate(({ s }) => {
        const t = clamp01(s);
        glyphEl.style.opacity = t > 0.999 ? '' : String(t);
        glyphEl.style.transform = Math.abs(s - 1) < 0.001 ? '' : `scale(${0.6 + 0.4 * s}) rotate(${(1 - s) * -12}deg)`;
        glyphEl.style.filter = blur(t, 6);
      });
      glyphPop.set({ s: 0 });
      later(() => glyphPop.to({ s: 1 }, { response: 0.55, damping: 0.5 }), 60);
      Array.from(root.querySelectorAll('.wx-stat')).forEach((stat, i) => rise(stat, { delay: 140 + i * 45, y: 10 }));
      rise(condEl, { delay: 90, y: 8 });
      rise(rangeEl, { delay: 120, y: 8 });
      rise(sunEl, { delay: 200, y: 12 });
      rise(quipEl, { delay: 380, y: 10 });
    }
    if (onData) onData({ location, current, today, temperature: shown, hourly: data.hourly, timezone: timeZone, alerts: alerts || [] });
  }

  async function refresh({ force = false, intro = false } = {}) {
    if (loading) return;
    const location = getLocation();
    if (!location) {
      result = null;
      show('setup');
      if (onData) onData(null);
      return;
    }
    renderPlace(location);
    setLoading(true);
    let next;
    try {
      next = await loadWeather({ force });
    } catch (err) {
      next = { status: 'error', location, error: err };
    } finally {
      setLoading(false);
    }
    if (next.status === 'setup') {
      show('setup');
      return;
    }
    if (next.status === 'error') {
      result = next;
      $('error-text').textContent = next.error && next.error.status
        ? `天氣服務回應錯誤（${next.error.status}），等一下再試`
        : '連不上天氣服務，檢查一下網路再試';
      show('error');
      return;
    }
    const first = view !== 'main';
    result = next;
    show('main');
    renderMain(intro || first);
  }

  function measure() {
    const width = root.clientWidth;
    if (!width) return;
    const unit = rem();
    const nextWide = width >= WIDE_REM * unit;
    const nextXl = width >= XL_REM * unit;
    const changed = nextWide !== wide || nextXl !== xl;
    wide = nextWide;
    xl = nextXl;
    root.classList.toggle('is-wide', wide);
    root.classList.toggle('is-xl', xl);
    if (changed && result && result.status === 'ok' && view === 'main') {
      if (xl) renderChart(result.data, result.data.timezone, false);
    } else if (xl && result && result.status === 'ok' && view === 'main') {
      renderChart(result.data, result.data.timezone, false);
    }
  }

  function openPlacePicker({ source = placeButton, frame = win } = {}) {
    const box = document.createElement('div');
    box.className = 'wx-picker';
    const search = createPlaceSearch(box, {
      compact: true,
      onPick(place) {
        setLocation(place);
        dialogs.close(true);
        refresh({ force: true, intro: true });
      },
    });
    dialogs.present({
      source,
      frame,
      title: '換地點',
      content: box,
      width: 20,
      dismiss: false,
      actions: [{ label: '取消', className: 'btn--secondary', value: false, focus: false }],
    });
    later(() => search.focus(), 200);
  }

  function openCwa({ source = cwaButton, frame = win } = {}) {
    const box = document.createElement('div');
    box.className = 'wx-cwa';
    box.innerHTML = '<input class="field wx-cwa__input mono" type="password" autocomplete="off" spellcheck="false" placeholder="CWA-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" aria-label="氣象署授權碼"><p class="wx-cwa__state" aria-live="polite"></p><a class="wx-cwa__link" href="https://opendata.cwa.gov.tw/index" target="_blank" rel="noopener noreferrer">到氣象資料開放平臺申請授權碼（登入後選「API 授權碼」）</a>';
    const input = box.querySelector('input');
    const stateEl = box.querySelector('.wx-cwa__state');
    const had = !!getAuthKey();
    input.value = getAuthKey();
    let busy = false;
    async function connect() {
      if (busy) return;
      const key = input.value.trim();
      if (!key) {
        stateEl.textContent = '先貼上授權碼';
        return;
      }
      busy = true;
      stateEl.textContent = '連線測試中…';
      try {
        await testAuthKey(key);
        setAuthKey(key);
        stateEl.textContent = '';
        dialogs.close(true);
        refresh({ force: true });
      } catch (err) {
        stateEl.textContent = err && err.status === 401 ? '授權碼不正確，再確認一次' : '連不上氣象署，等一下再試';
      } finally {
        busy = false;
      }
    }
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        connect();
      }
    });
    const actions = [];
    if (had) actions.push({ label: '移除', className: 'btn--danger', value: false, onClick: () => { setAuthKey(''); refresh({ force: true }); } });
    actions.push({ label: '取消', className: 'btn--secondary', value: false });
    actions.push({ label: '連接', className: 'btn--primary', close: false, focus: true, onClick: connect });
    dialogs.present({
      source,
      frame,
      title: '臺灣天氣特報',
      text: '貼上你在氣象署申請的授權碼，就能看到颱風、豪雨等官方特報。授權碼只存在這台電腦的瀏覽器裡。',
      content: box,
      width: 22,
      dismiss: false,
      actions,
    });
    later(() => input.focus({ preventScroll: true }), 160);
  }

  placeButton.addEventListener('click', () => openPlacePicker());
  refreshButton.addEventListener('click', () => refresh({ force: true }));
  cwaButton.addEventListener('click', () => openCwa());
  alertEl.addEventListener('click', () => {
    if (alertEl.dataset.open) delete alertEl.dataset.open;
    else alertEl.dataset.open = '1';
  });
  $('retry').addEventListener('click', () => refresh({ force: true }));

  enableDrag(hoursEl);

  window.addEventListener('yoworingo:persona-change', () => {
    if (result && result.status === 'ok' && view === 'main') renderQuip(result.data);
  });
  Storage.subscribe(({ keys }) => {
    if (keys.includes(LOCATION_KEY) || keys.includes(AUTH_KEY)) refresh();
  });

  new ResizeObserver(measure).observe(root);
  window.setInterval(() => {
    if (document.visibilityState === 'visible' && getLocation()) refresh();
  }, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && result && result.status === 'ok' && Date.now() - result.fetchedAt > REFRESH_MS) refresh();
  });

  measure();
  refresh();

  return {
    measure,
    intro() {
      measure();
      window.setTimeout(measure, 80);
      if (result && result.status === 'ok' && view === 'main') renderMain(true);
      else if (view === 'setup') later(() => root.querySelector('.wx-setup .wx-search__input')?.focus({ preventScroll: true }), 300);
    },
    refresh,
    openPlacePicker,
    openCwa,
    fx: scene,
  };
}

function enableDrag(el) {
  let drag = null;
  el.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.pointerType !== 'mouse') return;
    drag = { x: event.clientX, left: el.scrollLeft, id: event.pointerId, moved: false };
  });
  el.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 4) return;
    if (!drag.moved) {
      drag.moved = true;
      try { el.setPointerCapture(event.pointerId); } catch (err) {}
      el.classList.add('is-dragging');
    }
    el.scrollLeft = drag.left - dx;
  });
  const end = () => {
    if (!drag) return;
    drag = null;
    el.classList.remove('is-dragging');
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('wheel', (event) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    if (el.scrollWidth <= el.clientWidth) return;
    event.preventDefault();
    el.scrollLeft += event.deltaY;
  }, { passive: false });
}
