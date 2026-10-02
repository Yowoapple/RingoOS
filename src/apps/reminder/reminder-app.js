import { createMotion } from '../../motion/animator.js';
import { MotionSettings } from '../../motion/presets.js';
import { Data } from '../../core/data-model.js';
import { Calc } from '../../core/calculations.js';
import { Storage } from '../../core/storage/storage.js';
import { createSegmented } from '../../ui/segmented.js';
import { createSelect } from '../../ui/controls.js';
import { createOdometer, formatAmount } from '../../ui/odometer.js';
import { Fx } from '../../ui/fx-tier.js';
import { Persona } from './persona.js';
import { buildInsight } from './insight.js';

const MODES = ['month', 'week'];
const WIDE_REM = 34;
const VOICE_OPTIONS = [
  { value: 'neutral', label: '一般' },
  { value: 'maid', label: '女僕' },
  { value: 'wife', label: '老婆' },
  { value: 'sister', label: '妹妹' },
];
const PERSONA_KEYS = ['yoworingo.persona-enabled', 'yoworingo.persona-type'];
const OPENERS = /[「『（《〈(]/;
const CLOSERS = /[，。、！？；：」』）》〉…~,.!?)]/;
const CHAR_STAGGER = 0.07;

function pad(n) {
  return String(n).padStart(2, '0');
}

function today() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function shortDate(dateKey) {
  return `${dateKey.slice(5, 7)}.${dateKey.slice(8, 10)}`;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function blur(t, max) {
  return t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * max).toFixed(2)}px)` : '';
}

function spring(config) {
  return MotionSettings.reduced ? MotionSettings.spring('focus') : config;
}

function later(fn, ms) {
  if (ms <= 0 || MotionSettings.reduced) fn();
  else window.setTimeout(fn, ms);
}

const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('zh-Hant', { granularity: 'word' }) : null;

function attach(pieces) {
  const out = [];
  let pending = '';
  pieces.forEach((piece) => {
    if (OPENERS.test(piece) && piece.length === 1) {
      pending += piece;
      return;
    }
    if (CLOSERS.test(piece[0]) && out.length && !pending) {
      out[out.length - 1] += piece;
      return;
    }
    out.push(pending + piece);
    pending = '';
  });
  if (pending) out.push(pending);
  return out;
}

const HAN = /^\p{Script=Han}$/u;

function pairSingles(pieces) {
  const out = [];
  pieces.forEach((piece) => {
    const last = out[out.length - 1];
    if (HAN.test(piece) && last && HAN.test(last)) out[out.length - 1] = last + piece;
    else out.push(piece);
  });
  return out;
}

const KAOMOJI = /[(（][^()（）\p{Script=Han}\n]{1,14}[)）][^\s\p{Script=Han}，。！？、]{0,3}/gu;

function appendText(el, text) {
  let last = 0;
  for (const match of text.matchAll(KAOMOJI)) {
    if (match.index > last) el.appendChild(document.createTextNode(text.slice(last, match.index)));
    const keep = document.createElement('span');
    keep.className = 'rm-keep';
    keep.textContent = match[0];
    el.appendChild(keep);
    last = match.index + match[0].length;
  }
  if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
}

function words(text) {
  if (!segmenter) return attach(Array.from(text));
  return attach(pairSingles(Array.from(segmenter.segment(text), (part) => part.segment)));
}

function chars(word) {
  return attach(Array.from(word));
}

function shapeOf(tokens) {
  return tokens.map((token) => (typeof token === 'string' ? token : `#${token.kind}${token.signed ? 's' : ''}`)).join('');
}

function valueOf(token) {
  return token.signed && token.sign < 0 ? -token.n : token.n;
}

function formatOf(token) {
  if (token.kind === 'pct') return (v) => `${Math.round(v)}%`;
  if (token.kind === 'count') return (v) => String(Math.round(v));
  if (token.signed) {
    return (v) => {
      const rounded = Math.round(v);
      if (rounded > 0) return `+${formatAmount(rounded)}`;
      if (rounded < 0) return `−${formatAmount(rounded)}`;
      return '0';
    };
  }
  return (v) => formatAmount(v);
}

