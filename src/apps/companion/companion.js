import { createMotion } from '../../motion/animator.js';
import { MotionSettings } from '../../motion/presets.js';
import { Storage } from '../../core/storage/storage.js';
import { Data } from '../../core/data-model.js';
import { Calc } from '../../core/calculations.js';
import { Fx } from '../../ui/fx-tier.js';
import { buildInsight } from '../reminder/insight.js';
import { Persona } from '../reminder/persona.js';
import { REACTIONS, SIZES, clampInto, findPerch, pickEgg, pickIdle, project, reactionForNotice, restUntil, stashSide } from './behavior.js';

const BASE = '/characters/coffeebean/';
const STATE_KEY = 'yoworingo.v2.pet';
const PREFS_KEY = 'yoworingo.v2.pet-prefs';
const DEFAULT_PREFS = { enabled: true, size: 'm', chatty: 'some', yield: true };
const CHATTY_MS = { some: 6 * 60000, often: 2 * 60000 };
const PEEK = 34;
const WEARY_MS = 15 * 60000;
const SPRING = { response: 0.55, damping: 0.66 };

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function soft(config) {
  return MotionSettings.reduced ? MotionSettings.spring('focus') : config;
}

function voice() {
  return Persona.isEnabled() ? Persona.getType() : 'neutral';
}

function today() {
  return Data.toDateKey(new Date());
}

