import { Storage } from '../../core/storage/storage.js';
import { Calc } from '../../core/calculations.js';
import { Data } from '../../core/data-model.js';

const BASE_PATH = 'characters/coffeebean/';
const ENABLED_KEY = 'yoworingo.character-enabled';

const IDLE_MAP = {
  empty: ['trashtuber_idle.webp'],
  positive: ['cheer_up.webp', 'cake.webp', 'pat_head.webp', 'nod_head_yes.webp', 'laughing.webp'],
  warning: ['dazed.webp', 'nervous_2.webp', 'craving.webp', 'licking_lips.webp'],
  danger: ['pngtuber_idle_2.webp'],
};

const REACTIONS = {
  'yoworingo:entry-added': { file: 'nod_head_yes.webp', duration: 2000 },
  'yoworingo:entry-removed': { file: 'shake_head_no.webp', duration: 2000 },
  'yoworingo:goal-deposit': { file: 'notification_donation.webp', duration: 2500 },
};

const EASTER_EGGS = [
  { file: 'arrive_with_spoon.webp', duration: 2500 },
  { file: 'pointing.webp', duration: 2000 },
  { file: 'typing_normal.webp', duration: 2500 },
  { file: 'typing_angry.webp', duration: 2000 },
  { file: 'driving.webp', duration: 2000 },
  { file: 'knock_head.webp', duration: 1800 },
  { file: 'rose.webp', duration: 2500 },
  { file: 'popcat_frame.webp', duration: 1200 },
  { file: 'angry.webp', duration: 2200 },
  { file: 'jailed.webp', duration: 2500 },
  { file: 'knife.webp', duration: 2200 },
];

function isEnabled() {
  try {
    const stored = Storage.get(ENABLED_KEY, null);
    return stored === null ? true : stored === 'true';
  } catch (err) {
    return true;
  }
}

function setEnabled(enabled) {
  try {
    Storage.set(ENABLED_KEY, enabled ? 'true' : 'false');
  } catch (err) {}
  window.dispatchEvent(new CustomEvent('yoworingo:character-toggle', { detail: { enabled } }));
}

function hashKey(key) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) % 100000;
  return hash;
}

function pickSeeded(pool, seedKey) {
  return pool[hashKey(seedKey) % pool.length];
}

function getCurrentStatus() {
  if (!Data || !Calc) return 'empty';
  const dateInput = document.getElementById('daily-date');
  const anchorDateKey = (dateInput && dateInput.value) || Data.toDateKey(new Date());
  const monthKey = Data.toMonthKey(anchorDateKey);
  const summary = Calc.computeMonthSummary(monthKey);
  if (summary.income === 0 && summary.expense === 0) return 'empty';
  return summary.status;
}

function getCurrentIdleFile() {
  const status = getCurrentStatus();
  const pool = IDLE_MAP[status] || IDLE_MAP.empty;
  const todayKey = Data ? Data.toDateKey(new Date()) : 'today';
  const file = pickSeeded(pool, todayKey + '-' + status);
  return { status, file: BASE_PATH + file };
}