function createLine(el, { split = false, lift = 8 } = {}) {
  let shape = null;
  let tokens = [];
  let odos = [];
  let cells = [];
  let phase = 'rest';
  let ticket = 0;
  const motion = createMotion({ v: 1 }, { response: 0.3, damping: 1, restDelta: 0.001 });

  function clearStyles() {
    el.style.opacity = '';
    el.style.transform = '';
    el.style.filter = '';
    cells.forEach((cell) => {
      cell.style.opacity = '';
      cell.style.transform = '';
      cell.style.filter = '';
    });
  }

  function paint({ v }) {
    if (phase === 'exit') {
      const t = clamp01(v);
      el.style.opacity = String(t);
      el.style.transform = `translate3d(0, ${(1 - t) * -5}px, 0)`;
      el.style.filter = blur(t, 5);
      return;
    }
    if (phase !== 'enter') return;
    if (split && cells.length) {
      el.style.opacity = '';
      el.style.transform = '';
      el.style.filter = '';
      const n = cells.length;
      const span = 1 + (n - 1) * CHAR_STAGGER;
      const bounce = Math.max(0, v - 1);
      cells.forEach((cell, i) => {
        const t = clamp01(v * span - i * CHAR_STAGGER);
        cell.style.opacity = String(t);
        cell.style.transform = `translate3d(0, ${((1 - t - bounce) * 0.42).toFixed(4)}em, 0)`;
        cell.style.filter = blur(t, 7);
      });
      return;
    }
    const t = clamp01(v);
    el.style.opacity = String(t);
    el.style.transform = `translate3d(0, ${(1 - v) * lift}px, 0)`;
    el.style.filter = blur(t, 5);
  }

  function build(animateNumbers) {
    el.textContent = '';
    odos = [];
    cells = [];
    tokens.forEach((token) => {
      if (typeof token === 'string') {
        if (!split) {
          appendText(el, token);
          return;
        }
        words(token).forEach((word) => {
          const wrap = document.createElement('span');
          wrap.className = 'rm-w';
          chars(word).forEach((piece) => {
            const cell = document.createElement('span');
            cell.className = 'rm-ch';
            cell.textContent = piece;
            wrap.appendChild(cell);
            cells.push(cell);
          });
          el.appendChild(wrap);
        });
        return;
      }
      const num = document.createElement('span');
      num.className = 'rm-n mono';
      el.appendChild(num);
      const value = valueOf(token);
      const odo = createOdometer(num, { value: animateNumbers ? 0 : value, format: formatOf(token) });
      if (animateNumbers) odo.set(value);
      odos.push(odo);
      if (split) cells.push(num);
    });
  }

  function settle() {
    phase = 'rest';
    clearStyles();
  }

  function enter(delay, numbersFromZero) {
    const mine = ++ticket;
    build(false);
    phase = 'enter';
    motion.set({ v: 0 });
    paint({ v: 0 });
    later(() => {
      if (mine !== ticket) return;
      if (numbersFromZero) {
        tokens.filter((token) => typeof token !== 'string').forEach((token, i) => odos[i].set(valueOf(token), { from: 0 }));
      }
      const config = split ? { response: 0.62, damping: 0.74 } : { response: 0.44, damping: 0.72 };
      motion.to({ v: 1 }, config).then((done) => {
        if (done && mine === ticket) settle();
      });
    }, delay);
  }

  motion.onUpdate(paint);

  return {
    el,
    set(next, { delay = 0, animate = true } = {}) {
      const nextShape = shapeOf(next);
      if (nextShape === shape) {
        tokens = next;
        next.filter((token) => typeof token !== 'string').forEach((token, i) => {
          if (odos[i]) odos[i].set(valueOf(token));
        });
        return false;
      }
      const first = shape === null;
      shape = nextShape;
      tokens = next;
      if (first || !animate || MotionSettings.reduced) {
        ticket += 1;
        build(false);
        settle();
        return true;
      }
      const mine = ++ticket;
      phase = 'exit';
      motion.to({ v: 0 }, { response: 0.16, damping: 1 }).then(() => {
        if (mine !== ticket) return;
        enter(delay, true);
      });
      return true;
    },
    intro(delay = 0) {
      if (MotionSettings.reduced || shape === null) return;
      enter(delay, true);
    },
    leave() {
      const mine = ++ticket;
      if (MotionSettings.reduced) return Promise.resolve(true);
      phase = 'exit';
      return motion.to({ v: 0 }, { response: 0.18, damping: 1 }).then(() => mine === ticket);
    },
    reset() {
      shape = null;
    },
  };
}