export function createCompanion({ desk, menubar, store, wm, island, notifier }) {
  let prefs = { ...DEFAULT_PREFS, ...(Storage.get(PREFS_KEY, null) || {}) };
  let saved = Storage.get(STATE_KEY, null) || {};
  let mode = 'free';
  let size = SIZES[prefs.size] || SIZES.m;
  let stash = saved.stash || null;
  let perch = saved.perch || null;
  let restAt = saved.restUntil || 0;
  let yielding = false;
  let idleFile = '';
  let transient = 0;
  let lastEgg = null;
  let music = false;
  let lastInput = Date.now();
  let weather = null;
  let doneCount = 0;
  let perchRaf = 0;
  let cardOpen = false;
  let speaking = false;
  let lastSpoke = Date.now();
  let lineIndex = 0;

  const el = document.createElement('div');
  el.className = 'pet';
  el.innerHTML = '<span class="pet__shadow" aria-hidden="true"></span><div class="pet__body"><div class="pet__tilt"><img class="pet__img" alt="" draggable="false"></div></div>';
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', '桌寵，點一下打開她的卡片');
  el.tabIndex = 0;
  const body = el.querySelector('.pet__body');
  const tilt = el.querySelector('.pet__tilt');
  const img = el.querySelector('.pet__img');
  const shadow = el.querySelector('.pet__shadow');
  desk.append(el);

  const bubble = document.createElement('div');
  bubble.className = 'pet-bubble';
  bubble.hidden = true;
  bubble.innerHTML = '<p class="pet-bubble__text"></p>';
  const bubbleText = bubble.querySelector('.pet-bubble__text');
  desk.append(bubble);

  const restButton = document.createElement('button');
  restButton.type = 'button';
  restButton.className = 'mb-item mb-pet';
  restButton.setAttribute('data-mb', '');
  restButton.setAttribute('aria-label', '桌寵在休息，點一下叫她回來');
  restButton.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11.8 9.6A4.6 4.6 0 0 1 6.4 4.2a4.6 4.6 0 1 0 5.4 5.4z" fill="currentColor"/><path d="M10.4 2.6h2.2l-2.2 2.4h2.2" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  restButton.hidden = true;
  const bell = menubar.querySelector('.mb-bell');
  menubar.insertBefore(restButton, bell);

  const pos = createMotion({ x: 0, y: 0 }, { response: 0.55, damping: 0.66, restDelta: { x: 0.1, y: 0.1 } });
  const fx = createMotion({ lift: 0, squash: 0, peek: 0, tilt: 0, show: 0, press: 1 }, { response: 0.4, damping: 0.6, restDelta: { lift: 0.002, squash: 0.002, peek: 0.002, tilt: 0.05, show: 0.002, press: 0.0005 } });
  let landing = false;
  let peakSpeed = 0;

  function bounds() {
    const bar = menubar.getBoundingClientRect();
    return { left: 6, top: bar.bottom + 6, right: window.innerWidth - 6, bottom: window.innerHeight - 6 };
  }

  function box() {
    return { w: size, h: size };
  }

  function stashX(side, peek) {
    const b = bounds();
    const shown = PEEK + peek * 26;
    return side === 'left' ? b.left - size + shown : b.right - shown;
  }

  function paint() {
    const { x, y } = pos.values;
    const { lift, squash, peek, tilt: angle, show, press } = fx.values;
    const vx = pos.velocity('x');
    const vy = pos.velocity('y');
    const speed = Math.hypot(vx, vy);
    let shownX = x;
    if (mode === 'stash' || yielding) shownX = x + (stash === 'left' ? 1 : -1) * peek * 26;
    const reduced = MotionSettings.reduced;
    const stretch = reduced ? 0 : Math.min(0.16, speed / 6000);
    const along = speed > 1 ? Math.atan2(vy, vx) : 0;
    const sq = reduced ? 0 : squash;
    const sx = (1 + 0.05 * lift) * (1 + sq * 0.1) * press;
    const sy = (1 + 0.05 * lift) * (1 - sq * 0.12) * press;
    const appear = clamp(show, 0, 1.2);
    el.style.transform = `translate3d(${shownX.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    el.style.opacity = appear > 0.999 ? '' : String(clamp(show * 1.4, 0, 1));
    body.style.transform = `translateY(${(-12 * lift).toFixed(2)}px) rotate(${(along * 180 / Math.PI).toFixed(2)}deg) scale(${(1 + stretch).toFixed(4)}, ${(1 - stretch * 0.6).toFixed(4)}) rotate(${(-along * 180 / Math.PI).toFixed(2)}deg) scale(${(sx * appear).toFixed(4)}, ${(sy * appear).toFixed(4)})`;
    tilt.style.transform = Math.abs(angle) < 0.05 ? '' : `rotate(${angle.toFixed(2)}deg)`;
    shadow.style.transform = `scale(${(appear * (1 - 0.3 * lift) * (1 + sq * 0.12)).toFixed(4)}, ${(appear * (1 - 0.3 * lift)).toFixed(4)})`;
    shadow.style.opacity = String(clamp((0.32 - 0.16 * lift) * appear, 0, 1));
    if (landing) {
      peakSpeed = Math.max(peakSpeed, speed);
      if (peakSpeed > 260 && speed < 90) {
        landing = false;
        if (!reduced) {
          fx.set({ squash: Math.min(1, peakSpeed / 1400) });
          fx.to({ squash: 0 }, { response: 0.42, damping: 0.42 });
        }
      }
    }
    placeBubble();
  }
  pos.onUpdate(paint);
  fx.onUpdate(paint);

  function setSize(next) {
    size = SIZES[next] || SIZES.m;
    el.style.setProperty('--pet-size', `${size}px`);
    bubble.style.setProperty('--pet-size', `${size}px`);
  }

  const loaded = new Set();
  let wanted = '';
  function sprite(file) {
    wanted = file;
    const url = `${BASE}${file}`;
    if (loaded.has(url)) {
      img.src = url;
      return;
    }
    const probe = new Image();
    probe.onload = () => {
      loaded.add(url);
      if (wanted === file) img.src = url;
    };
    probe.onerror = () => {
      el.hidden = true;
    };
    probe.src = url;
  }

  function mood() {
    try {
      return buildInsight({ mode: 'month', anchorKey: today(), persona: voice() });
    } catch (err) {
      return null;
    }
  }

  function refreshIdle() {
    const insight = mood();
    const weary = Date.now() - lastInput > WEARY_MS;
    idleFile = pickIdle(insight ? insight.status : 'empty', today(), { music, weary });
    if (!transient) sprite(idleFile);
  }

  function react(reaction) {
    if (!reaction || mode === 'rest' || !prefs.enabled) return;
    window.clearTimeout(transient);
    sprite(reaction.file);
    if (!MotionSettings.reduced) {
      fx.set({ press: 0.94 });
      fx.to({ press: 1 }, { response: 0.42, damping: 0.4 });
    }
    transient = window.setTimeout(() => {
      transient = 0;
      sprite(idleFile);
    }, reaction.ms);
  }

  function persist(at) {
    const point = at || { x: pos.get('x'), y: pos.get('y') };
    Storage.set(STATE_KEY, { x: Math.round(point.x), y: Math.round(point.y), stash: mode === 'stash' ? stash : null, perch: mode === 'perch' ? perch : null, restUntil: restAt });
  }

  function lifted(on) {
    el.classList.toggle('is-lifted', on);
    bubble.classList.toggle('is-lifted', on);
  }

  function windowRects() {
    return Array.from(document.querySelectorAll('.wm-window')).filter((w) => {
      const id = w.dataset.appId;
      const record = id && store.get(id);
      return record && record.state === 'open' && w.style.display !== 'none' && !w.classList.contains('is-morphing');
    }).map((w) => {
      const r = w.getBoundingClientRect();
      return { id: w.dataset.appId, left: r.left, right: r.right, top: r.top, z: Number(w.style.zIndex) || 0 };
    });
  }

  function stopPerch() {
    cancelAnimationFrame(perchRaf);
    perchRaf = 0;
  }

  function followPerch() {
    stopPerch();
    const tick = () => {
      if (mode !== 'perch' || !perch) return;
      const w = document.querySelector(`.wm-window[data-app-id="${perch.id}"]`);
      const record = store.get(perch.id);
      if (!w || !record || record.state !== 'open' || w.style.display === 'none') {
        hopDown();
        return;
      }
      if (!w.classList.contains('is-morphing')) {
        const r = w.getBoundingClientRect();
        const target = { x: r.left + perch.offset * r.width - size / 2, y: r.top - size * 0.9 };
        const dx = target.x - pos.get('x');
        const dy = target.y - pos.get('y');
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) pos.to(target, { response: 0.16, damping: 0.78 });
      }
      perchRaf = requestAnimationFrame(tick);
    };
    perchRaf = requestAnimationFrame(tick);
  }

  function hopDown() {
    stopPerch();
    perch = null;
    mode = 'free';
    lifted(false);
    const b = bounds();
    const target = clampInto({ x: pos.get('x'), y: pos.get('y') + size * 0.5 }, box(), b);
    landing = true;
    peakSpeed = 0;
    pos.to(target, soft({ response: 0.5, damping: 0.55 }));
    persist();
  }

  function settle(vx = 0, vy = 0) {
    const b = bounds();
    const here = { x: pos.get('x'), y: pos.get('y') };
    const thrown = project({ ...here, vx, vy });
    const side = stashSide({ x: thrown.x, vx }, box(), b);
    const feet = { x: here.x + size / 2, y: here.y + size * 0.92 };
    const room = windowRects().filter((w) => w.top - size * 0.9 >= b.top - size * 0.15);
    const seat = side ? null : findPerch(feet, room);
    landing = true;
    peakSpeed = 0;
    if (Math.hypot(vx, vy) > 2800) window.setTimeout(() => react(REACTIONS.dizzy), 380);
    if (seat) {
      mode = 'perch';
      perch = seat;
      lifted(true);
      followPerch();
    } else if (side) {
      mode = 'stash';
      stash = side;
      lifted(false);
      pos.to({ x: stashX(side, 0), y: clamp(thrown.y, b.top, b.bottom - size) }, soft({ ...SPRING, velocity: { x: vx, y: vy } }));
    } else {
      mode = 'free';
      lifted(false);
      const target = clampInto(thrown, box(), b);
      pos.to(target, soft({ response: 0.55, damping: 0.62, velocity: { x: vx, y: vy } }));
      persist(target);
      return;
    }
    persist();
  }

  function unstash() {
    const b = bounds();
    const x = stash === 'left' ? b.left + 24 : b.right - size - 24;
    pos.set({ x: pos.get('x') + (stash === 'left' ? 1 : -1) * fx.get('peek') * 26 });
    mode = 'free';
    stash = null;
    fx.to({ peek: 0 }, { response: 0.3, damping: 1 });
    landing = true;
    peakSpeed = 0;
    pos.to({ x }, soft({ response: 0.5, damping: 0.55 }));
    persist({ x, y: pos.get('y') });
  }

  function unyield() {
    yielding = false;
    if (mode === 'stash') return;
    stash = null;
    fx.to({ peek: 0 }, { response: 0.3, damping: 1 });
    if (mode === 'perch') {
      followPerch();
      return;
    }
    landing = true;
    peakSpeed = 0;
    pos.to(clampInto({ x: saved.x, y: saved.y }, box(), bounds()), soft({ response: 0.55, damping: 0.6 }));
  }

  function applyYield() {
    if (!prefs.yield || mode === 'rest' || mode === 'drag') {
      if (yielding) unyield();
      return;
    }
    const snapped = store.all().filter((r) => r.state === 'open' && r.snap);
    const next = snapped.length > 0;
    if (next === yielding) return;
    if (!next) {
      unyield();
      return;
    }
    yielding = true;
    if (mode === 'stash') return;
    saved = { x: pos.get('x'), y: pos.get('y') };
    if (mode === 'perch') stopPerch();
    hideBubble(true);
    closeCard();
    stash = snapped.some((r) => r.snap === 'right') && !snapped.some((r) => r.snap === 'left') ? 'left' : 'right';
    pos.to({ x: stashX(stash, 0), y: clamp(pos.get('y'), bounds().top, bounds().bottom - size) }, soft({ response: 0.5, damping: 0.78 }));
  }

  function setVisible() {
    const hidden = !prefs.enabled || mode === 'rest';
    el.hidden = !prefs.enabled;
    restButton.hidden = !(prefs.enabled && mode === 'rest');
    el.inert = hidden;
    if (hidden) hideBubble(true);
  }

  function rest(choice) {
    const until = restUntil(choice);
    if (!until) return;
    closeCard();
    hideBubble(true);
    restAt = until;
    const from = { x: pos.get('x'), y: pos.get('y') };
    saved = from;
    restButton.hidden = false;
    const aim = restButton.getBoundingClientRect();
    const done = () => {
      mode = 'rest';
      stopPerch();
      lifted(false);
      pos.set(from);
      setVisible();
      persist();
      pulseButton();
    };
    if (MotionSettings.reduced) {
      fx.set({ show: 0 });
      done();
      return;
    }
    lifted(true);
    pos.to({ x: aim.left + aim.width / 2 - size / 2, y: aim.top - size * 0.35 }, { response: 0.42, damping: 0.86 });
    fx.to({ show: 0 }, { response: 0.36, damping: 1 }).then(done);
  }

  function pulseButton() {
    if (MotionSettings.reduced) return;
    const m = createMotion({ s: 0.4 }, { response: 0.4, damping: 0.45, restDelta: 0.001 });
    m.onUpdate(({ s }) => {
      restButton.style.transform = Math.abs(s - 1) < 0.001 ? '' : `scale(${s.toFixed(4)})`;
    });
    m.to({ s: 1 }, { response: 0.42, damping: 0.42 });
  }

  function wake() {
    if (mode !== 'rest') return;
    restAt = 0;
    mode = perch ? 'perch' : stash ? 'stash' : 'free';
    if (mode === 'perch') {
      lifted(true);
      followPerch();
    }
    setVisible();
    const aim = restButton.getBoundingClientRect();
    const back = mode === 'free' ? clampInto({ x: saved.x ?? pos.get('x'), y: saved.y ?? pos.get('y') }, box(), bounds()) : { x: pos.get('x'), y: pos.get('y') };
    restButton.hidden = true;
    persist();
    if (MotionSettings.reduced) {
      pos.set(back);
      fx.set({ show: 1 });
      return;
    }
    pos.set({ x: aim.left + aim.width / 2 - size / 2, y: aim.top - size * 0.35 });
    fx.set({ show: 0 });
    landing = true;
    peakSpeed = 0;
    pos.to(back, { response: 0.6, damping: 0.6 });
    fx.to({ show: 1 }, { response: 0.5, damping: 0.55 });
    window.setTimeout(() => react(REACTIONS.wake), 200);
  }

  restButton.addEventListener('click', wake);

  let drag = null;
  let pat = { dir: 0, flips: 0, since: 0, cool: 0 };

  el.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    lastInput = Date.now();
    drag = { id: event.pointerId, sx: event.clientX, sy: event.clientY, ox: event.clientX - pos.get('x'), oy: event.clientY - pos.get('y'), moved: false, samples: [] };
    if (mode === 'stash' || yielding) drag.ox = event.clientX - (pos.get('x') + (stash === 'left' ? 1 : -1) * fx.get('peek') * 26);
    try { el.setPointerCapture(event.pointerId); } catch (err) { drag.capture = false; }
    if (!MotionSettings.reduced) fx.to({ press: 0.95 }, { response: 0.14, damping: 1 });
  });

  el.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) {
      if (event.buttons === 0) detectPat(event);
      return;
    }
    const dx = event.clientX - drag.sx;
    const dy = event.clientY - drag.sy;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      closeCard();
      hideBubble();
      if (mode === 'stash' || yielding) {
        pos.set({ x: pos.get('x') + (stash === 'left' ? 1 : -1) * fx.get('peek') * 26 });
        yielding = false;
        stash = null;
        fx.set({ peek: 0 });
      }
      if (mode === 'perch') stopPerch();
      mode = 'drag';
      lifted(true);
      fx.to({ lift: 1, press: 1 }, soft({ response: 0.3, damping: 0.6 }));
    }
    const now = performance.now();
    drag.samples.push({ x: event.clientX, y: event.clientY, t: now });
    drag.samples = drag.samples.filter((s) => now - s.t < 90);
    pos.to({ x: event.clientX - drag.ox, y: event.clientY - drag.oy }, { response: 0.08, damping: 1 });
  });

  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const moved = drag.moved;
    const samples = drag.samples;
    drag = null;
    fx.to({ press: 1 }, soft({ response: 0.38, damping: 0.42 }));
    if (!moved) {
      if (mode === 'stash') {
        unstash();
        return;
      }
      if (cardOpen) react(pickAnEgg());
      else openCard();
      return;
    }
    fx.to({ lift: 0 }, soft({ response: 0.42, damping: 0.62 }));
    let vx = 0;
    let vy = 0;
    if (samples.length > 1) {
      const a = samples[0];
      const b = samples[samples.length - 1];
      const dt = Math.max(16, b.t - a.t) / 1000;
      vx = (b.x - a.x) / dt;
      vy = (b.y - a.y) / dt;
    }
    pos.set({ x: pos.get('x'), y: pos.get('y') });
    settle(clamp(vx, -4000, 4000), clamp(vy, -4000, 4000));
  }
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);

  el.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (mode === 'stash') unstash();
      else if (cardOpen) closeCard();
      else openCard();
    }
  });

  function pickAnEgg() {
    const egg = pickEgg(Math.random(), lastEgg);
    lastEgg = egg.file;
    return egg;
  }

  function detectPat(event) {
    const r = el.getBoundingClientRect();
    if (event.clientY > r.top + r.height * 0.45 || (mode !== 'free' && mode !== 'perch')) return;
    const now = performance.now();
    const dir = Math.sign(event.movementX || 0);
    if (!dir) return;
    if (now - pat.since > 1400) pat = { ...pat, flips: 0, since: now, dir };
    if (dir !== pat.dir) {
      pat.flips += 1;
      pat.dir = dir;
    }
    if (pat.flips >= 4 && now > pat.cool) {
      pat = { dir: 0, flips: 0, since: 0, cool: now + 4000 };
      react(REACTIONS.pat);
      if (prefs.chatty !== 'off') say(['嘿嘿', '再摸一下', '好舒服'][Math.floor(Math.random() * 3)]);
    }
  }

  let tiltRaf = 0;
  let pointer = null;
  document.addEventListener('pointermove', (event) => {
    pointer = { x: event.clientX, y: event.clientY };
    lastInput = Date.now();
    if (tiltRaf) return;
    tiltRaf = requestAnimationFrame(() => {
      tiltRaf = 0;
      if (!prefs.enabled || mode === 'rest' || MotionSettings.reduced) return;
      const cx = pos.get('x') + size / 2;
      const cy = pos.get('y') + size / 2;
      if (mode === 'stash' || yielding) {
        const shownX = stashX(stash || 'right', 0) + (stash === 'left' ? size - PEEK : PEEK);
        const near = Math.abs(pointer.x - shownX) < 90 && pointer.y > pos.get('y') - 30 && pointer.y < pos.get('y') + size + 30;
        fx.to({ peek: near ? 1 : 0 }, { response: 0.36, damping: 0.6 });
        return;
      }
      const dx = pointer.x - cx;
      const dy = pointer.y - cy;
      const near = Math.hypot(dx, dy) < 380 && mode !== 'drag';
      fx.to({ tilt: near ? clamp(dx / 380, -1, 1) * 7 : 0 }, { response: 0.6, damping: 0.6 });
    });
  }, { passive: true });
  document.addEventListener('keydown', () => { lastInput = Date.now(); });

  const card = document.createElement('div');
  card.className = 'pet-card';
  card.innerHTML = '<span class="pet-card__shadow" aria-hidden="true"></span><span class="pet-card__glass" aria-hidden="true"></span><span class="pet-card__fill" aria-hidden="true"></span><div class="pet-card__body"></div>';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', '桌寵');
  card.tabIndex = -1;
  const cardBody = card.querySelector('.pet-card__body');
  const cardFill = card.querySelector('.pet-card__fill');
  const cardGlass = card.querySelector('.pet-card__glass');
  const cardShadow = card.querySelector('.pet-card__shadow');
  desk.append(card);
  const morph = createMotion({ o: 0 }, { response: 0.44, damping: 0.64, restDelta: 0.0005 });
  let cardBox = { w: 0, h: 0, sx: 0, sy: 0, sw: 0, sh: 0 };

  function paintCard({ o }) {
    const t = clamp(o, 0, 1);
    const k = 1 - t;
    const top = cardBox.sy * k;
    const left = cardBox.sx * k;
    const right = (cardBox.w - cardBox.sx - cardBox.sw) * k;
    const bottom = (cardBox.h - cardBox.sy - cardBox.sh) * k;
    const r = 18 + (16 - 18) * t;
    const clip = `inset(${top.toFixed(2)}px ${right.toFixed(2)}px ${bottom.toFixed(2)}px ${left.toFixed(2)}px round ${r.toFixed(2)}px)`;
    cardFill.style.clipPath = clip;
    cardBody.style.clipPath = clip;
    cardShadow.style.transform = `translate3d(${left.toFixed(2)}px, ${top.toFixed(2)}px, 0)`;
    cardShadow.style.width = `${Math.max(0, cardBox.w - left - right)}px`;
    cardShadow.style.height = `${Math.max(0, cardBox.h - top - bottom)}px`;
    const over = Math.max(0, o - 1);
    card.style.transform = over > 0.0005 ? `scale(${(1 + over * 0.08).toFixed(4)})` : '';
    card.style.transformOrigin = `${(cardBox.sx + cardBox.sw / 2).toFixed(1)}px ${(cardBox.sy + cardBox.sh / 2).toFixed(1)}px`;
    cardGlass.hidden = !(cardOpen && t > 0.995 && Math.abs(o - 1) < 0.01);
    card.style.visibility = o > 0.002 || cardOpen ? 'visible' : 'hidden';
  }
  morph.onUpdate(paintCard);

  function line(textValue, className) {
    const p = document.createElement('p');
    p.className = className;
    p.textContent = textValue;
    return p;
  }

  function nextTask() {
    const now = new Date();
    for (let i = 0; i < 3; i += 1) {
      const key = Calc.shiftDateKey(today(), i);
      const tasks = Data.getDayTasks(key).filter((t) => !t.done && t.text);
      const upcoming = tasks.filter((t) => i > 0 || !t.time || (() => {
        const [hh, mm] = t.time.split(':').map(Number);
        return hh * 60 + mm >= now.getHours() * 60 + now.getMinutes();
      })()).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
      if (upcoming.length) {
        const t = upcoming[0];
        const day = i === 0 ? '今天' : i === 1 ? '明天' : '後天';
        return { text: `${day}${t.time ? ` ${t.time}` : ''} · ${t.text}`, key };
      }
    }
    return null;
  }

  function weatherLine() {
    if (!weather || !weather.current) return null;
    return `${weather.location ? weather.location.name : ''} ${weather.current.text} ${Math.round(weather.temperature)}°`.trim();
  }

  function buildCard() {
    cardBody.textContent = '';
    const insight = mood();
    const lead = line(insight ? insight.lead : '今天也一起加油', 'pet-card__lead');
    const pieces = [lead];
    if (insight && insight.sub) pieces.push(line(insight.sub, 'pet-card__sub'));
    const facts = document.createElement('div');
    facts.className = 'pet-card__facts';
    const task = nextTask();
    if (task) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pet-card__fact';
      b.innerHTML = '<span>下一件</span><b></b>';
      b.querySelector('b').textContent = task.text;
      b.addEventListener('click', () => {
        closeCard();
        wm.open('calendar');
      });
      facts.append(b);
    }
    const wx = weatherLine();
    if (wx) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pet-card__fact';
      b.innerHTML = '<span>天氣</span><b></b>';
      b.querySelector('b').textContent = wx;
      b.addEventListener('click', () => {
        closeCard();
        wm.open('weather');
      });
      facts.append(b);
    }
    if (facts.childElementCount) pieces.push(facts);
    const actions = document.createElement('div');
    actions.className = 'pet-card__actions';
    [['記一筆', () => island.open()], ['看總覽', () => wm.open('overview')], ['逗她', () => react(pickAnEgg())]].forEach(([label, fn], i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `pet-card__btn${i === 0 ? ' is-main' : ''}`;
      b.textContent = label;
      b.addEventListener('click', () => {
        if (label !== '逗她') closeCard();
        fn();
      });
      actions.append(b);
    });
    pieces.push(actions);
    const restRow = document.createElement('div');
    restRow.className = 'pet-card__rest';
    restRow.innerHTML = '<span>先休息</span>';
    [['30m', '30 分鐘'], ['1h', '1 小時'], ['tomorrow', '到明天']].forEach(([value, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pet-card__chip';
      b.textContent = label;
      b.addEventListener('click', () => rest(value));
      restRow.append(b);
    });
    pieces.push(restRow);
    pieces.forEach((piece) => cardBody.append(piece));
    return pieces;
  }

  function openCard() {
    if (cardOpen || mode === 'rest') return;
    cardOpen = true;
    hideBubble(true);
    card.classList.add('is-open');
    const pieces = buildCard();
    const petRect = el.querySelector('.pet__img').getBoundingClientRect();
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const b = bounds();
    const roomRight = b.right - petRect.right;
    let left = roomRight > w + 12 ? petRect.right - size * 0.12 : petRect.left - w + size * 0.12;
    left = clamp(left, b.left + 6, b.right - w - 6);
    const top = clamp(petRect.top - h * 0.35, b.top + 6, b.bottom - h - 6);
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    cardBox = { w, h, sx: clamp(petRect.left - left, 0, w), sy: clamp(petRect.top - top, 0, h), sw: Math.min(petRect.width, w), sh: Math.min(petRect.height, h) };
    cardGlass.style.height = `${h}px`;
    if (MotionSettings.reduced) {
      morph.set({ o: 1 });
    } else {
      morph.set({ o: 0 });
      morph.to({ o: 1 }, { response: 0.46, damping: 0.62 });
      pieces.forEach((piece, i) => {
        const node = piece;
        const handler = ({ e, y }) => {
          const t = clamp(e, 0, 1);
          node.style.opacity = t > 0.999 ? '' : String(t);
          node.style.transform = Math.abs(y) < 0.05 && t > 0.999 ? '' : `translate3d(0, ${y.toFixed(2)}px, 0)`;
          node.style.filter = t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * 4).toFixed(2)}px)` : '';
        };
        const motion = createMotion({ e: 0, y: 14 + i * 6 }, { response: 0.4, damping: 0.66, restDelta: { e: 0.002, y: 0.05 } });
        motion.onUpdate(handler);
        handler({ e: 0, y: 14 + i * 6 });
        motion.to({ e: 1 }, { response: 0.3 + i * 0.03, damping: 1 });
        motion.to({ y: 0 }, { response: 0.44 + i * 0.05, damping: 0.6 });
      });
    }
    window.setTimeout(() => card.focus({ preventScroll: true }), 60);
  }

  function closeCard() {
    if (!cardOpen) return;
    cardOpen = false;
    cardGlass.hidden = true;
    if (MotionSettings.reduced) {
      morph.set({ o: 0 });
      card.classList.remove('is-open');
      return;
    }
    morph.to({ o: 0 }, { response: 0.32, damping: 0.86 }).then((done) => {
      if (done && !cardOpen) card.classList.remove('is-open');
    });
  }

  card.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeCard();
      el.focus({ preventScroll: true });
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (!cardOpen) return;
    if (card.contains(event.target) || el.contains(event.target)) return;
    closeCard();
  }, true);

  const bubbleMotion = createMotion({ s: 0 }, { response: 0.42, damping: 0.55, restDelta: 0.001 });
  let bubbleTimer = 0;
  let typeTimer = 0;
  bubbleMotion.onUpdate(({ s }) => {
    const t = clamp(s, 0, 1.3);
    bubble.style.opacity = String(clamp(s * 1.6, 0, 1));
    bubble.style.setProperty('--s', t.toFixed(4));
  });

  function placeBubble() {
    if (bubble.hidden) return;
    const x = pos.get('x');
    const y = pos.get('y');
    const w = bubble.offsetWidth;
    const h = bubble.offsetHeight;
    const right = x + size * 0.62 + w < window.innerWidth - 8;
    bubble.classList.toggle('is-left', !right);
    const left = right ? x + size * 0.62 : x + size * 0.38 - w;
    bubble.style.left = `${clamp(left, 8, window.innerWidth - w - 8)}px`;
    bubble.style.top = `${Math.max(bounds().top, y - h + size * 0.12)}px`;
  }

  function say(textValue) {
    if (!textValue || cardOpen || mode === 'rest' || mode === 'stash' || yielding || !prefs.enabled) return;
    if (notifier && notifier.quiet) return;
    speaking = true;
    lastSpoke = Date.now();
    window.clearTimeout(bubbleTimer);
    window.clearInterval(typeTimer);
    bubble.hidden = false;
    bubbleText.textContent = '';
    const chars = Array.from(textValue);
    bubbleText.setAttribute('aria-label', textValue);
    bubbleText.style.minWidth = '';
    placeBubble();
    if (MotionSettings.reduced) {
      bubbleText.textContent = textValue;
      bubbleMotion.set({ s: 1 });
    } else {
      bubbleMotion.set({ s: 0.3 });
      bubbleMotion.to({ s: 1 }, { response: 0.42, damping: 0.52 });
      let i = 0;
      typeTimer = window.setInterval(() => {
        i += 1;
        bubbleText.textContent = chars.slice(0, i).join('');
        placeBubble();
        if (i >= chars.length) window.clearInterval(typeTimer);
      }, 34);
    }
    bubbleTimer = window.setTimeout(() => hideBubble(), 4200 + chars.length * 80);
  }

  function hideBubble(instant) {
    window.clearTimeout(bubbleTimer);
    window.clearInterval(typeTimer);
    if (bubble.hidden) return;
    speaking = false;
    if (instant || MotionSettings.reduced) {
      bubble.hidden = true;
      bubbleMotion.set({ s: 0 });
      return;
    }
    bubbleMotion.to({ s: 0 }, { response: 0.26, damping: 1 }).then((done) => {
      if (done) bubble.hidden = true;
    });
  }

  function nextLine() {
    const insight = mood();
    const options = [];
    if (insight && insight.current !== false) options.push(insight.sub || insight.lead);
    const task = nextTask();
    if (task) options.push(`別忘了：${task.text}`);
    const wx = weatherLine();
    if (wx) options.push(wx);
    if (!options.length) return null;
    lineIndex = (lineIndex + 1) % options.length;
    return options[lineIndex];
  }

  window.setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    const gap = CHATTY_MS[prefs.chatty];
    if (gap && !speaking && Date.now() - lastSpoke > gap && Date.now() - lastInput < 10 * 60000) say(nextLine());
    if (mode === 'rest' && restAt && Date.now() >= restAt) wake();
    const wasWeary = idleFile && idleFile.includes('stopped');
    const weary = Date.now() - lastInput > WEARY_MS;
    if (weary !== wasWeary) {
      refreshIdle();
      if (!weary) react(REACTIONS.wake);
    }
  }, 20000);

  window.addEventListener('yoworingo:entry-added', () => react(REACTIONS.added));
  window.addEventListener('yoworingo:entry-removed', () => react(REACTIONS.removed));
  window.addEventListener('yoworingo:goal-deposit', () => react(REACTIONS.deposit));
  window.addEventListener('yoworingo:persona-change', refreshIdle);

  function countDone() {
    let total = 0;
    Object.values(Data.getState().days || {}).forEach((day) => {
      (day.tasks || []).forEach((t) => { if (t.done) total += 1; });
    });
    return total;
  }
  doneCount = countDone();
  Data.subscribe(() => {
    const next = countDone();
    if (next > doneCount) react(REACTIONS.taskDone);
    doneCount = next;
    refreshIdle();
  });

  if (notifier) {
    notifier.subscribe(({ type }) => {
      if (type !== 'add' || notifier.quiet) return;
      const item = notifier.history[0];
      react(reactionForNotice(item));
    });
  }

  const radioWrap = menubar.querySelector('.mb-radio');
  if (radioWrap) {
    new MutationObserver(() => {
      const next = radioWrap.classList.contains('is-playing');
      if (next === music) return;
      music = next;
      refreshIdle();
    }).observe(radioWrap, { attributes: true, attributeFilter: ['class'] });
  }

  store.subscribe(({ type }) => {
    if (type === 'snap' || type === 'unsnap' || type === 'open' || type === 'close' || type === 'minimize' || type === 'restore') applyYield();
  });

  window.addEventListener('resize', () => {
    if (mode === 'free') pos.set(clampInto({ x: pos.get('x'), y: pos.get('y') }, box(), bounds()));
    paint();
  });

  function boot() {
    setSize(prefs.size);
    const b = bounds();
    const start = Number.isFinite(saved.x) && Number.isFinite(saved.y) ? clampInto({ x: saved.x, y: saved.y }, box(), b) : { x: b.right - size - 40, y: b.bottom - size - 110 };
    pos.set(start);
    saved = { ...start };
    if (restAt && restAt > Date.now()) mode = 'rest';
    else {
      restAt = 0;
      if (stash) {
        mode = 'stash';
        pos.set({ x: stashX(stash, 0) });
      } else if (perch) {
        mode = 'perch';
        lifted(true);
        followPerch();
      }
    }
    refreshIdle();
    setVisible();
    if (mode === 'rest' || MotionSettings.reduced) {
      fx.set({ show: mode === 'rest' ? 0 : 1 });
      return;
    }
    fx.set({ show: 0 });
    window.setTimeout(() => {
      if (mode === 'free') {
        landing = true;
        peakSpeed = 0;
        pos.set({ x: start.x, y: start.y - 40 });
        pos.to(start, { response: 0.6, damping: 0.5 });
      }
      fx.to({ show: 1 }, { response: 0.5, damping: 0.55 });
      applyYield();
    }, 900);
  }

  boot();

  return {
    get prefs() { return { ...prefs }; },
    setPrefs(patch) {
      prefs = { ...prefs, ...patch };
      Storage.set(PREFS_KEY, prefs);
      if (patch.size) {
        setSize(prefs.size);
        if (mode === 'free') pos.to(clampInto({ x: pos.get('x'), y: pos.get('y') }, box(), bounds()), soft(SPRING));
        if (!MotionSettings.reduced) {
          fx.set({ press: 0.9 });
          fx.to({ press: 1 }, { response: 0.42, damping: 0.42 });
        }
      }
      if (patch.enabled !== undefined) {
        if (!prefs.enabled) {
          closeCard();
          hideBubble(true);
        } else if (!MotionSettings.reduced) {
          fx.set({ show: 0 });
          fx.to({ show: 1 }, { response: 0.5, damping: 0.55 });
        }
        setVisible();
      }
      if (patch.yield !== undefined) applyYield();
    },
    setWeather(info) {
      weather = info;
    },
    wake,
    say,
    get mode() { return mode; },
    get position() { return { x: pos.get('x'), y: pos.get('y') }; },
  };
}