function initCharacter() {
  if (!Data || !Calc) return;

  const widget = document.getElementById('character-widget');
  const img = document.getElementById('character-img');
  if (!widget || !img) return;

  let assetsAvailable = true;
  let transientTimer = null;
  let isPlayingTransient = false;

  img.addEventListener('error', () => {
    if (!assetsAvailable) return;
    assetsAvailable = false;
    widget.hidden = true;
    console.warn('Life Ledger：找不到夥伴角色素材（characters/coffeebean/），已隱藏這個功能。');
  });

  function getCurrentStatus() {
    const dateInput = document.getElementById('daily-date');
    const anchorDateKey = (dateInput && dateInput.value) || Data.toDateKey(new Date());
    const monthKey = Data.toMonthKey(anchorDateKey);
    const summary = Calc.computeMonthSummary(monthKey);
    if (summary.income === 0 && summary.expense === 0) return 'empty';
    return summary.status;
  }

  function showIdle() {
    if (isPlayingTransient) return;
    const status = getCurrentStatus();
    const pool = IDLE_MAP[status] || IDLE_MAP.empty;
    const todayKey = Data.toDateKey(new Date());
    const file = pickSeeded(pool, todayKey + '-' + status);
    setImage(file);
  }

  function setImage(file) {
    img.src = BASE_PATH + file;
  }

  function playTransient(file, duration) {
    if (!assetsAvailable) return;
    isPlayingTransient = true;
    setImage(file);
    window.clearTimeout(transientTimer);
    transientTimer = window.setTimeout(() => {
      isPlayingTransient = false;
      showIdle();
    }, duration);
  }

  Object.keys(REACTIONS).forEach((eventName) => {
    window.addEventListener(eventName, () => {
      const reaction = REACTIONS[eventName];
      playTransient(reaction.file, reaction.duration);
    });
  });

  function playRandomEasterEgg() {
    const egg = EASTER_EGGS[Math.floor(Math.random() * EASTER_EGGS.length)];
    playTransient(egg.file, egg.duration);
  }

  function enableDrag() {
    const DRAG_THRESHOLD = 4;
    let pointerId = null;
    let dragging = false;
    let pending = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    widget.addEventListener('pointerdown', (event) => {
      pending = true;
      dragging = false;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startLeft = parseFloat(widget.style.left) || 0;
      startTop = parseFloat(widget.style.top) || 0;
      widget.setPointerCapture(event.pointerId);
    });

    widget.addEventListener('pointermove', (event) => {
      if (!pending) return;
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;

      if (!dragging) {
        if (Math.abs(deltaX) < DRAG_THRESHOLD && Math.abs(deltaY) < DRAG_THRESHOLD) return;
        dragging = true;
        widget.classList.add('is-dragging');
      }

      const desktop = document.querySelector('.desktop');
      const desktopRect = desktop.getBoundingClientRect();
      const widgetRect = widget.getBoundingClientRect();
      const minVisible = 40;

      let newLeft = startLeft + deltaX;
      let newTop = startTop + deltaY;
      newLeft = Math.max(-widgetRect.width + minVisible, Math.min(newLeft, desktopRect.width - minVisible));
      newTop = Math.max(0, Math.min(newTop, desktopRect.height - minVisible));

      widget.style.left = `${newLeft}px`;
      widget.style.top = `${newTop}px`;
      notifyMoved();
    });

    function endDrag(event) {
      const wasDragging = dragging;
      pending = false;
      dragging = false;
      if (pointerId !== null) {
        try { widget.releasePointerCapture(pointerId); } catch (err) {}
      }
      pointerId = null;
      widget.classList.remove('is-dragging');

      if (!wasDragging) {
        playRandomEasterEgg();
      }
    }

    widget.addEventListener('pointerup', endDrag);
    widget.addEventListener('pointercancel', endDrag);
  }

  function syncVisibility() {
    const enabled = isEnabled();
    widget.hidden = !enabled || !assetsAvailable;
  }

  window.addEventListener('yoworingo:character-toggle', syncVisibility);

  function notifyMoved() {
    window.dispatchEvent(new CustomEvent('yoworingo:character-moved'));
  }

  widget.style.left = widget.style.left || '520px';
  widget.style.top = widget.style.top || '360px';

  enableDrag();
  syncVisibility();
  showIdle();
  Data.subscribe(showIdle);
  const dateInput = document.getElementById('daily-date');
  if (dateInput) dateInput.addEventListener('change', showIdle);

  window.requestAnimationFrame(notifyMoved);
  window.addEventListener('resize', notifyMoved);
}

export const Character = { isEnabled, setEnabled, getCurrentIdleFile };

export function boot() {
  try {
    initCharacter();
  } catch (err) {
    console.error('Life Ledger：夥伴角色初始化失敗（不影響其他功能）', err);
  }
}