function createTextSwap(el) {
  const motion = createMotion({ e: 1 }, { response: 0.3, damping: 1, restDelta: 0.002 });
  motion.onUpdate(({ e }) => {
    const t = clamp01(e);
    el.style.opacity = t > 0.999 ? '' : String(t);
    el.style.filter = blur(t, 3);
  });
  return (text) => {
    if (el.textContent === text) return;
    if (!el.textContent || MotionSettings.reduced) {
      el.textContent = text;
      return;
    }
    motion.to({ e: 0 }, { response: 0.14, damping: 1 }).then(() => {
      el.textContent = text;
      motion.to({ e: 1 }, { response: 0.34, damping: 0.8 });
    });
  };
}

function createColumn(col, { onReveal, onCompose }) {
  const $ = (name) => col.querySelector(`[data-rm="${name}"]`);
  const statusEl = $('status');
  const rangeEl = $('range');
  const subEl = $('sub');
  const detailsEl = $('details');
  const cluesEl = $('clues');
  const cta = $('cta');
  const lead = createLine($('lead'), { split: true });
  const sub = createLine(subEl);
  const setRange = createTextSwap(rangeEl);
  const setStatus = createTextSwap(statusEl);
  const detailLines = [];
  const clues = new Map();
  let subShown = false;
  let ctaShown = false;

  const slide = createMotion({ y: 0 }, { response: 0.46, damping: 0.78, restDelta: 0.05 });
  slide.onUpdate(({ y }) => {
    const value = Math.abs(y) < 0.05 ? '' : `translate3d(0, ${y}px, 0)`;
    cluesEl.style.transform = value;
    cta.style.transform = value;
  });

  function shifted(mutate) {
    const before = cluesEl.getBoundingClientRect().top;
    mutate();
    const delta = before - cluesEl.getBoundingClientRect().top;
    if (Math.abs(delta) < 0.5 || MotionSettings.reduced || !col.offsetParent) return;
    slide.set({ y: slide.get('y') + delta });
    slide.to({ y: 0 }, { response: 0.46, damping: 0.78 });
  }

  function setSub(text, delay) {
    if (text) {
      if (!subShown) {
        subShown = true;
        shifted(() => { subEl.hidden = false; });
        sub.reset();
        sub.set([text], { animate: false });
        sub.intro(delay);
        return;
      }
      sub.set([text], { delay });
      return;
    }
    if (!subShown) return;
    subShown = false;
    sub.leave().then((ok) => {
      if (ok && !subShown) shifted(() => { subEl.hidden = true; });
    });
  }

  function setDetails(lines, base) {
    lines.forEach((tokens, i) => {
      const line = detailLines[i];
      if (line) {
        line.set(tokens, { delay: base + i * 60 });
        return;
      }
      const p = document.createElement('p');
      p.className = 'rm__detail';
      const fresh = createLine(p);
      fresh.set(tokens, { animate: false });
      shifted(() => detailsEl.appendChild(p));
      detailLines.push(fresh);
      fresh.intro(base + i * 60);
    });
    while (detailLines.length > lines.length) {
      const gone = detailLines.pop();
      gone.leave().then(() => shifted(() => gone.el.remove()));
    }
  }

  function clueCell(clue) {
    const el = document.createElement(clue.target ? 'button' : 'div');
    if (clue.target) el.type = 'button';
    el.className = 'rm-clue';
    el.innerHTML = '<span class="rm-clue__label"></span><span class="rm-clue__value"></span><span class="rm-clue__note"></span>';
    const entry = {
      el,
      target: clue.target,
      label: el.querySelector('.rm-clue__label'),
      note: el.querySelector('.rm-clue__note'),
      value: createLine(el.querySelector('.rm-clue__value'), { lift: 5 }),
      motion: createMotion({ y: 0, o: 1, s: 1 }, { response: 0.42, damping: 0.72, restDelta: { y: 0.1, o: 0.002, s: 0.0005 } }),
    };
    entry.motion.onUpdate(({ y, o, s }) => {
      const t = clamp01(o);
      const scale = s * (0.94 + 0.06 * t);
      const still = Math.abs(y) < 0.1 && Math.abs(scale - 1) < 0.0005;
      el.style.transform = still ? '' : `translate3d(0, ${y}px, 0) scale(${scale})`;
      el.style.opacity = t > 0.998 ? '' : String(t);
      el.style.filter = blur(t, 4);
    });
    if (clue.target) {
      const release = () => entry.motion.to({ s: 1 }, spring({ response: 0.38, damping: 0.42 }));
      el.addEventListener('pointerdown', () => {
        if (!MotionSettings.reduced) entry.motion.to({ s: 0.94 }, { response: 0.14, damping: 1 });
      });
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('pointerleave', release);
      el.addEventListener('click', () => {
        if (entry.target) onReveal(entry.target);
      });
    }
    return entry;
  }

  function setClues(list, base, intro) {
    const before = new Map();
    clues.forEach((entry, id) => before.set(id, entry.el.getBoundingClientRect().top));
    const keep = new Set(list.map((clue) => clue.id));
    clues.forEach((entry, id) => {
      if (keep.has(id)) return;
      clues.delete(id);
      entry.motion.to({ o: 0, y: -4 }, { response: 0.18, damping: 1 }).then(() => {
        entry.motion.stop();
        entry.el.remove();
      });
    });
    let born = 0;
    list.forEach((clue, i) => {
      let entry = clues.get(clue.id);
      const fresh = !entry;
      if (fresh) {
        entry = clueCell(clue);
        clues.set(clue.id, entry);
      }
      cluesEl.appendChild(entry.el);
      entry.target = clue.target;
      entry.label.textContent = clue.label;
      entry.note.textContent = clue.note || '';
      entry.el.classList.toggle('is-accent', !!clue.accent);
      if (clue.target) entry.el.setAttribute('aria-label', `${clue.label}，在收支總覽查看`);
      entry.value.set(clue.value, { delay: base + i * 40, animate: !fresh });
      if ((fresh || intro) && !MotionSettings.reduced) {
        const delay = base + (fresh ? born : i) * 45;
        born += 1;
        entry.motion.set({ y: 12, o: 0 });
        later(() => entry.motion.to({ y: 0, o: 1 }, { response: 0.46, damping: 0.7 }), delay);
        if (intro) entry.value.intro(delay + 40);
      }
    });
    clues.forEach((entry, id) => {
      if (!before.has(id) || MotionSettings.reduced) return;
      const delta = before.get(id) - entry.el.getBoundingClientRect().top;
      if (Math.abs(delta) < 0.5) return;
      entry.motion.set({ y: entry.motion.get('y') + delta });
      entry.motion.to({ y: 0 }, { response: 0.5, damping: 0.74 });
    });
    cluesEl.hidden = list.length === 0;
  }

  function setCta(show) {
    if (show === ctaShown) return;
    ctaShown = show;
    shifted(() => { cta.hidden = !show; });
  }

  cta.addEventListener('click', () => onCompose());

  return {
    update(insight, { range, intro = false }) {
      setRange(range);
      setStatus(insight.label);
      statusEl.classList.toggle('is-alert', insight.tone === 'alert');
      statusEl.classList.toggle('is-empty', insight.status === 'empty');
      lead.set([insight.lead]);
      if (intro) lead.intro(0);
      setSub(insight.sub, 70);
      if (intro && insight.sub) sub.intro(90);
      setDetails(insight.details, 140);
      if (intro) detailLines.forEach((line, i) => line.intro(150 + i * 60));
      setClues(insight.clues, 200, intro);
      setCta(insight.status === 'empty' && insight.current);
    },
  };
}

