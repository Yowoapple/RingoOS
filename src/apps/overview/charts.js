import { createMotion } from '../../motion/animator.js';
import { MotionSettings } from '../../motion/presets.js';
import { createOdometer, formatAmount } from '../../ui/odometer.js';
import { monotonePath } from '../../ui/curve.js';
import { Fx } from '../../ui/fx-tier.js';

const NS = 'http://www.w3.org/2000/svg';
const SAMPLES = 40;
const SHADES = [1, 0.7, 0.5, 0.36, 0.25, 0.17];

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function svg(tag, cls) {
  const el = document.createElementNS(NS, tag);
  if (cls) el.setAttribute('class', cls);
  return el;
}

function rem() {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

function soft(config) {
  return MotionSettings.reduced ? MotionSettings.spring('focus') : config;
}

function resample(values, reach) {
  const n = values.length;
  const out = [];
  for (let k = 0; k < SAMPLES; k += 1) {
    if (n === 0) {
      out.push(0);
      continue;
    }
    const pos = (k / (SAMPLES - 1)) * reach * (n - 1);
    const i = Math.floor(pos);
    const f = pos - i;
    const a = values[Math.min(i, n - 1)] || 0;
    const b = values[Math.min(i + 1, n - 1)] || 0;
    out.push(a + (b - a) * f);
  }
  return out;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function createPaceChart(root, { labelFor }) {
  root.classList.add('pace');
  const plot = svg('svg', 'pace__svg');
  plot.setAttribute('aria-hidden', 'true');
  const budgetLine = svg('line', 'pace__budget');
  const prevPath = svg('path', 'pace__prev');
  const area = svg('path', 'pace__area');
  const line = svg('path', 'pace__line');
  const proj = svg('path', 'pace__proj');
  const dot = svg('circle', 'pace__dot');
  const cursor = svg('line', 'pace__cursor');
  const hit = svg('circle', 'pace__hit');
  [line, prevPath].forEach((p) => p.setAttribute('pathLength', '1'));
  plot.append(budgetLine, prevPath, area, line, proj, dot, cursor, hit);
  const budgetTag = document.createElement('span');
  budgetTag.className = 'pace__tag mono';
  const tip = document.createElement('div');
  tip.className = 'pace__tip';
  tip.innerHTML = '<span class="pace__tip-date mono"></span><span class="pace__tip-amt mono"><span class="odo-host"></span></span><span class="pace__tip-prev mono"></span>';
  const tipDate = tip.querySelector('.pace__tip-date');
  const tipPrev = tip.querySelector('.pace__tip-prev');
  const tipOdo = createOdometer(tip.querySelector('.odo-host'), { value: 0, format: (v) => `NT$ ${formatAmount(v)}` });
  root.append(plot, budgetTag, tip);

  let data = null;
  let shown = null;
  let from = null;
  let to = null;
  const morph = createMotion({ p: 1, draw: 1 }, { response: 0.6, damping: 0.74, restDelta: { p: 0.001, draw: 0.001 } });
  const scrub = createMotion({ o: 0, x: 0, y: 0 }, { response: 0.22, damping: 0.86, restDelta: { o: 0.002, x: 0.2, y: 0.2 } });

  function geometry() {
    const unit = rem();
    const width = Math.max(120, root.clientWidth || 320);
    const height = 8.6 * unit;
    return { width, height, top: 1.1 * unit, bottom: height - 0.35 * unit, unit };
  }

  function snapshot(d) {
    const n = d.values.length;
    const reach = d.todayIndex >= 0 && n > 1 ? d.todayIndex / (n - 1) : 1;
    const solid = d.values.map((v) => (v === null ? 0 : v));
    const end = d.todayIndex >= 0 ? solid[d.todayIndex] : solid[n - 1] || 0;
    return {
      cur: resample(solid, reach),
      reach,
      prev: resample(d.prev.length ? d.prev.concat(Array(Math.max(0, n - d.prev.length)).fill(d.prev[d.prev.length - 1] || 0)) : Array(n).fill(0), 1),
      prevOn: d.prev.some((v) => v > 0) ? 1 : 0,
      budget: d.budget,
      max: d.max,
      projection: d.projection === null ? end : d.projection,
      projOn: d.projection === null ? 0 : 1,
      end,
    };
  }

  function blend(a, b, t) {
    return {
      cur: a.cur.map((v, i) => lerp(v, b.cur[i], t)),
      reach: lerp(a.reach, b.reach, t),
      prev: a.prev.map((v, i) => lerp(v, b.prev[i], t)),
      prevOn: lerp(a.prevOn, b.prevOn, t),
      budget: lerp(a.budget, b.budget, t),
      max: lerp(a.max, b.max, t),
      projection: lerp(a.projection, b.projection, t),
      projOn: lerp(a.projOn, b.projOn, t),
      end: lerp(a.end, b.end, t),
    };
  }

  function paint() {
    if (!shown) return;
    const { width, height, top, bottom } = geometry();
    plot.setAttribute('viewBox', `0 0 ${width.toFixed(1)} ${height.toFixed(1)}`);
    plot.setAttribute('width', width.toFixed(1));
    plot.setAttribute('height', height.toFixed(1));
    const max = Math.max(1, shown.max * 1.08);
    const y = (v) => top + (1 - clamp(v / max, 0, 1.2)) * (bottom - top);
    const draw = clamp(morph.get('draw'), 0, 1);
    const curPts = shown.cur.map((v, k) => [(k / (SAMPLES - 1)) * shown.reach * width, y(v)]);
    const prevPts = shown.prev.map((v, k) => [(k / (SAMPLES - 1)) * width, y(v)]);
    line.setAttribute('d', monotonePath(curPts));
    prevPath.setAttribute('d', monotonePath(prevPts));
    line.style.strokeDasharray = `${draw} 1`;
    prevPath.style.strokeDasharray = `${draw} 1`;
    prevPath.style.opacity = String(clamp(shown.prevOn, 0, 1));
    const last = curPts[curPts.length - 1];
    area.setAttribute('d', `${monotonePath(curPts)} L${last[0].toFixed(1)} ${bottom.toFixed(1)} L0 ${bottom.toFixed(1)} Z`);
    area.style.opacity = String(draw * 0.9);
    const budgetOn = shown.budget > 0.5;
    const by = y(shown.budget);
    budgetLine.setAttribute('x1', '0');
    budgetLine.setAttribute('x2', width.toFixed(1));
    budgetLine.setAttribute('y1', by.toFixed(1));
    budgetLine.setAttribute('y2', by.toFixed(1));
    budgetLine.style.opacity = budgetOn ? '1' : '0';
    budgetTag.style.opacity = budgetOn ? '1' : '0';
    budgetTag.style.transform = `translate3d(0, ${(by - 0.95 * rem()).toFixed(1)}px, 0)`;
    const projOn = clamp(shown.projOn, 0, 1) * draw;
    proj.setAttribute('d', `M${last[0].toFixed(1)} ${last[1].toFixed(1)} L${width.toFixed(1)} ${y(shown.projection).toFixed(1)}`);
    proj.style.opacity = String(projOn);
    const over = budgetOn && (shown.projection > shown.budget * 1.0001 || shown.end > shown.budget);
    root.classList.toggle('is-over', !!over && projOn > 0.5);
    dot.setAttribute('cx', last[0].toFixed(1));
    dot.setAttribute('cy', last[1].toFixed(1));
    dot.setAttribute('r', (3.4 * clamp(draw * 1.4 - 0.4, 0, 1)).toFixed(2));
    dot.style.opacity = shown.reach < 0.999 || projOn > 0 ? '1' : '0';
  }

  morph.onUpdate(({ p }) => {
    if (from && to) shown = blend(from, to, clamp(p, 0, 1.06));
    paint();
  });

  scrub.onUpdate(({ o, x, y }) => {
    const t = clamp(o, 0, 1);
    cursor.setAttribute('x1', x.toFixed(1));
    cursor.setAttribute('x2', x.toFixed(1));
    cursor.setAttribute('y1', '0');
    cursor.setAttribute('y2', String(geometry().height));
    cursor.style.opacity = String(t);
    hit.setAttribute('cx', x.toFixed(1));
    hit.setAttribute('cy', y.toFixed(1));
    hit.setAttribute('r', (4 * t).toFixed(2));
    tip.style.opacity = String(t);
    const tipW = tip.offsetWidth || 120;
    const left = clamp(x - tipW / 2, 0, (root.clientWidth || 300) - tipW);
    tip.style.transform = `translate3d(${left.toFixed(1)}px, ${(-0.4 * rem()).toFixed(1)}px, 0) scale(${(0.9 + 0.1 * t).toFixed(3)})`;
    tip.style.filter = t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * 3).toFixed(2)}px)` : '';
  });

  function scrubAt(clientX) {
    if (!data || !data.values.length) return;
    const rect = plot.getBoundingClientRect();
    const n = data.values.length;
    const limit = data.todayIndex >= 0 ? data.todayIndex : n - 1;
    const i = clamp(Math.round(((clientX - rect.left) / rect.width) * (n - 1)), 0, limit);
    const { width, top, bottom } = geometry();
    const max = Math.max(1, data.max * 1.08);
    const value = data.values[i] || 0;
    const x = n > 1 ? (i / (n - 1)) * width : 0;
    const y = top + (1 - clamp(value / max, 0, 1.2)) * (bottom - top);
    tipDate.textContent = labelFor(i);
    tipOdo.set(value);
    const prev = data.prev[i];
    tipPrev.textContent = prev > 0 ? `前期 ${formatAmount(prev)}` : '';
    tipPrev.hidden = !(prev > 0);
    if (scrub.get('o') < 0.05) scrub.set({ x, y, o: scrub.get('o') });
    scrub.to({ o: 1, x, y }, soft({ response: 0.22, damping: 0.86 }));
  }

  plot.addEventListener('pointermove', (event) => scrubAt(event.clientX));
  plot.addEventListener('pointerdown', (event) => {
    scrubAt(event.clientX);
    try { plot.setPointerCapture(event.pointerId); } catch (err) {}
  });
  const hide = () => scrub.to({ o: 0 }, { response: 0.24, damping: 1 });
  plot.addEventListener('pointerleave', hide);
  plot.addEventListener('pointerup', (event) => { if (event.pointerType !== 'mouse') hide(); });

  return {
    update(next, { intro = false } = {}) {
      data = next;
      const target = snapshot(next);
      budgetTag.textContent = next.budget > 0 ? `預算 ${formatAmount(next.budget)}` : '';
      if (!shown || MotionSettings.reduced) {
        shown = target;
        from = target;
        to = target;
        morph.set({ p: 1, draw: intro && !MotionSettings.reduced ? 0 : 1 });
        if (intro && !MotionSettings.reduced) morph.to({ draw: 1 }, { response: 0.9, damping: 0.9 });
        paint();
        return;
      }
      from = shown;
      to = target;
      if (intro) {
        from = { ...target, cur: target.cur.map(() => 0), end: 0, projection: 0 };
        morph.set({ p: 0, draw: 0 });
        morph.to({ p: 1, draw: 1 }, { response: 0.9, damping: 0.86 });
        return;
      }
      morph.set({ p: 0, draw: morph.get('draw') });
      morph.to({ p: 1, draw: 1 }, soft({ response: 0.6, damping: 0.74 }));
    },
    resize: paint,
  };
}

export function createDonut(root, { onSelect, onFind }) {
  root.classList.add('donut');
  root.innerHTML = '<div class="donut__ring"><svg class="donut__svg" viewBox="0 0 120 120" aria-hidden="true"><circle class="donut__track" cx="60" cy="60" r="46"/><g class="donut__segs" transform="rotate(-90 60 60)"></g></svg><div class="donut__center"><span class="donut__label"></span><span class="donut__total mono"><span class="odo-host"></span></span><span class="donut__sub mono"></span><button type="button" class="donut__find" hidden>看紀錄</button></div></div><div class="donut__legend" role="list"></div>';
  const segsEl = root.querySelector('.donut__segs');
  const label = root.querySelector('.donut__label');
  const sub = root.querySelector('.donut__sub');
  const findBtn = root.querySelector('.donut__find');
  const legend = root.querySelector('.donut__legend');
  const totalOdo = createOdometer(root.querySelector('.odo-host'), { value: 0, format: (v) => formatAmount(v) });
  const segs = new Map();
  let items = [];
  let total = 0;
  let baseLabel = '';
  let selected = null;
  const sweep = createMotion({ s: 1 }, { response: 0.8, damping: 0.86, restDelta: 0.001 });

  function segment(id) {
    const el = svg('circle', 'donut__seg');
    el.setAttribute('cx', '60');
    el.setAttribute('cy', '60');
    el.setAttribute('r', '46');
    el.setAttribute('pathLength', '100');
    segsEl.append(el);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'donut__row';
    row.setAttribute('role', 'listitem');
    row.innerHTML = '<i class="donut__dot"></i><span class="donut__name"></span><span class="donut__pct mono"></span><span class="donut__amt mono"></span>';
    row.addEventListener('click', () => select(selected === id ? null : id));
    el.addEventListener('click', () => select(selected === id ? null : id));
    const motion = createMotion({ start: 0, len: 0, out: 0, dim: 0 }, { response: 0.55, damping: 0.7, restDelta: { start: 0.02, len: 0.02, out: 0.005, dim: 0.005 } });
    const entry = { id, el, row, motion, shade: 1, leaving: false };
    motion.onUpdate(() => paintSeg(entry));
    segs.set(id, entry);
    return entry;
  }

  function paintSeg(entry) {
    const { start, len, out, dim } = entry.motion.values;
    const s = clamp(sweep.get('s'), 0, 1);
    const gap = len > 1.6 ? 0.9 : 0;
    const visible = Math.max(0, len * s - gap);
    entry.el.style.strokeDasharray = `${visible.toFixed(3)} ${(100 - visible).toFixed(3)}`;
    entry.el.style.strokeDashoffset = (-(start * s + gap / 2)).toFixed(3);
    const mid = ((start + len / 2) * s / 100) * Math.PI * 2;
    const push = 4.5 * clamp(out, 0, 1.2);
    entry.el.style.transform = push > 0.01 ? `translate(${(Math.cos(mid) * push).toFixed(2)}px, ${(Math.sin(mid) * push).toFixed(2)}px)` : '';
    entry.el.style.strokeWidth = (13 + 3 * clamp(out, 0, 1.2)).toFixed(2);
    entry.el.style.opacity = String(1 - 0.62 * clamp(dim, 0, 1));
    entry.row.style.opacity = String(1 - 0.45 * clamp(dim, 0, 1));
  }

  sweep.onUpdate(() => segs.forEach(paintSeg));

  function paintCenter() {
    const item = items.find((i) => i.id === selected);
    if (item) {
      label.textContent = item.category;
      totalOdo.set(item.amount);
      sub.textContent = `${Math.round(item.share * 100)}%`;
      findBtn.hidden = false;
    } else {
      label.textContent = baseLabel;
      totalOdo.set(total);
      sub.textContent = '';
      findBtn.hidden = true;
    }
    root.classList.toggle('has-pick', !!item);
  }

  function select(id) {
    selected = id;
    segs.forEach((entry) => {
      const on = entry.id === id;
      entry.el.classList.toggle('is-picked', on);
      entry.row.classList.toggle('is-picked', on);
      entry.row.setAttribute('aria-pressed', String(on));
      entry.motion.to({ out: on ? 1 : 0, dim: id && !on ? 1 : 0 }, soft(on ? { response: 0.42, damping: 0.5 } : { response: 0.4, damping: 0.8 }));
    });
    paintCenter();
    if (onSelect) onSelect(id);
  }

  findBtn.addEventListener('click', () => {
    const item = items.find((i) => i.id === selected);
    if (item && onFind) onFind(item.rest || [item.category]);
  });

  return {
    update(next, { label: nextLabel, intro = false, over = new Set() } = {}) {
      items = next.items;
      total = next.total;
      baseLabel = nextLabel;
      if (selected && !items.some((i) => i.id === selected)) selected = null;
      const wanted = new Set(items.map((i) => i.id));
      segs.forEach((entry, id) => {
        if (wanted.has(id) || entry.leaving) return;
        entry.leaving = true;
        entry.motion.to({ len: 0 }, soft({ response: 0.4, damping: 0.9 })).then((done) => {
          if (!done) return;
          entry.el.remove();
          entry.row.remove();
          segs.delete(id);
        });
      });
      let cursor = 0;
      items.forEach((item, i) => {
        let entry = segs.get(item.id);
        const fresh = !entry || entry.leaving;
        if (!entry) entry = segment(item.id);
        entry.leaving = false;
        const len = item.share * 100;
        if (fresh) entry.motion.set({ start: cursor + len / 2, len: 0, out: 0, dim: 0 });
        entry.motion.to({ start: cursor, len }, soft({ response: 0.55, damping: 0.7 }));
        const shade = SHADES[Math.min(i, SHADES.length - 1)];
        entry.el.style.setProperty('--shade', String(shade));
        entry.row.style.setProperty('--shade', String(shade));
        entry.row.querySelector('.donut__name').textContent = item.category;
        entry.row.querySelector('.donut__pct').textContent = `${Math.round(item.share * 100)}%`;
        entry.row.querySelector('.donut__amt').textContent = formatAmount(item.amount);
        entry.row.classList.toggle('is-over', over.has(item.category));
        legend.append(entry.row);
        cursor += len;
      });
      if (intro && !MotionSettings.reduced) {
        sweep.set({ s: 0 });
        sweep.to({ s: 1 }, { response: 0.8, damping: 0.86 });
      }
      root.classList.toggle('is-empty', !items.length);
      if (selected) select(selected);
      else paintCenter();
    },
    clear: () => select(null),
  };
}

export function createTrend(root, { onPick }) {
  root.classList.add('trend');
  const cols = [];
  let max = 1;

  function column() {
    const col = document.createElement('button');
    col.type = 'button';
    col.className = 'trend__col';
    col.innerHTML = '<span class="trend__bars"><i class="trend__bar trend__bar--out"></i><i class="trend__bar trend__bar--in"></i><i class="trend__bar trend__bar--save"></i></span><span class="trend__month mono"></span>';
    const bars = [...col.querySelectorAll('.trend__bar')];
    const motion = createMotion({ a: 0, b: 0, c: 0 }, { response: 0.6, damping: 0.6, restDelta: 0.002 });
    motion.onUpdate(({ a, b, c }) => {
      [a, b, c].forEach((v, i) => {
        bars[i].style.transform = `scaleY(${Math.max(0, v).toFixed(4)})`;
      });
    });
    const entry = { col, motion, month: col.querySelector('.trend__month'), key: null };
    col.addEventListener('click', () => { if (entry.key) onPick(entry.key); });
    root.append(col);
    cols.push(entry);
    return entry;
  }

  return {
    update(months, activeKey, { intro = false } = {}) {
      while (cols.length < months.length) column();
      max = Math.max(1, ...months.flatMap((m) => [m.expense, m.income, Math.max(0, m.saved)]));
      months.forEach((m, i) => {
        const entry = cols[i];
        const changed = entry.key !== m.key;
        entry.key = m.key;
        entry.month.textContent = `${Number(m.key.slice(5, 7))}月`;
        entry.col.classList.toggle('is-active', m.key === activeKey);
        entry.col.setAttribute('aria-label', `${m.key.replace('-', ' 年 ')} 月：支出 ${formatAmount(m.expense)}，收入 ${formatAmount(m.income)}，存起來 ${formatAmount(Math.max(0, m.saved))}`);
        entry.col.title = `支出 ${formatAmount(m.expense)} · 收入 ${formatAmount(m.income)} · 存起來 ${formatAmount(Math.max(0, m.saved))}`;
        const target = { a: m.expense / max, b: m.income / max, c: Math.max(0, m.saved) / max };
        if ((intro || changed) && !MotionSettings.reduced) {
          entry.motion.set({ a: 0, b: 0, c: 0 });
          window.setTimeout(() => entry.motion.to(target, { response: 0.6, damping: 0.6 }), i * 45);
        } else {
          entry.motion.to(target, soft({ response: 0.6, damping: 0.66 }));
        }
      });
    },
  };
}
