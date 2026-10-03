import { createMotion } from '../../motion/animator.js';
import { MotionSettings } from '../../motion/presets.js';
import { Storage } from '../../core/storage/storage.js';
import { Data } from '../../core/data-model.js';
import { createOdometer } from '../../ui/odometer.js';
import { createRowList } from '../../ui/rows.js';
import { createStage } from '../../ui/stage.js';
import { Fx } from '../../ui/fx-tier.js';
import { createCalculator, formatNumber } from './engine.js';
import { Sound } from '../../audio/sound.js';

const HISTORY_KEY = 'yoworingo.v2.calc-history';
const HISTORY_LIMIT = 50;
const WIDE_REM = 34;
const LEAD = { response: 0.26, damping: 0.62 };
const TRAIL = { response: 0.44, damping: 0.74 };
const KEYBOARD = { Enter: '=', '=': '=', Escape: 'clear', Delete: 'clear', Backspace: 'back', x: '*', X: '*', '*': '*', '/': '/', '+': '+', '-': '-', '%': 'percent', '.': '.', ',': '.' };

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function blur(t, max) {
  return t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * max).toFixed(2)}px)` : '';
}

function rem() {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function readHistory() {
  const list = Storage.get(HISTORY_KEY, []);
  return Array.isArray(list) ? list.filter((item) => item && item.id && Number.isFinite(item.result)) : [];
}

export function createCalculatorApp({ root, island, dialogs, isActive, onRecord }) {
  const win = root.closest('.wm-window');
  const $ = (name) => root.querySelector(`[data-calc="${name}"]`);
  const exprEl = $('expr');
  const resultButton = $('result');
  const numEl = $('num');
  const errorEl = $('error');
  const recordButton = $('record');
  const keysEl = $('keys');
  const blobEl = $('blob');
  const tapeEl = $('tape');
  const clearTape = $('tape-clear');
  const screenEl = root.querySelector('.calc__screen');
  const keys = new Map(Array.from(keysEl.querySelectorAll('.calc-key')).map((key) => [key.dataset.key, key]));
  const clearKey = keys.get('clear');
  const calc = createCalculator();
  const stage = createStage($('tape-stage'), { initial: 'rows' });
  clearKey.dataset.target = clearKey.textContent;

  let history = readHistory();
  let wide = false;
  let shownResult = null;
  let pending = null;

  const pressMotions = new Map();
  keys.forEach((key, name) => {
    const motion = createMotion({ s: 1 }, { response: 0.3, damping: 0.7, restDelta: 0.0005 });
    motion.onUpdate(({ s }) => {
      key.style.transform = Math.abs(s - 1) < 0.0005 ? '' : `scale(${s})`;
    });
    pressMotions.set(name, motion);
  });

  function press(name) {
    Sound.play('key');
    const motion = pressMotions.get(name);
    if (!motion || MotionSettings.reduced) return;
    motion.to({ s: 0.9 }, { response: 0.12, damping: 1 });
    keys.get(name).classList.add('is-down');
  }

  function release(name) {
    const motion = pressMotions.get(name);
    if (!motion) return;
    keys.get(name).classList.remove('is-down');
    motion.to({ s: 1 }, MotionSettings.reduced ? MotionSettings.spring('focus') : { response: 0.38, damping: 0.42 });
  }

  const fit = createMotion({ s: 1 }, { response: 0.42, damping: 0.78, restDelta: 0.001 });
  fit.onUpdate(({ s }) => {
    numEl.style.setProperty('--fit', s.toFixed(4));
  });

  function refit(animate = true) {
    const available = resultButton.clientWidth;
    if (!available) return;
    const current = fit.get('s');
    const natural = numEl.scrollWidth / Math.max(0.05, current);
    const target = Math.min(1, (available - 2) / Math.max(1, natural));
    if (!animate || MotionSettings.reduced) fit.set({ s: target });
    else fit.to({ s: target }, { response: 0.42, damping: 0.78 });
  }

  const popMotion = createMotion({ s: 1 }, { response: 0.3, damping: 0.5, restDelta: 0.0005 });
  popMotion.onUpdate(({ s }) => {
    numEl.style.transform = Math.abs(s - 1) < 0.0005 ? '' : `scale(${s})`;
  });

  function swapText(el, text) {
    if (el.dataset.target === text) return;
    el.dataset.target = text;
    if (MotionSettings.reduced || !el.textContent) {
      el.textContent = text;
      return;
    }
    let motion = el._swap;
    if (!motion) {
      motion = createMotion({ e: 1 }, { response: 0.3, damping: 1, restDelta: 0.002 });
      motion.onUpdate(({ e }) => {
        const t = clamp01(e);
        el.style.opacity = t > 0.999 ? '' : String(t);
        el.style.filter = blur(t, 4);
        el.style.transform = t > 0.999 ? '' : `translate3d(0, ${(1 - t) * -4}px, 0)`;
      });
      el._swap = motion;
    }
    motion.to({ e: 0 }, { response: 0.12, damping: 1 }).then(() => {
      el.textContent = el.dataset.target;
      motion.to({ e: 1 }, { response: 0.32, damping: 0.8 });
    });
  }

  const blob = createMotion({ l: 0, t: 0, r: 0, b: 0, o: 0 }, { response: 0.4, damping: 0.75, restDelta: { l: 0.05, t: 0.05, r: 0.05, b: 0.05, o: 0.002 } });
  blob.onUpdate(({ l, t, r, b, o }) => {
    blobEl.style.transform = `translate3d(${l}px, ${t}px, 0)`;
    blobEl.style.width = `${Math.max(0, r - l)}px`;
    blobEl.style.height = `${Math.max(0, b - t)}px`;
    blobEl.style.opacity = String(clamp01(o));
  });

  function placeBlob(op, animate = true) {
    keys.forEach((key, name) => key.classList.toggle('is-active', name === op));
    if (!op) {
      blob.to({ o: 0 }, { response: 0.2, damping: 1 });
      return;
    }
    const key = keys.get(op);
    const box = { l: key.offsetLeft, t: key.offsetTop, r: key.offsetLeft + key.offsetWidth, b: key.offsetTop + key.offsetHeight };
    if (!animate || MotionSettings.reduced || blob.get('o') < 0.05) {
      blob.set(box);
      blob.to({ o: 1 }, { response: 0.22, damping: 1 });
      return;
    }
    const down = box.t > blob.get('t');
    const right = box.l > blob.get('l');
    blob.to({ b: box.b }, down ? LEAD : TRAIL);
    blob.to({ t: box.t }, down ? TRAIL : LEAD);
    blob.to({ r: box.r }, right ? LEAD : TRAIL);
    blob.to({ l: box.l }, right ? TRAIL : LEAD);
    blob.to({ o: 1 }, { response: 0.22, damping: 1 });
  }

  const recordMotion = createMotion({ e: 0 }, { response: 0.42, damping: 0.62, restDelta: 0.002 });
  recordMotion.onUpdate(({ e }) => {
    const t = clamp01(e);
    recordButton.style.opacity = String(t);
    recordButton.style.transform = `translate3d(0, ${(1 - e) * 6}px, 0) scale(${0.85 + 0.15 * Math.max(0, e)})`;
    recordButton.style.filter = blur(t, 4);
    if (e < 0.01 && !recordButton.dataset.on) recordButton.hidden = true;
  });

  function showRecord(on) {
    if (on === !!recordButton.dataset.on) return;
    if (on) {
      recordButton.dataset.on = '1';
      recordButton.hidden = false;
      recordMotion.set({ e: 0 });
      recordMotion.to({ e: 1 }, MotionSettings.reduced ? MotionSettings.spring('focus') : { response: 0.42, damping: 0.6 });
    } else {
      delete recordButton.dataset.on;
      recordMotion.to({ e: 0 }, { response: 0.18, damping: 1 });
    }
  }

  function shake() {
    if (MotionSettings.reduced) return;
    const motion = createMotion({ x: 0 }, { response: 0.3, damping: 0.3, restDelta: 0.05 });
    motion.onUpdate(({ x }) => {
      screenEl.style.transform = Math.abs(x) < 0.05 ? '' : `translate3d(${x}px, 0, 0)`;
    });
    motion.to({ x: 0 }, { velocity: { x: 520 } });
  }

  function showNumber(view, kind) {
    if (kind === 'result' && view.result !== null && !MotionSettings.reduced) {
      const from = shownResult !== null ? shownResult : Number(String(numEl.textContent).replace(/[,\s]/g, '').replace('−', '-')) || 0;
      numEl.textContent = '';
      const odo = createOdometer(numEl, { value: from, format: formatNumber });
      odo.set(view.result);
      shownResult = view.result;
      return;
    }
    numEl.classList.remove('odo');
    numEl.textContent = view.display;
    shownResult = view.result;
    if (kind === 'type' && !MotionSettings.reduced) {
      popMotion.set({ s: 0.97 });
      popMotion.to({ s: 1 }, { response: 0.3, damping: 0.5 });
    }
  }

  function render(kind = 'type') {
    const view = calc.view();
    swapText(exprEl, view.expression);
    showNumber(view, kind);
    errorEl.hidden = !view.error;
    errorEl.textContent = view.error || '';
    numEl.classList.toggle('is-error', !!view.error);
    if (view.error) shake();
    const label = view.canClearEntry ? 'C' : 'AC';
    swapText(clearKey, label);
    clearKey.setAttribute('aria-label', view.canClearEntry ? '清除這個數字' : '全部清除');
    if (view.pending !== pending) {
      pending = view.pending;
      placeBlob(pending);
    }
    showRecord(view.result !== null && view.result > 0 && Number.isFinite(view.result));
    window.requestAnimationFrame(() => refit());
    refit();
  }

  function saveHistory() {
    Storage.set(HISTORY_KEY, history.slice(0, HISTORY_LIMIT));
  }

  function renderRow(row) {
    const holder = document.createElement('template');
    holder.innerHTML = '<span class="tape__main"><span class="tape__expr"></span><span class="tape__result mono"></span></span><span class="tape__time mono"></span>';
    const fragment = holder.content;
    fragment.querySelector('.tape__expr').textContent = `${row.expression} =`;
    fragment.querySelector('.tape__result').textContent = formatNumber(row.result);
    const date = new Date(row.time);
    fragment.querySelector('.tape__time').textContent = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    return fragment;
  }

  const rowList = createRowList(tapeEl, {
    render: renderRow,
    onSelect(row) {
      if (!row) return;
      calc.recall(row.result);
      render('type');
      queueMicrotask(() => rowList.clearSelection());
    },
    onDelete(row, index) {
      const at = history.findIndex((item) => item.id === row.id);
      if (at < 0) return;
      const [removed] = history.splice(at, 1);
      saveHistory();
      syncTape();
      island.toast({
        text: '已刪除紀錄',
        action: '復原',
        onAction() {
          history.splice(Math.min(at, history.length), 0, removed);
          saveHistory();
          rowList.insertAt({ ...removed, type: 'tape' }, Math.min(index, rowList.size), 'left');
          syncTape();
        },
      });
    },
  });

  function syncTape() {
    stage.show(history.length ? 'rows' : 'empty');
    clearTape.hidden = history.length === 0;
  }

  function flyToTape(expression, value) {
    if (!wide || MotionSettings.reduced) return;
    const from = exprEl.getBoundingClientRect();
    const to = tapeEl.getBoundingClientRect();
    if (!from.width || !to.width) return;
    const ghost = document.createElement('div');
    ghost.className = 'calc-ghost';
    ghost.textContent = `${expression} = ${formatNumber(value)}`;
    document.body.appendChild(ghost);
    ghost.style.left = `${from.right}px`;
    ghost.style.top = `${from.top}px`;
    const width = ghost.offsetWidth;
    const dx = to.left + 8 - (from.right - width);
    const dy = to.top - from.top;
    const motion = createMotion({ p: 0 }, { response: 0.55, damping: 0.8, restDelta: 0.002 });
    motion.onUpdate(({ p }) => {
      const t = clamp01(p);
      ghost.style.transform = `translate3d(${-width + dx * p}px, ${dy * p - Math.sin(Math.PI * t) * 18}px, 0) scale(${1 - 0.12 * t})`;
      ghost.style.opacity = String(t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.3));
    });
    motion.to({ p: 1 }, { response: 0.55, damping: 0.8 }).then(() => ghost.remove());
  }

  function commit(entry) {
    const item = { id: Data.generateId(), expression: entry.expression, result: entry.result, time: Date.now() };
    history.unshift(item);
    if (history.length > HISTORY_LIMIT) {
      const dropped = history.splice(HISTORY_LIMIT);
      dropped.forEach((old) => rowList.removeId(old.id));
    }
    saveHistory();
    flyToTape(entry.expression, entry.result);
    rowList.insertAt({ ...item, type: 'tape' }, 0, 'top');
    syncTape();
  }

  function act(name) {
    let kind = 'type';
    if (/^\d$/.test(name)) calc.digit(name);
    else if (name === '.') calc.decimal();
    else if (['+', '-', '*', '/'].includes(name)) {
      calc.operator(name);
      kind = 'op';
    } else if (name === '=') {
      const done = calc.equals();
      kind = 'result';
      render(kind);
      if (done) commit(done);
      return;
    } else if (name === 'percent') calc.percent();
    else if (name === 'sign') calc.toggleSign();
    else if (name === 'back') calc.backspace();
    else if (name === 'clear') {
      calc.clear();
      kind = 'clear';
    } else return;
    render(kind);
  }

  keys.forEach((key, name) => {
    key.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      press(name);
    });
    const up = () => release(name);
    key.addEventListener('pointerup', up);
    key.addEventListener('pointerleave', up);
    key.addEventListener('pointercancel', up);
    key.addEventListener('click', () => act(name));
  });

  async function copyResult() {
    const view = calc.view();
    const raw = view.result !== null ? String(view.result) : view.display.replace(/,/g, '').replace('−', '-');
    try {
      await navigator.clipboard.writeText(raw);
      island.toast({ text: '已複製結果', duration: 2000 });
    } catch (err) {
      island.toast({ text: '沒辦法複製，請手動選取', duration: 2600 });
    }
  }

  resultButton.addEventListener('click', copyResult);
  recordButton.addEventListener('click', () => {
    const view = calc.view();
    if (view.result === null || view.result <= 0) return;
    onRecord(Math.round(view.result * 100) / 100);
  });

  clearTape.addEventListener('click', async () => {
    const ok = await dialogs.confirm({
      source: clearTape,
      frame: win,
      title: '清除所有紀錄？',
      text: `共 ${history.length} 筆算式，清除後沒辦法復原`,
      confirmLabel: '清除',
    });
    if (!ok) return;
    history = [];
    saveHistory();
    await rowList.removeAll(30);
    syncTape();
  });

  document.addEventListener('keydown', (event) => {
    if (!isActive() || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    if (event.ctrlKey) {
      if (event.key === 'c' || event.key === 'C') {
        if (window.getSelection && String(window.getSelection())) return;
        event.preventDefault();
        copyResult();
      }
      return;
    }
    let name = /^\d$/.test(event.key) ? event.key : KEYBOARD[event.key];
    if (!name && (event.key === 'c' || event.key === 'C')) name = 'clear';
    if (!name || !keys.has(name)) return;
    event.preventDefault();
    press(name);
    window.setTimeout(() => release(name), 90);
    act(name);
  });

  document.addEventListener('paste', (event) => {
    if (!isActive()) return;
    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    const text = (event.clipboardData && event.clipboardData.getData('text')) || '';
    const value = Number(text.replace(/[,\s，]/g, '').replace('−', '-'));
    if (!text.trim() || !Number.isFinite(value)) return;
    event.preventDefault();
    calc.recall(value);
    render('type');
  });

  function measure() {
    const width = root.clientWidth;
    if (!width) return;
    const next = width >= WIDE_REM * rem();
    if (next !== wide) {
      wide = next;
      root.classList.toggle('is-wide', wide);
    }
    if (pending) placeBlob(pending, false);
    refit(false);
  }

  new ResizeObserver(measure).observe(root);

  rowList.reset(history.map((item) => ({ ...item, type: 'tape' })));
  syncTape();
  render('init');
  measure();

  return {
    measure,
    intro() {
      measure();
      window.setTimeout(measure, 80);
      if (MotionSettings.reduced) return;
      Array.from(keys.values()).forEach((key, i) => {
        const row = Math.floor(i / 4);
        const col = i % 4;
        const motion = createMotion({ e: 0 }, { response: 0.44, damping: 0.66, restDelta: 0.002 });
        motion.onUpdate(({ e }) => {
          const t = clamp01(e);
          key.style.opacity = t > 0.999 ? '' : String(t);
          key.style.transform = Math.abs(e - 1) < 0.002 ? '' : `scale(${0.82 + 0.18 * e})`;
        });
        motion.set({ e: 0 });
        window.setTimeout(() => motion.to({ e: 1 }, { response: 0.44, damping: 0.66 }), 40 + (row + col) * 22);
      });
    },
  };
}
