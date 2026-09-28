import { Persona } from '../reminder/persona.js';
import { Weather } from './weather.js';

const CHARACTER_BASE_PATH = 'characters/coffeebean/';

const QUIP_RULES = [
  {
    test: (c) => (c.mood || '').indexOf('storm') === 0 || c.pop >= 70,
    gif: 'crying_2.webp',
    lines: {
      neutral: ['降雨機率 {pop}%，雨具記得準備好。'],
      maid: ['主人，降雨機率 {pop}%，出門前奴家幫您把傘準備好了。'],
      wife: ['降雨機率 {pop}%，出門記得帶傘，別淋濕了。'],
      sister: ['降雨機率 {pop}% 耶(´；ω；`)，傘記得帶啦，不然會濕透喔！'],
    },
  },
  {
    test: (c) => c.temperature >= 35,
    gif: 'dizzy.webp',
    lines: {
      neutral: ['體感 {apparent}°，注意補水跟防曬。'],
      maid: ['主人，外面體感 {apparent}°，奴家提醒您多補水、做好防曬。'],
      wife: ['外面體感 {apparent}°，記得多喝水，別中暑了。'],
      sister: ['體感 {apparent}° 也太熱了吧(＞﹏＜)，多喝水、防曬也要擦好啦！'],
    },
  },
  {
    test: (c) => c.temperature <= 15,
    gif: 'nervous_2.webp',
    lines: {
      neutral: ['溫度 {temp}° 偏低，出門多添件外套。'],
      maid: ['主人，今天溫度只有 {temp}°，記得多穿一件外套再出門。'],
      wife: ['今天 {temp}° 有點冷，外套記得帶著。'],
      sister: ['才 {temp}° 誒，冷死了(´・ω・`)，外套穿好再出門啦！'],
    },
  },
  {
    test: (c) => Number(c.uvi) >= 8,
    gif: 'craving.webp',
    lines: {
      neutral: ['紫外線偏高，記得防曬。'],
      maid: ['主人，今天紫外線比較強，奴家提醒您防曬別忘了。'],
      wife: ['今天紫外線有點強，出門前記得擦防曬。'],
      sister: ['紫外線超強的耶，防曬不擦會曬傷喔(°ロ°)！'],
    },
  },
  {
    test: (c) => (c.mood || '').indexOf('clear') === 0,
    gif: 'laughing.webp',
    lines: {
      neutral: ['今天天氣不錯，適合出門走走。'],
      maid: ['主人，今天天氣很好，很適合出門走走呢。'],
      wife: ['今天天氣不錯，要不要出去走走透透氣。'],
      sister: ['今天天氣好好耶(๑˃ᴗ˂)ﻭ，出門走走心情也會變好喔！'],
    },
  },
];

const DEFAULT_QUIP = {
  gif: 'nod_head_yes.webp',
  lines: {
    neutral: ['今天的天氣資訊都在上面了。'],
    maid: ['主人，今天的天氣資訊奴家都幫您整理好了。'],
    wife: ['今天的天氣我幫你看好了，出門前再看一眼。'],
    sister: ['今天天氣資訊都幫你放上面囉，出門前看一下啦～'],
  },
};

function fillTemplate(template, current) {
  return template
    .replace('{pop}', current.pop)
    .replace('{apparent}', Math.round(current.apparentTemperature))
    .replace('{temp}', Math.round(current.temperature));
}

function formatDayLabel(isoString, index) {
  const date = new Date(isoString);
  const hour = date.getHours();
  const isDaytime = hour >= 6 && hour < 18;
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  if (index === 0) return isDaytime ? '今天白天' : '今晚';
  if (index === 1 && isDaytime) return '今晚';
  return `週${weekdays[date.getDay()]}${isDaytime ? '白天' : '晚上'}`;
}