export function createReminderApp({ root, host, voiceEl, periodTag, nowButton, prevButton, nextButton, onReveal, onCompose }) {
  const $ = (name) => root.querySelector(`[data-rm="${name}"]`);
  const columns = {
    month: createColumn(root.querySelector('[data-rm-col="month"]'), { onReveal, onCompose }),
    week: createColumn(root.querySelector('[data-rm-col="week"]'), { onReveal, onCompose }),
  };
  const colEls = {
    month: root.querySelector('[data-rm-col="month"]'),
    week: root.querySelector('[data-rm-col="week"]'),
  };

  let mode = 'month';
  let anchor = today();
  let wide = false;

  function voice() {
    return Persona.isEnabled() ? Persona.getType() : 'neutral';
  }

  const segment = createSegmented($('mode'), {
    onChange(index) {
      mode = MODES[index];
      syncActive();
      render({ intro: [mode] });
    },
  });

  const voiceSelect = createSelect(voiceEl, {
    options: VOICE_OPTIONS,
    value: voice(),
    menuHost: host,
    onChange(value) {
      if (value === 'neutral') {
        Persona.setEnabled(false);
        return;
      }
      Persona.setType(value);
      Persona.setEnabled(true);
    },
  });

  function step() {
    return wide ? 'month' : mode;
  }

  function isCurrent() {
    const now = today();
    const key = Data.toDateKey(anchor);
    if (step() === 'month') return Data.toMonthKey(key) === Data.toMonthKey(Data.toDateKey(now));
    return Calc.getWeekDateKeys(Data.toDateKey(now)).includes(key);
  }

  function syncActive() {
    MODES.forEach((name) => colEls[name].classList.toggle('is-active', wide || name === mode));
  }

  let tagSwap = null;
  let nowPop = null;

  function renderTag() {
    const key = Data.toDateKey(anchor);
    let text;
    if (step() === 'month') {
      text = `${anchor.getFullYear()}.${pad(anchor.getMonth() + 1)}`;
    } else {
      const keys = Calc.getWeekDateKeys(key);
      text = `${shortDate(keys[0])} — ${shortDate(keys[6])}`;
    }
    const current = isCurrent();
    periodTag.classList.toggle('is-past', !current);
    nextButton.disabled = current;
    if (!tagSwap) tagSwap = createTextSwap(periodTag);
    tagSwap(text);
    nowButton.textContent = step() === 'month' ? '本月' : '本週';
    if (!nowPop) {
      nowPop = createMotion({ s: 0 }, { response: 0.36, damping: 0.55, restDelta: 0.002 });
      nowPop.onUpdate(({ s }) => {
        const t = Math.max(0, s);
        nowButton.style.opacity = String(Math.min(1, t));
        nowButton.style.transform = `scale(${0.6 + 0.4 * t})`;
        if (t < 0.01 && isCurrent()) nowButton.hidden = true;
      });
    }
    if (!current) {
      nowButton.hidden = false;
      nowPop.to({ s: 1 }, spring({ response: 0.36, damping: 0.55 }));
    } else if (!nowButton.hidden) {
      nowPop.to({ s: 0 }, { response: 0.2, damping: 1 });
    }
  }

  function rangeOf(insight) {
    const keys = insight.keys;
    if (insight.mode === 'month') return `Month · ${keys[0].slice(0, 4)}.${keys[0].slice(5, 7)}`;
    return `Week · ${shortDate(keys[0])} — ${shortDate(keys[6])}`;
  }

  function render({ intro = [] } = {}) {
    const anchorKey = Data.toDateKey(anchor);
    const persona = voice();
    renderTag();
    MODES.forEach((name) => {
      const insight = buildInsight({ mode: name, anchorKey, persona });
      columns[name].update(insight, { range: rangeOf(insight), intro: intro.includes(name) && colEls[name].classList.contains('is-active') });
    });
  }

  function shift(direction) {
    if (direction > 0 && isCurrent()) return;
    if (step() === 'week') {
      anchor = parseKey(Calc.shiftDateKey(Data.toDateKey(anchor), direction * 7));
    } else {
      const target = new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
      const last = new Date(target.getFullYear(), target.getMonth() + 1, 0);
      anchor = last > today() ? today() : last;
    }
    if (isCurrent()) anchor = today();
    render();
  }

  function measureWide() {
    const width = root.clientWidth;
    if (!width) return;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const next = width >= WIDE_REM * rem;
    if (next === wide) return;
    wide = next;
    root.classList.toggle('is-wide', wide);
    syncActive();
    if (wide && !isCurrent() && step() === 'month') {
      const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
      anchor = last > today() ? today() : last;
    }
    render({ intro: wide ? [mode === 'month' ? 'week' : 'month'] : [] });
    segment.measure();
  }

  prevButton.addEventListener('click', () => shift(-1));
  nextButton.addEventListener('click', () => shift(1));
  nowButton.addEventListener('click', () => {
    anchor = today();
    render();
  });

  Data.subscribe(() => render());
  window.addEventListener('yoworingo:persona-change', () => {
    voiceSelect.set(voice());
    render();
  });
  Storage.subscribe(({ keys }) => {
    if (!keys.some((key) => PERSONA_KEYS.includes(key))) return;
    voiceSelect.set(voice());
    render();
  });

  new ResizeObserver(measureWide).observe(root);
  syncActive();
  render();
  measureWide();

  return {
    refreshGlass: () => segment.refreshGlass(),
    measure: () => {
      segment.measure();
      measureWide();
    },
    intro() {
      measureWide();
      window.setTimeout(measureWide, 80);
      if (MotionSettings.reduced) return;
      render({ intro: MODES.filter((name) => wide || name === mode) });
    },
  };
}
