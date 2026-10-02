import { createMotion } from '../../motion/animator.js';
import { MotionSettings } from '../../motion/presets.js';
import { Storage } from '../../core/storage/storage.js';
import { Data } from '../../core/data-model.js';
import { Calc } from '../../core/calculations.js';
import { Fx } from '../../ui/fx-tier.js';
import { buildInsight } from '../reminder/insight.js';
import { Persona } from '../reminder/persona.js';
import { REACTIONS, SIZES, clampInto, findPerch, pickEgg, pickIdle, project, reactionForNotice, restUntil, stashSide } from './behavior.js';
import { GOALS, count as countLife, decay, dayOf, feed, goalsFor, levelOf, markSeen, normalize, nudgeMood, stateOf, sync as syncDay } from './pet-model.js';
import { eventLine, stateLine } from './pet-lines.js';

const BASE = '/characters/coffeebean/';
const STATE_KEY = 'yoworingo.v2.pet';
const PREFS_KEY = 'yoworingo.v2.pet-prefs';
const LIFE_KEY = 'yoworingo.v2.pet-life';
const DEFAULT_PREFS = { enabled: true, size: 'm', chatty: 'some', yield: true };
const CHATTY_MS = { some: 6 * 60000, often: 2 * 60000 };
const WEARY_MS = 15 * 60000;
const SPRING = { response: 0.55, damping: 0.66 };
const PEEK_SHARE = 0.55;
const HANDLE_H = 56;

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
  let landing = false;
  let peakSpeed = 0;
  let seat = null;
  let life = normalize(Storage.get(LIFE_KEY, null));
  let lifeTimer = 0;

  function saveLife() {
    window.clearTimeout(lifeTimer);
    lifeTimer = window.setTimeout(() => Storage.set(LIFE_KEY, JSON.parse(JSON.stringify(life))), 300);
  }

  function lifeVars() {
    const lv = levelOf(life.bond);
    return { name: life.name, streak: life.streak.count, title: lv.title };
  }

  function lifeCtx() {
    const key = today();
    const day = Data.getDayEntries(key);
    const income = day.income || [];
    const expenses = day.expenses || [];
    const all = [...income, ...expenses];
    const monthKey = Data.toMonthKey(key);
    const budgets = Data.getMonthlyBudgets(monthKey);
    const monthly = Object.values(budgets).reduce((sum, v) => sum + (Number(v) || 0), 0);
    return {
      entries: all.length,
      tagged: expenses.filter((e) => e.necessity === 'need' || e.necessity === 'want').length,
      noted: all.filter((e) => e.note && String(e.note).trim()).length,
      pendingTasks: Data.getDayTasks(key).filter((t) => !t.done).length,
      goals: (Data.getState().settings.savingsGoals || []).length,
      dailyBudget: monthly ? monthly / Calc.getMonthDateKeys(monthKey).length : 0,
      expense: expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
      hour: new Date().getHours(),
    };
  }

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

  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'pet-handle';
  handle.setAttribute('aria-label', '桌寵藏在這裡，點一下叫她出來');
  handle.innerHTML = '<i></i>';
  handle.hidden = true;
  desk.append(handle);

  const seatLine = document.createElement('span');
  seatLine.className = 'pet-seat';
  seatLine.setAttribute('aria-hidden', 'true');
  seatLine.innerHTML = '<i></i>';
  const seatDot = seatLine.querySelector('i');
  desk.append(seatLine);

  const bubble = document.createElement('div');
  bubble.className = 'pet-bubble';
  bubble.hidden = true;
  bubble.innerHTML = '<p class="pet-bubble__text"></p>';
  const bubbleText = bubble.querySelector('.pet-bubble__text');
  desk.append(bubble);

  const card = document.createElement('div');
  card.className = 'pet-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', '桌寵');
  card.tabIndex = -1;
  card.hidden = true;
  desk.append(card);

  const restButton = document.createElement('button');
  restButton.type = 'button';
  restButton.className = 'mb-item mb-pet';
  restButton.setAttribute('data-mb', '');
  restButton.setAttribute('aria-label', '桌寵在休息，點一下叫她回來');
  restButton.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11.8 9.6A4.6 4.6 0 0 1 6.4 4.2a4.6 4.6 0 1 0 5.4 5.4z" fill="currentColor"/><path d="M10.4 2.6h2.2l-2.2 2.4h2.2" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  restButton.hidden = true;
  menubar.insertBefore(restButton, menubar.querySelector('.mb-bell'));

  const pos = createMotion({ x: 0, y: 0 }, { response: 0.55, damping: 0.66, restDelta: { x: 0.1, y: 0.1 } });
  const fx = createMotion({ lift: 0, squash: 0, peek: 0, tilt: 0, show: 0, press: 1, ready: 0, grip: 0 }, { response: 0.4, damping: 0.6, restDelta: { lift: 0.002, squash: 0.002, peek: 0.002, tilt: 0.05, show: 0.002, press: 0.0005, ready: 0.002, grip: 0.002 } });
  const cardMotion = createMotion({ s: 0 }, { response: 0.42, damping: 0.6, restDelta: 0.001 });
  const bubbleMotion = createMotion({ s: 0 }, { response: 0.42, damping: 0.55, restDelta: 0.001 });
  const seatMotion = createMotion({ o: 0 }, { response: 0.26, damping: 0.8, restDelta: 0.002 });

  function bounds() {
    const bar = menubar.getBoundingClientRect();
    return { left: 6, top: bar.bottom + 6, right: window.innerWidth - 6, bottom: window.innerHeight - 6 };
  }

  function box() {
    return { w: size, h: size };
  }

  function hidden() {
    return mode === 'stash' || yielding;
  }

  function stashX(side) {
    const b = bounds();
    return side === 'left' ? b.left - size - 8 : b.right + 8;
  }

  function shownX() {
    const x = pos.get('x');
    if (!hidden()) return x;
    return x + (stash === 'left' ? 1 : -1) * fx.get('peek') * size * PEEK_SHARE;
  }

  function paint() {
    const y = pos.get('y');
    const { lift, squash, tilt: angle, show, press, ready } = fx.values;
    const vx = pos.velocity('x');
    const vy = pos.velocity('y');
    const speed = Math.hypot(vx, vy);
    const reduced = MotionSettings.reduced;
    const stretch = reduced ? 0 : Math.min(0.16, speed / 6000);
    const along = speed > 1 ? (Math.atan2(vy, vx) * 180) / Math.PI : 0;
    const sq = reduced ? 0 : squash;
    const sx = (1 + 0.05 * lift) * (1 + sq * 0.1) * (1 + ready * 0.04) * press;
    const sy = (1 + 0.05 * lift) * (1 - sq * 0.12) * (1 - ready * 0.07) * press;
    const appear = clamp(show, 0, 1.2);
    el.style.transform = `translate3d(${shownX().toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    el.style.opacity = appear > 0.999 ? '' : String(clamp(show * 1.4, 0, 1));
    body.style.transform = `translateY(${(-12 * lift + ready * size * 0.03).toFixed(2)}px) rotate(${along.toFixed(2)}deg) scale(${(1 + stretch).toFixed(4)}, ${(1 - stretch * 0.6).toFixed(4)}) rotate(${(-along).toFixed(2)}deg) scale(${(sx * appear).toFixed(4)}, ${(sy * appear).toFixed(4)})`;
    tilt.style.transform = Math.abs(angle) < 0.05 ? '' : `rotate(${angle.toFixed(2)}deg)`;
    shadow.style.transform = `scale(${(appear * (1 - 0.3 * lift) * (1 + sq * 0.12)).toFixed(4)}, ${(appear * (1 - 0.3 * lift)).toFixed(4)})`;
    shadow.style.opacity = String(clamp((0.32 - 0.16 * lift) * appear * (1 - ready * 0.6), 0, 1));
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
    paintHandle();
    placeBubble();
    placeCard();
  }
  pos.onUpdate(paint);
  fx.onUpdate(paint);

  function paintHandle() {
    const on = hidden() && mode !== 'rest' && prefs.enabled;
    handle.hidden = !on && fx.get('grip') < 0.01;
    if (handle.hidden) return;
    const b = bounds();
    const top = clamp(pos.get('y') + size * 0.5 - HANDLE_H / 2, b.top, b.bottom - HANDLE_H);
    const left = stash === 'left' ? 2 : window.innerWidth - 10;
    const grip = clamp(fx.get('grip'), 0, 1.2);
    handle.style.transform = `translate3d(${left}px, ${top.toFixed(2)}px, 0) scale(${(0.4 + 0.6 * grip).toFixed(4)}, ${(0.6 + 0.4 * grip).toFixed(4)})`;
    handle.style.opacity = String(clamp(grip, 0, 1) * (1 - fx.get('peek') * 0.7));
    handle.classList.toggle('is-left', stash === 'left');
  }

  function setSize(next) {
    size = Math.min(SIZES[next] || SIZES.m, Math.max(120, Math.round(window.innerWidth * 0.42)));
    el.style.setProperty('--pet-size', `${size}px`);
  }

  const loaded = new Set();
  let wanted = '';
  function sprite(file) {
    wanted = file;
    if (!life.seen.includes(file)) {
      life = markSeen(life, file);
      saveLife();
    }
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
    idleFile = pickIdle(insight ? insight.status : 'empty', today(), { music, weary, pet: stateOf(life) });
    if (!transient) sprite(idleFile);
  }

  function syncLife() {
    const now = Date.now();
    const before = stateOf(life);
    life = decay(life, now);
    const out = syncDay(life, today(), lifeCtx());
    life = out.life;
    saveLife();
    out.events.forEach((event, i) => {
      window.setTimeout(() => handleLifeEvent(event), i * 1400);
    });
    if (stateOf(life) !== before) refreshIdle();
    if (cardOpen) updateStats();
  }

  function handleLifeEvent(event) {
    const vars = lifeVars();
    if (event.type === 'checkin') {
      react(REACTIONS.checkin);
      const milestone = [100, 30, 7].find((n) => event.streak === n);
      say(eventLine(milestone ? `streak${milestone}` : 'checkin', voice(), vars, event.streak));
    } else if (event.type === 'goal') {
      say(eventLine('goal', voice(), vars, Date.now()));
    } else if (event.type === 'level') {
      react(REACTIONS.levelUp);
      say(eventLine('level', voice(), { ...vars, title: event.title }, event.level));
      island.toast({ text: `${life.name} 升到 Lv${event.level}`, note: event.title, duration: 3600 });
    }
  }

  function changeLife(next) {
    life = next;
    saveLife();
    syncLife();
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

  function seatable() {
    const b = bounds();
    return windowRects().filter((w) => w.top - size * 0.9 >= b.top - size * 0.15);
  }

  function feet() {
    return { x: pos.get('x') + size / 2, y: pos.get('y') + size * 0.92 };
  }

  function showSeat(next, foot = feet()) {
    const changed = (next && next.id) !== (seat && seat.id);
    seat = next;
    if (next) {
      const win = windowRects().find((w) => w.id === next.id);
      if (win) {
        seatLine.style.left = `${win.left + 10}px`;
        seatLine.style.top = `${win.top - 1}px`;
        seatLine.style.width = `${Math.max(0, win.right - win.left - 20)}px`;
        seatDot.style.left = `${clamp(foot.x - win.left - 10 - 7, 0, win.right - win.left - 34)}px`;
      }
      if (changed) seatMotion.to({ o: 1 }, soft({ response: 0.3, damping: 0.62 }));
      fx.to({ ready: 1 }, soft({ response: 0.3, damping: 0.6 }));
    } else {
      seatMotion.to({ o: 0 }, { response: 0.2, damping: 1 });
      fx.to({ ready: 0 }, soft({ response: 0.34, damping: 0.62 }));
    }
  }
  seatMotion.onUpdate(({ o }) => {
    const t = clamp(o, 0, 1.2);
    seatLine.style.opacity = String(clamp(o, 0, 1));
    seatLine.style.transform = `scaleX(${(0.6 + 0.4 * t).toFixed(4)})`;
    seatLine.hidden = o < 0.01;
  });

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
        if (Math.abs(target.x - pos.get('x')) > 0.5 || Math.abs(target.y - pos.get('y')) > 0.5) pos.to(target, { response: 0.16, damping: 0.78 });
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
    const target = clampInto({ x: pos.get('x'), y: pos.get('y') + size * 0.5 }, box(), bounds());
    landing = true;
    peakSpeed = 0;
    pos.to(target, soft({ response: 0.5, damping: 0.55 }));
    persist(target);
  }

  function hideTo(side, y) {
    stash = side;
    fx.to({ grip: 1 }, soft({ response: 0.4, damping: 0.55 }));
    fx.to({ peek: 0 }, { response: 0.3, damping: 1 });
    pos.to({ x: stashX(side), y: clamp(y, bounds().top, bounds().bottom - size) }, soft({ response: 0.46, damping: 0.86 }));
  }

  function settle(vx = 0, vy = 0) {
    const b = bounds();
    const here = { x: pos.get('x'), y: pos.get('y') };
    const thrown = project({ ...here, vx, vy });
    const side = stashSide({ x: thrown.x, vx }, box(), b);
    const spot = side ? null : seat || findPerch(feet(), seatable());
    showSeat(null);
    landing = true;
    peakSpeed = 0;
    if (Math.hypot(vx, vy) > 2800) window.setTimeout(() => react(REACTIONS.dizzy), 380);
    if (spot) {
      mode = 'perch';
      perch = { id: spot.id, offset: spot.offset };
      lifted(true);
      if (!MotionSettings.reduced) {
        seatMotion.set({ o: 1 });
        seatMotion.to({ o: 0 }, { response: 0.6, damping: 1 });
        seatLine.classList.add('is-flash');
        window.setTimeout(() => seatLine.classList.remove('is-flash'), 500);
      }
      followPerch();
      persist();
      return;
    }
    if (side) {
      mode = 'stash';
      lifted(false);
      closeCard();
      hideTo(side, thrown.y);
      persist({ x: stashX(side), y: clamp(thrown.y, b.top, b.bottom - size) });
      return;
    }
    mode = 'free';
    lifted(false);
    const target = clampInto(thrown, box(), b);
    pos.to(target, soft({ response: 0.55, damping: 0.62, velocity: { x: vx, y: vy } }));
    persist(target);
  }

  function unstash() {
    const b = bounds();
    const x = stash === 'left' ? b.left + 24 : b.right - size - 24;
    pos.set({ x: shownX() });
    mode = 'free';
    yielding = false;
    stash = null;
    fx.set({ peek: 0 });
    fx.to({ grip: 0 }, { response: 0.24, damping: 1 });
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
    fx.to({ grip: 0 }, { response: 0.24, damping: 1 });
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
    hideTo(snapped.some((r) => r.snap === 'right') && !snapped.some((r) => r.snap === 'left') ? 'left' : 'right', pos.get('y'));
  }

  function setVisible() {
    el.hidden = !prefs.enabled;
    restButton.hidden = !(prefs.enabled && mode === 'rest');
    el.inert = !prefs.enabled || mode === 'rest';
    if (!prefs.enabled || mode === 'rest') {
      hideBubble(true);
      closeCard(true);
    }
    paintHandle();
  }

  function pulseButton() {
    if (MotionSettings.reduced) return;
    const m = createMotion({ s: 0.4 }, { response: 0.4, damping: 0.45, restDelta: 0.001 });
    m.onUpdate(({ s }) => {
      restButton.style.transform = Math.abs(s - 1) < 0.001 ? '' : `scale(${s.toFixed(4)})`;
    });
    m.to({ s: 1 }, { response: 0.42, damping: 0.42 });
  }

  function rest(choice) {
    const until = restUntil(choice);
    if (!until) return;
    closeCard(true);
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
      persist(from);
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

  function wake() {
    if (mode !== 'rest') return;
    restAt = 0;
    mode = perch ? 'perch' : stash ? 'stash' : 'free';
    if (mode === 'perch') {
      lifted(true);
      followPerch();
    }
    const aim = restButton.getBoundingClientRect();
    const back = mode === 'free' ? clampInto({ x: saved.x ?? pos.get('x'), y: saved.y ?? pos.get('y') }, box(), bounds()) : { x: pos.get('x'), y: pos.get('y') };
    setVisible();
    persist(back);
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

  const hint = (() => {
    const node = document.createElement('span');
    node.className = 'pet-hint';
    node.setAttribute('aria-hidden', 'true');
    node.innerHTML = '<svg viewBox="0 0 32 32"><path d="M11 16V7.5a2 2 0 0 1 4 0V15m0-6.5a2 2 0 0 1 4 0V15m0-5a2 2 0 0 1 4 0v6.5m0-3.5a2 2 0 0 1 4 0V20c0 5-3.6 9-8.5 9h-1.6c-2.6 0-4.6-1.1-6.2-3.2l-4.3-5.9a2 2 0 0 1 3-2.6L11 19.5" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    node.hidden = true;
    desk.append(node);
    const motion = createMotion({ x: 0, o: 0 }, { response: 0.34, damping: 0.7, restDelta: { x: 0.002, o: 0.002 } });
    let token = 0;
    motion.onUpdate(({ x, o }) => {
      const left = shownX() + size * 0.5 - 16 + x * size * 0.18;
      const top = pos.get('y') + size * 0.3;
      node.style.transform = `translate3d(${left.toFixed(2)}px, ${top.toFixed(2)}px, 0) rotate(${(x * 12).toFixed(2)}deg)`;
      node.style.opacity = String(clamp(o, 0, 1));
    });
    return {
      async show() {
        const mine = ++token;
        node.hidden = false;
        motion.set({ x: 0, o: 0 });
        await motion.to({ o: 1 }, { response: 0.26, damping: 1 });
        for (let i = 0; i < 4 && mine === token; i += 1) {
          await motion.to({ x: i % 2 ? -1 : 1 }, MotionSettings.reduced ? { response: 0.3, damping: 1 } : { response: 0.32, damping: 0.72 });
        }
        if (mine !== token) return;
        await motion.to({ x: 0, o: 0 }, { response: 0.3, damping: 1 });
        if (mine === token) node.hidden = true;
      },
      hide() {
        token += 1;
        motion.to({ o: 0 }, { response: 0.2, damping: 1 }).then(() => {
          node.hidden = true;
        });
      },
    };
  })();

  function teachPat() {
    closeCard();
    say(`把游標放在 ${life.name} 身上，不用按，左右輕輕滑幾下就好～`);
    window.setTimeout(() => hint.show(), 350);
  }

  el.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    lastInput = Date.now();
    drag = { id: event.pointerId, sx: event.clientX, sy: event.clientY, ox: event.clientX - shownX(), oy: event.clientY - pos.get('y'), moved: false, samples: [] };
    try { el.setPointerCapture(event.pointerId); } catch (err) { drag.free = true; }
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
      hideBubble();
      if (hidden()) {
        pos.set({ x: shownX() });
        yielding = false;
        stash = null;
        fx.set({ peek: 0 });
        fx.to({ grip: 0 }, { response: 0.24, damping: 1 });
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
    const foot = { x: event.clientX - drag.ox + size / 2, y: event.clientY - drag.oy + size * 0.92 };
    showSeat(findPerch(foot, seatable()), foot);
  });

  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const moved = drag.moved;
    const samples = drag.samples;
    drag = null;
    fx.to({ press: 1 }, soft({ response: 0.38, damping: 0.42 }));
    if (!moved) {
      if (hidden()) {
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
      if (hidden()) unstash();
      else if (cardOpen) closeCard();
      else openCard();
    }
  });

  let handleDrag = null;
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    handleDrag = { id: event.pointerId, sx: event.clientX, sy: event.clientY, y: pos.get('y'), moved: false };
    try { handle.setPointerCapture(event.pointerId); } catch (err) { handleDrag.free = true; }
  });
  handle.addEventListener('pointermove', (event) => {
    if (!handleDrag || event.pointerId !== handleDrag.id) return;
    const dx = event.clientX - handleDrag.sx;
    const dy = event.clientY - handleDrag.sy;
    const inward = stash === 'left' ? dx : -dx;
    if (inward > 26) {
      handleDrag = null;
      unstash();
      return;
    }
    if (Math.abs(dy) < 4 && !handleDrag.moved) return;
    handleDrag.moved = true;
    const b = bounds();
    pos.to({ y: clamp(handleDrag.y + dy, b.top, b.bottom - size) }, { response: 0.1, damping: 1 });
  });
  const endHandle = (event) => {
    if (!handleDrag || event.pointerId !== handleDrag.id) return;
    const moved = handleDrag.moved;
    handleDrag = null;
    if (!moved) unstash();
    else if (mode === 'stash') persist({ x: stashX(stash), y: pos.get('y') });
  };
  handle.addEventListener('pointerup', endHandle);
  handle.addEventListener('pointercancel', endHandle);

  function pickAnEgg() {
    const egg = pickEgg(Math.random(), lastEgg);
    lastEgg = egg.file;
    return egg;
  }

  function detectPat(event) {
    const r = el.getBoundingClientRect();
    if (event.clientY > r.top + r.height * 0.85 || (mode !== 'free' && mode !== 'perch')) return;
    const now = performance.now();
    if (pat.lastX === undefined || now - pat.lastT > 400) {
      pat = { ...pat, lastX: event.clientX, lastT: now };
      return;
    }
    const delta = event.clientX - pat.lastX;
    if (Math.abs(delta) < 3) return;
    const dir = Math.sign(delta);
    pat.lastX = event.clientX;
    pat.lastT = now;
    if (now - pat.since > 1600) pat = { ...pat, flips: 0, since: now, dir };
    if (dir === pat.dir) return;
    pat.flips += 1;
    pat.dir = dir;
    if (now <= pat.cool) return;
    if (!MotionSettings.reduced) {
      fx.set({ tilt: fx.get('tilt') + dir * 3 });
      fx.to({ tilt: 0 }, { response: 0.36, damping: 0.4 });
    }
    if (pat.flips >= 3) {
      pat = { ...pat, flips: 0, since: 0, cool: now + 4000 };
      hint.hide();
      react(REACTIONS.pat);
      changeLife(nudgeMood(countLife(life, today(), 'pats'), 4));
      if (prefs.chatty !== 'off') say(['嘿嘿', '再摸一下', '好舒服'][Math.floor(Math.random() * 3)]);
    }
  }

  let pointerRaf = 0;
  let pointer = null;
  document.addEventListener('pointermove', (event) => {
    pointer = { x: event.clientX, y: event.clientY };
    lastInput = Date.now();
    if (pointerRaf) return;
    pointerRaf = requestAnimationFrame(() => {
      pointerRaf = 0;
      if (!prefs.enabled || mode === 'rest' || drag) return;
      if (hidden()) {
        const edge = stash === 'left' ? bounds().left : bounds().right;
        const reach = fx.get('peek') > 0.5 ? size * 0.75 : 46;
        const near = Math.abs(pointer.x - edge) < reach && pointer.y > pos.get('y') - 24 && pointer.y < pos.get('y') + size + 24;
        fx.to({ peek: near ? 1 : 0 }, near ? soft({ response: 0.42, damping: 0.62 }) : { response: 0.3, damping: 0.9 });
        return;
      }
      if (MotionSettings.reduced) return;
      const dx = pointer.x - (pos.get('x') + size / 2);
      const dy = pointer.y - (pos.get('y') + size / 2);
      const near = Math.hypot(dx, dy) < 380;
      fx.to({ tilt: near ? clamp(dx / 380, -1, 1) * 7 : 0 }, { response: 0.6, damping: 0.6 });
    });
  }, { passive: true });
  document.addEventListener('keydown', () => { lastInput = Date.now(); });

  function anchor() {
    const x = shownX();
    const y = pos.get('y');
    return { headX: x + size / 2, headY: y + size * 0.28, x, y };
  }

  function placeAt(node, sideKey, { offset = 0.8 } = {}) {
    const w = node.offsetWidth;
    const h = node.offsetHeight;
    const a = anchor();
    const b = bounds();
    const right = a.x + size * offset + w < window.innerWidth - 8;
    const left = right ? a.x + size * offset : a.x + size * (1 - offset) - w;
    const dock = document.getElementById('dock');
    const dockRect = dock ? dock.getBoundingClientRect() : null;
    const overDock = dockRect && dockRect.height > 0 && dockRect.top < window.innerHeight - 4 && left < dockRect.right && left + w > dockRect.left;
    const floor = overDock ? Math.max(b.top + h, dockRect.top - 8) : b.bottom;
    const top = clamp(a.headY - 26, b.top, floor - h);
    const tail = clamp(a.headY - top, 16, h - 16);
    node.style.left = `${clamp(left, 8, window.innerWidth - w - 8).toFixed(2)}px`;
    node.style.top = `${top.toFixed(2)}px`;
    node.style.setProperty('--tail-y', `${tail.toFixed(1)}px`);
    node.style.transformOrigin = `${right ? 0 : w}px ${tail.toFixed(1)}px`;
    node.classList.toggle(sideKey, !right);
  }

  function placeCard() {
    if (card.hidden) return;
    placeAt(card, 'is-left', { offset: 0.82 });
  }

  function placeBubble() {
    if (bubble.hidden) return;
    placeAt(bubble, 'is-left', { offset: 0.74 });
  }

  cardMotion.onUpdate(({ s }) => {
    card.style.opacity = String(clamp(s * 1.8, 0, 1));
    card.style.transform = `scale(${clamp(s, 0, 1.2).toFixed(4)})`;
  });

  bubbleMotion.onUpdate(({ s }) => {
    bubble.style.opacity = String(clamp(s * 1.8, 0, 1));
    bubble.style.transform = `scale(${clamp(s, 0, 1.3).toFixed(4)})`;
  });

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
      const upcoming = tasks.filter((t) => {
        if (i > 0 || !t.time) return true;
        const [hh, mm] = t.time.split(':').map(Number);
        return hh * 60 + mm >= now.getHours() * 60 + now.getMinutes();
      }).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
      if (upcoming.length) {
        const t = upcoming[0];
        const day = i === 0 ? '今天' : i === 1 ? '明天' : '後天';
        return { text: `${day}${t.time ? ` ${t.time}` : ''} · ${t.text}` };
      }
    }
    return null;
  }

  function weatherLine() {
    if (!weather || !weather.current) return null;
    return `${weather.location ? weather.location.name : ''} ${weather.current.text} ${Math.round(weather.temperature)}°`.trim();
  }

  const RING = '<svg viewBox="0 0 36 36" aria-hidden="true"><circle class="pet-ring__track" cx="18" cy="18" r="15"/><circle class="pet-ring__fill" cx="18" cy="18" r="15" pathLength="1" transform="rotate(-90 18 18)"/></svg>';
  let statEls = null;

  function stat(label, key) {
    const wrap = document.createElement('div');
    wrap.className = `pet-stat pet-stat--${key}`;
    wrap.innerHTML = `<span class="pet-ring">${RING}<b class="mono"></b></span><span class="pet-stat__label"></span>`;
    wrap.querySelector('.pet-stat__label').textContent = label;
    return wrap;
  }

  function updateStats() {
    if (!statEls) return;
    const lv = levelOf(life.bond);
    const values = { full: life.fullness / 100, mood: life.mood / 100, bond: lv.progress };
    const labels = { full: `${Math.round(life.fullness)}`, mood: `${Math.round(life.mood)}`, bond: `${lv.level}` };
    Object.entries(statEls.rings).forEach(([key, node]) => {
      node.querySelector('.pet-ring__fill').style.strokeDashoffset = String(1 - clamp(values[key], 0, 1));
      node.querySelector('b').textContent = labels[key];
    });
    statEls.title.textContent = `Lv${lv.level} · ${lv.title}`;
    statEls.streak.textContent = life.streak.count ? `連續 ${life.streak.count} 天` : '今天還沒打卡';
    statEls.feed.textContent = `餵點心 · ${life.treats}`;
    statEls.feed.disabled = life.treats <= 0;
    const day = dayOf(life, today());
    statEls.goals.forEach(({ id, node }) => {
      const done = !!day.goals[id];
      node.classList.toggle('is-done', done);
      node.setAttribute('aria-checked', String(done));
    });
  }

  function feedTreat() {
    const out = feed(life, today());
    const vars = lifeVars();
    if (!out.ok) {
      say(eventLine(out.reason === 'empty' ? 'noTreat' : 'tooFull', voice(), vars));
      return;
    }
    life = out.life;
    saveLife();
    react(REACTIONS.eat);
    if (out.levelUp) handleLifeEvent({ type: 'level', ...out.levelUp });
    updateStats();
    refreshIdle();
  }

  function buildCard() {
    card.textContent = '';
    syncLife();
    const head = document.createElement('div');
    head.className = 'pet-card__head';
    head.innerHTML = '<p class="pet-card__name"></p><p class="pet-card__meta"><span></span><span class="mono"></span></p>';
    head.querySelector('.pet-card__name').textContent = life.name;
    const stats = document.createElement('div');
    stats.className = 'pet-card__stats';
    const rings = { full: stat('飽足', 'full'), mood: stat('心情', 'mood'), bond: stat('親密', 'bond') };
    Object.values(rings).forEach((node) => stats.append(node));
    const speech = line(stateLine(stateOf(life), voice(), lifeVars(), Math.floor(Date.now() / 60000)), 'pet-card__lead');
    const goalsBox = document.createElement('div');
    goalsBox.className = 'pet-card__goals';
    goalsBox.setAttribute('role', 'list');
    goalsBox.setAttribute('aria-label', '今日小目標');
    const goals = goalsFor(today(), lifeCtx()).map((id) => {
      const teach = id === 'pat';
      const node = document.createElement(teach ? 'button' : 'div');
      node.className = `pet-goal${teach ? ' is-teach' : ''}`;
      if (teach) {
        node.type = 'button';
        node.addEventListener('click', teachPat);
      } else {
        node.setAttribute('role', 'listitem');
      }
      node.innerHTML = teach ? '<i aria-hidden="true"></i><span></span><em>怎麼摸？</em>' : '<i aria-hidden="true"></i><span></span>';
      node.querySelector('span').textContent = GOALS[id].label;
      goalsBox.append(node);
      return { id, node };
    });
    const actions = document.createElement('div');
    actions.className = 'pet-card__actions';
    const log = document.createElement('button');
    log.type = 'button';
    log.className = 'pet-card__btn is-main';
    log.textContent = '記一筆';
    log.addEventListener('click', () => { closeCard(); island.open(); });
    const feedButton = document.createElement('button');
    feedButton.type = 'button';
    feedButton.className = 'pet-card__btn';
    feedButton.addEventListener('click', feedTreat);
    const tease = document.createElement('button');
    tease.type = 'button';
    tease.className = 'pet-card__btn';
    tease.textContent = '逗她';
    tease.addEventListener('click', () => react(pickAnEgg()));
    actions.append(log, feedButton, tease);
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
    statEls = { rings, goals, feed: feedButton, title: head.querySelector('.pet-card__meta span'), streak: head.querySelector('.pet-card__meta .mono') };
    const pieces = [head, stats, speech, goalsBox, actions, restRow];
    pieces.forEach((piece) => card.append(piece));
    updateStats();
    return pieces;
  }

  function openCard() {
    if (cardOpen || mode === 'rest' || hidden()) return;
    cardOpen = true;
    const fromBubble = !bubble.hidden;
    hideBubble(true);
    const pieces = buildCard();
    card.hidden = false;
    placeCard();
    if (MotionSettings.reduced) {
      cardMotion.set({ s: 1 });
    } else {
      cardMotion.set({ s: fromBubble ? 0.7 : 0.2 });
      cardMotion.to({ s: 1 }, { response: 0.44, damping: 0.58 });
      pieces.forEach((node, i) => {
        const motion = createMotion({ e: 0, y: 10 + i * 5 }, { response: 0.4, damping: 0.66, restDelta: { e: 0.002, y: 0.05 } });
        motion.onUpdate(({ e, y }) => {
          const t = clamp(e, 0, 1);
          node.style.opacity = t > 0.999 ? '' : String(t);
          node.style.transform = Math.abs(y) < 0.05 && t > 0.999 ? '' : `translate3d(0, ${y.toFixed(2)}px, 0)`;
          node.style.filter = t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * 3).toFixed(2)}px)` : '';
        });
        motion.set({ e: 0, y: 10 + i * 5 });
        motion.to({ e: 1 }, { response: 0.28 + i * 0.03, damping: 1 });
        motion.to({ y: 0 }, { response: 0.42 + i * 0.05, damping: 0.6 });
      });
    }
    window.setTimeout(() => card.focus({ preventScroll: true }), 60);
  }

  function closeCard(instant) {
    if (!cardOpen) return;
    cardOpen = false;
    if (instant || MotionSettings.reduced) {
      cardMotion.set({ s: 0 });
      card.hidden = true;
      return;
    }
    cardMotion.to({ s: 0 }, { response: 0.26, damping: 0.9 }).then((done) => {
      if (done && !cardOpen) card.hidden = true;
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

  let bubbleTimer = 0;
  let typeTimer = 0;

  function say(textValue) {
    if (!textValue || cardOpen || mode === 'rest' || hidden() || !prefs.enabled) return;
    if (notifier && notifier.quiet) return;
    speaking = true;
    lastSpoke = Date.now();
    window.clearTimeout(bubbleTimer);
    window.clearInterval(typeTimer);
    bubble.hidden = false;
    const chars = Array.from(textValue);
    bubbleText.textContent = '';
    bubbleText.setAttribute('aria-label', textValue);
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
    speaking = false;
    if (bubble.hidden) return;
    if (instant || MotionSettings.reduced) {
      bubble.hidden = true;
      bubbleMotion.set({ s: 0 });
      return;
    }
    bubbleMotion.to({ s: 0 }, { response: 0.26, damping: 1 }).then((done) => {
      if (done) bubble.hidden = true;
    });
  }

  bubble.addEventListener('click', () => openCard());

  function nextLine() {
    lineIndex += 1;
    const own = stateLine(stateOf(life), voice(), lifeVars(), lineIndex);
    if (lineIndex % 3 !== 0) return own;
    const task = nextTask();
    if (task && lineIndex % 2 === 0) return `別忘了：${task.text}`;
    const wx = weatherLine();
    return wx || own;
  }

  window.setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    syncLife();
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
  window.addEventListener('yoworingo:goal-deposit', () => {
    react(REACTIONS.deposit);
    changeLife(nudgeMood(countLife(life, today(), 'deposits'), 8));
  });
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
    if (next > doneCount) {
      react(REACTIONS.taskDone);
      life = nudgeMood(countLife(life, today(), 'tasksDone', next - doneCount), 6);
    }
    doneCount = next;
    syncLife();
    refreshIdle();
  });

  if (notifier) {
    notifier.subscribe(({ type }) => {
      if (type !== 'add') return;
      const item = notifier.history[0];
      if (item && item.key && (item.key.startsWith('budget-100') || item.key.startsWith('budget-cat'))) changeLife(nudgeMood(life, -10));
      if (!notifier.quiet) react(reactionForNotice(item));
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
    setSize(prefs.size);
    if (mode === 'free') pos.set(clampInto({ x: pos.get('x'), y: pos.get('y') }, box(), bounds()));
    if (hidden()) pos.set({ x: stashX(stash) });
    paint();
  });

  function boot() {
    setSize(prefs.size);
    const b = bounds();
    const start = Number.isFinite(saved.x) && Number.isFinite(saved.y) ? clampInto({ x: saved.x, y: saved.y }, box(), b) : { x: b.right - size - 40, y: b.bottom - size - 110 };
    pos.set(start);
    saved = { ...start };
    if (restAt && restAt > Date.now()) {
      mode = 'rest';
    } else {
      restAt = 0;
      if (stash) {
        mode = 'stash';
        pos.set({ x: stashX(stash) });
        fx.set({ grip: 1 });
      } else if (perch) {
        mode = 'perch';
        lifted(true);
        followPerch();
      }
    }
    syncLife();
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
        if (hidden()) pos.set({ x: stashX(stash) });
        if (!MotionSettings.reduced) {
          fx.set({ press: 0.9 });
          fx.to({ press: 1 }, { response: 0.42, damping: 0.42 });
        }
      }
      if (patch.enabled !== undefined) {
        if (prefs.enabled && !MotionSettings.reduced) {
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
    get name() { return life.name; },
    setName(next) {
      const name = String(next || '').trim().slice(0, 12);
      if (!name || name === life.name) return;
      life = { ...life, name };
      saveLife();
      if (cardOpen) closeCard(true);
      say(`我是 ${name}，請多指教。`);
    },
    get life() { return JSON.parse(JSON.stringify(life)); },
    wake,
    say,
    get mode() { return mode; },
    get position() { return { x: pos.get('x'), y: pos.get('y') }; },
  };
}