function formatClock(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function setStatus(el, message, type) {
  if (!el) return;
  el.textContent = message;
  el.className = 'io-status' + (type === 'success' ? ' is-success' : type === 'error' ? ' is-error' : '');
}

function renderCurrent(current) {
  if (!current) return;
  document.getElementById('weather-town-label').textContent = current.townName;
  document.getElementById('weather-current-icon').src = current.iconFile;
  document.getElementById('weather-current-icon').alt = current.weatherText;
  document.getElementById('weather-current-temp').textContent = `${Math.round(current.temperature)}°`;
  document.getElementById('weather-current-text').textContent = current.weatherText;
  document.getElementById('weather-description').textContent = current.description;

  const uviInfo = Weather.uviLevelInfo(current.uvi);
  const detailRow = document.getElementById('weather-detail-row');
  detailRow.innerHTML = `
    <div class="weather-detail-item">
      <span class="weather-detail-item__label">體感</span>
      <span class="weather-detail-item__value">${Math.round(current.apparentTemperature)}°</span>
    </div>
    <div class="weather-detail-item">
      <span class="weather-detail-item__label">降雨機率</span>
      <span class="weather-detail-item__value">${current.pop}%</span>
    </div>
    <div class="weather-detail-item">
      <span class="weather-detail-item__label">舒適度</span>
      <span class="weather-detail-item__value">${current.comfortText}</span>
    </div>
    <div class="weather-detail-item${uviInfo ? ' weather-detail-item--uvi-' + uviInfo.level : ''}">
      <span class="weather-detail-item__label">紫外線</span>
      <span class="weather-detail-item__value">${uviInfo ? uviInfo.text : '--'}</span>
    </div>
  `;

  const weatherWindowEl = document.querySelector('.wm-window[data-app-id="weather"]');
  if (weatherWindowEl) weatherWindowEl.dataset.weatherMood = current.mood || '';
}

function renderDayNight(current) {
  const el = document.getElementById('weather-daynight');
  const sunTimes = current && current.sunTimes;
  if (!el) return;
  if (!sunTimes) {
    el.hidden = true;
    return;
  }
  el.hidden = false;

  const sunrise = new Date(sunTimes.sunrise);
  const sunset = new Date(sunTimes.sunset);
  const now = new Date();
  const total = sunset - sunrise;
  const elapsed = now - sunrise;
  const pct = Math.max(0, Math.min(100, total > 0 ? (elapsed / total) * 100 : 0));

  document.getElementById('weather-daynight-fill').style.width = `${pct}%`;
  document.getElementById('weather-daynight-dot').style.left = `${pct}%`;
  document.getElementById('weather-sunrise-label').textContent = formatClock(sunrise);
  document.getElementById('weather-sunset-label').textContent = formatClock(sunset);
}

function renderAlerts(alerts) {
  const banner = document.getElementById('weather-alert-banner');
  const textEl = document.getElementById('weather-alert-banner-text');
  if (!banner || !textEl) return;
  if (!alerts || alerts.length === 0) {
    banner.hidden = true;
    return;
  }
  banner.hidden = false;
  textEl.textContent = `${alerts.map((a) => a.phenomena).join('、')} 特報中`;
}

function renderHourly(current) {
  const container = document.getElementById('weather-hourly');
  if (!container || !current || !current.upcoming) return;
  container.innerHTML = current.upcoming.map((block, index) => {
    const date = new Date(block.startTime);
    const label = index === 0 ? '現在' : `${date.getHours()}時`;
    const icon = Weather.resolveIconFile(block.weatherCode, block.temperature, date);
    const temp = block.temperature !== null ? `${Math.round(block.temperature)}°` : '--';
    return `
      <div class="weather-hour-card">
        <span>${label}</span>
        <img class="weather-hour-card__icon" src="${icon}" alt="">
        <span class="weather-hour-card__temp">${temp}</span>
      </div>
    `;
  }).join('');
}

function renderWeekly(weekly) {
  if (!weekly) return;
  const container = document.getElementById('weather-weekly');
  container.innerHTML = weekly.map((block, index) => `
    <div class="weather-day-card">
      <span class="weather-day-card__day">${formatDayLabel(block.startTime, index)}</span>
      <img class="weather-day-card__icon" src="${block.iconFile}" alt="${block.weatherText}">
      <span class="weather-day-card__temp">${Math.round(block.minTemp)}°/${Math.round(block.maxTemp)}°</span>
      <span class="weather-day-card__pop">${block.pop}%</span>
    </div>
  `).join('');
}

function renderQuip(current) {
  const wrap = document.getElementById('weather-quip');
  const avatar = document.getElementById('weather-quip-avatar');
  const textEl = document.getElementById('weather-quip-text');
  if (!wrap || !avatar || !textEl || !current) {
    if (wrap) wrap.hidden = true;
    return;
  }

  const matched = QUIP_RULES.find((rule) => rule.test(current));
  const picked = matched || DEFAULT_QUIP;
  const personaType = (Persona && Persona.isEnabled())
    ? Persona.getType()
    : 'neutral';
  const lines = picked.lines[personaType] || picked.lines.neutral;
  const line = lines[Math.floor(Math.random() * lines.length)];

  wrap.hidden = false;
  avatar.src = CHARACTER_BASE_PATH + picked.gif;
  textEl.textContent = fillTemplate(line, current);
}

function enableDragScroll(el) {
  if (!el) return;
  const DRAG_THRESHOLD = 4;
  let pointerId = null;
  let dragging = false;
  let startX = 0;
  let startScrollLeft = 0;

  el.addEventListener('pointerdown', (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    pointerId = event.pointerId;
    dragging = false;
    startX = event.clientX;
    startScrollLeft = el.scrollLeft;
    el.setPointerCapture(pointerId);
  });

  el.addEventListener('pointermove', (event) => {
    if (pointerId === null) return;
    const deltaX = event.clientX - startX;
    if (!dragging) {
      if (Math.abs(deltaX) < DRAG_THRESHOLD) return;
      dragging = true;
      el.classList.add('is-dragging');
    }
    el.scrollLeft = startScrollLeft - deltaX;
  });

  function endDrag() {
    if (pointerId !== null) {
      try { el.releasePointerCapture(pointerId); } catch (err) {}
    }
    pointerId = null;
    dragging = false;
    el.classList.remove('is-dragging');
  }

  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);
  el.addEventListener('pointerleave', endDrag);
}

async function loadAndRender(forceRefresh) {
  const statusEl = document.getElementById('weather-status');
  const refreshBtn = document.getElementById('weather-refresh-btn');
  if (refreshBtn) refreshBtn.classList.add('is-loading');
  try {
    setStatus(statusEl, '讀取中...', 'default');
    const data = await Weather.getWeather(forceRefresh);
    renderCurrent(data.current);
    renderDayNight(data.current);
    renderHourly(data.current);
    renderWeekly(data.weekly);
    renderAlerts(data.alerts);
    renderQuip(data.current);
    setStatus(statusEl, data.fromCache ? '（使用快取資料）' : '已更新', data.fromCache ? 'default' : 'success');
  } catch (err) {
    setStatus(statusEl, err.message, 'error');
  } finally {
    if (refreshBtn) {
      refreshBtn.classList.remove('is-loading');
      refreshBtn.title = (statusEl && statusEl.textContent) || '重新整理';
    }
  }
}

function initWeatherWindow() {
  const refreshBtn = document.getElementById('weather-refresh-btn');
  if (!refreshBtn || !Weather) return;

  refreshBtn.addEventListener('click', () => loadAndRender(true));

  enableDragScroll(document.getElementById('weather-hourly'));
  enableDragScroll(document.getElementById('weather-weekly'));

  const quipAvatar = document.getElementById('weather-quip-avatar');
  const quipWrap = document.getElementById('weather-quip');
  if (quipAvatar && quipWrap) {
    quipAvatar.addEventListener('error', () => { quipWrap.hidden = true; });
  }

  loadAndRender(false);
  window.setInterval(() => loadAndRender(false), Weather.REFRESH_INTERVAL_MS);
}

function initWeatherSettings() {
  const input = document.getElementById('weather-auth-input');
  const saveBtn = document.getElementById('weather-auth-save-btn');
  const statusEl = document.getElementById('weather-auth-status');
  if (!input || !saveBtn || !Weather) return;

  input.value = Weather.getAuthKey();

  saveBtn.addEventListener('click', () => {
    Weather.setAuthKey(input.value);
    setStatus(statusEl, '已儲存，重新整理天氣視窗即可套用', 'success');
    window.dispatchEvent(new CustomEvent('yoworingo:weather-key-change'));
    loadAndRender(true);
  });
}

function optionsHtml(placeholder, values, selected) {
  const escape = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return [`<option value="">${placeholder}</option>`]
    .concat(values.map((value) => `<option value="${escape(value)}"${value === selected ? ' selected' : ''}>${escape(value)}</option>`))
    .join('');
}

function initWeatherLocationSettings() {
  const countySelect = document.getElementById('weather-county-select');
  const townSelect = document.getElementById('weather-town-select');
  const saveBtn = document.getElementById('weather-location-save-btn');
  const statusEl = document.getElementById('weather-location-status');
  const currentEl = document.getElementById('weather-location-current');
  if (!countySelect || !townSelect || !saveBtn) return;

  let requestId = 0;

  function renderCurrent() {
    const location = Weather.getLocation();
    currentEl.textContent = location
      ? `目前地點：${location.county}${location.town}`
      : '還沒有選擇地點，選好後天氣視窗才會顯示資料。';
  }

  function updateSaveState() {
    saveBtn.disabled = !(countySelect.value && townSelect.value);
  }

  async function loadTowns(countyName, selectedTown) {
    const current = ++requestId;
    townSelect.disabled = true;
    townSelect.innerHTML = optionsHtml('讀取鄉鎮中…', [], '');
    updateSaveState();
    if (!countyName) {
      townSelect.innerHTML = optionsHtml('選擇鄉鎮', [], '');
      return;
    }
    try {
      const towns = await Weather.listTowns(countyName);
      if (current !== requestId) return;
      townSelect.innerHTML = optionsHtml('選擇鄉鎮', towns, selectedTown);
      townSelect.disabled = false;
      setStatus(statusEl, '', 'default');
    } catch (err) {
      if (current !== requestId) return;
      townSelect.innerHTML = optionsHtml('選擇鄉鎮', [], '');
      setStatus(statusEl, err.message, 'error');
    }
    updateSaveState();
  }

  const saved = Weather.getLocation();
  countySelect.innerHTML = optionsHtml('選擇縣市', Weather.COUNTIES.map((c) => c.name), saved ? saved.county : '');
  renderCurrent();
  if (saved && Weather.getAuthKey()) loadTowns(saved.county, saved.town);

  countySelect.addEventListener('change', () => loadTowns(countySelect.value, ''));
  townSelect.addEventListener('change', updateSaveState);

  saveBtn.addEventListener('click', () => {
    try {
      Weather.setLocation(countySelect.value, townSelect.value);
      renderCurrent();
      setStatus(statusEl, '已儲存', 'success');
      loadAndRender(true);
    } catch (err) {
      setStatus(statusEl, err.message, 'error');
    }
  });

  window.addEventListener('yoworingo:weather-key-change', () => {
    if (countySelect.value) loadTowns(countySelect.value, townSelect.value);
  });
}

export function boot() {
  try {
    initWeatherWindow();
    initWeatherSettings();
    initWeatherLocationSettings();
  } catch (err) {
    console.error('Life Ledger：天氣模組初始化失敗（不影響其他功能）', err);
  }
}
