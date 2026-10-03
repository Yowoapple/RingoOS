import { createMotion } from '../../../motion/animator.js';
import { MotionSettings } from '../../../motion/presets.js';
import { Data } from '../../../core/data-model.js';
import { group, h, row, segmented } from '../kit.js';

const TYPES = ['expense', 'income'];
const FALLBACK = { expense: '其他', income: '其他收入' };
const SETTLE = { response: 0.42, damping: 0.6 };

export function categoriesPage(ctx) {
  const { island, dialogs, frame } = ctx;
  const el = h('div', 'st-page__body');
  let type = 'expense';
  let dragging = null;
  let editing = null;
  const motions = new WeakMap();

  const tabs = segmented(['支出', '收入'], 0, (i) => {
    type = TYPES[i];
    render({ swap: true });
  }, { label: '分類類型' });
  const grid = h('div', 'st-chips');
  grid.setAttribute('role', 'list');
  const note = h('p', 'st-note', '點名稱可以改名，拖曳可以排序。改名會連同舊紀錄和預算一起改；刪除後那些紀錄會歸到「其他」。');

  function motionOf(chip) {
    let m = motions.get(chip);
    if (m) return m;
    m = createMotion({ x: 0, y: 0, s: 1 }, { response: 0.42, damping: 0.6, restDelta: { x: 0.05, y: 0.05, s: 0.0005 } });
    m.onUpdate(({ x, y, s }) => {
      const still = Math.abs(x) < 0.05 && Math.abs(y) < 0.05 && Math.abs(s - 1) < 0.0005;
      chip.style.transform = still ? '' : `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${s.toFixed(4)})`;
    });
    motions.set(chip, m);
    return m;
  }

  function chips() {
    return Array.from(grid.querySelectorAll('.st-chip[data-name]'));
  }

  function flip(mutate) {
    const before = new Map(chips().map((chip) => [chip, chip.getBoundingClientRect()]));
    mutate();
    if (MotionSettings.reduced) return;
    chips().forEach((chip) => {
      const old = before.get(chip);
      if (!old || chip === (dragging && dragging.chip)) return;
      const now = chip.getBoundingClientRect();
      const dx = old.left - now.left;
      const dy = old.top - now.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      const m = motionOf(chip);
      m.set({ x: m.get('x') + dx, y: m.get('y') + dy });
      m.to({ x: 0, y: 0 }, SETTLE);
    });
  }

  function chipFor(name) {
    const chip = h('div', 'st-chip');
    chip.setAttribute('role', 'listitem');
    chip.dataset.name = name;
    const locked = name === FALLBACK[type];
    chip.classList.toggle('is-locked', locked);
    chip.innerHTML = '<button type="button" class="st-chip__name"></button><span class="st-chip__count mono"></span><button type="button" class="st-chip__x" aria-label="刪除分類"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>';
    const nameButton = chip.querySelector('.st-chip__name');
    nameButton.textContent = name;
    nameButton.setAttribute('aria-label', locked ? `${name}（備援分類，不能改名或刪除）` : `${name}，點一下改名`);
    chip.querySelector('.st-chip__x').hidden = locked;
    nameButton.addEventListener('click', () => {
      if (chip.dataset.dragged) {
        delete chip.dataset.dragged;
        return;
      }
      if (!locked) startRename(chip);
    });
    chip.querySelector('.st-chip__x').addEventListener('click', () => confirmRemove(chip));
    chip.addEventListener('pointerdown', (event) => beginDrag(event, chip));
    return chip;
  }

  function updateCounts() {
    chips().forEach((chip) => {
      const count = Data.countEntriesUsingCategory(type, chip.dataset.name);
      chip.querySelector('.st-chip__count').textContent = count ? String(count) : '';
    });
  }

  function addChip() {
    const chip = h('div', 'st-chip st-chip--add');
    chip.innerHTML = '<button type="button" class="st-chip__name">＋ 新增分類</button>';
    chip.querySelector('button').addEventListener('click', () => startAdd(chip));
    return chip;
  }

  function render({ swap = false } = {}) {
    if (dragging || editing) return;
    const names = type === 'income' ? Data.getState().settings.incomeCategories : Data.getState().settings.expenseCategories;
    const existing = new Map(chips().map((chip) => [chip.dataset.name, chip]));
    if (swap) {
      grid.textContent = '';
      existing.clear();
    }
    const fresh = [];
    flip(() => {
      existing.forEach((chip, name) => {
        if (!names.includes(name)) chip.remove();
      });
      names.forEach((name, i) => {
        let chip = existing.get(name);
        if (!chip) {
          chip = chipFor(name);
          fresh.push(chip);
        }
        if (grid.children[i] !== chip) grid.insertBefore(chip, grid.children[i] || null);
      });
      let add = grid.querySelector('.st-chip--add');
      if (!add) add = addChip();
      grid.append(add);
    });
    updateCounts();
    if (MotionSettings.reduced) return;
    fresh.forEach((chip, i) => {
      const m = motionOf(chip);
      m.set({ s: 0.6 });
      window.setTimeout(() => m.to({ s: 1 }, { response: 0.42, damping: 0.5 }), swap ? i * 22 : 0);
    });
  }

  function shake(chip) {
    if (MotionSettings.reduced) return;
    const m = motionOf(chip);
    m.to({ x: 0 }, { response: 0.3, damping: 0.3, velocity: { x: 420 } });
  }

  function inlineInput(chip, value, onDone) {
    const nameButton = chip.querySelector('.st-chip__name');
    const input = h('input', 'st-chip__input');
    input.value = value;
    input.maxLength = 12;
    input.setAttribute('aria-label', '分類名稱');
    nameButton.hidden = true;
    chip.classList.add('is-editing');
    nameButton.after(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (commit) => {
      if (done) return;
      done = true;
      const next = input.value.trim();
      input.remove();
      nameButton.hidden = false;
      chip.classList.remove('is-editing');
      editing = null;
      onDone(commit ? next : null);
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
    editing = chip;
  }

  function startRename(chip) {
    const from = chip.dataset.name;
    inlineInput(chip, from, (next) => {
      if (!next || next === from) return;
      const result = Data.renameCategory(type, from, next);
      if (!result.ok) {
        shake(chip);
        island.toast({ text: result.reason === 'exists' ? `已經有「${next}」了` : '這個名稱不能用', duration: 2600 });
        return;
      }
      chip.dataset.name = next;
      chip.querySelector('.st-chip__name').textContent = next;
      island.toast({ text: `已改名為「${next}」`, duration: 2400 });
      render();
    });
  }

  function startAdd(chip) {
    const button = chip.querySelector('.st-chip__name');
    inlineInput(chip, '', (next) => {
      button.textContent = '＋ 新增分類';
      if (!next) return;
      const list = type === 'income' ? Data.getState().settings.incomeCategories : Data.getState().settings.expenseCategories;
      if (list.includes(next)) {
        shake(chip);
        island.toast({ text: `已經有「${next}」了`, duration: 2400 });
        return;
      }
      Data.addCategory(type, next);
      render();
    });
  }

  async function confirmRemove(chip) {
    const name = chip.dataset.name;
    const count = Data.countEntriesUsingCategory(type, name);
    const ok = await dialogs.confirm({
      source: chip.querySelector('.st-chip__x'),
      frame: frame(),
      title: `刪除「${name}」？`,
      text: count ? `有 ${count} 筆紀錄會改歸到「${FALLBACK[type]}」，這個分類的預算也會一起移除。` : '這個分類目前沒有紀錄。',
      confirmLabel: '刪除',
    });
    if (!ok) return;
    const result = Data.removeCategory(type, name);
    if (!result.ok) return;
    render();
    island.toast({ text: `已刪除「${name}」`, action: '復原', duration: 5000, onAction: () => { Data.restoreCategory(result.snapshot); render(); } });
  }

  function beginDrag(event, chip) {
    if (event.button !== 0 || chip.classList.contains('is-editing') || event.target.closest('.st-chip__x')) return;
    const start = { x: event.clientX, y: event.clientY };
    let active = false;
    const move = (e) => {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!active) {
        if (Math.hypot(dx, dy) < 6) return;
        active = true;
        dragging = { chip, base: { x: start.x, y: start.y } };
        chip.classList.add('is-dragging');
        chip.dataset.dragged = '1';
        try { chip.setPointerCapture(e.pointerId); } catch (err) { active = true; }
        motionOf(chip).to({ s: 1.08 }, { response: 0.3, damping: 0.6 });
      }
      const m = motionOf(chip);
      m.to({ x: e.clientX - dragging.base.x, y: e.clientY - dragging.base.y }, { response: 0.1, damping: 1 });
      const others = chips().filter((other) => other !== chip);
      let target = null;
      others.forEach((other) => {
        const r = other.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) target = other;
      });
      if (!target) return;
      const all = chips();
      const from = all.indexOf(chip);
      const to = all.indexOf(target);
      const before = chip.getBoundingClientRect();
      flip(() => {
        if (to > from) target.after(chip);
        else target.before(chip);
      });
      const after = chip.getBoundingClientRect();
      dragging.base.x += after.left - before.left;
      dragging.base.y += after.top - before.top;
      m.set({ x: e.clientX - dragging.base.x, y: e.clientY - dragging.base.y });
    };
    const up = () => {
      chip.removeEventListener('pointermove', move);
      chip.removeEventListener('pointerup', up);
      chip.removeEventListener('pointercancel', up);
      if (!active) return;
      chip.classList.remove('is-dragging');
      const m = motionOf(chip);
      m.to({ x: 0, y: 0, s: 1 }, { response: 0.42, damping: 0.55 });
      dragging = null;
      Data.setCategoryOrder(type, chips().map((c) => c.dataset.name));
      window.setTimeout(() => delete chip.dataset.dragged, 0);
    };
    chip.addEventListener('pointermove', move);
    chip.addEventListener('pointerup', up);
    chip.addEventListener('pointercancel', up);
  }

  el.append(
    group([row({ label: '類型', control: tabs.el, keywords: '分類 支出 收入 類別' })]),
    group([grid, note], { className: 'st-group--pad' }),
  );

  Data.subscribe(() => {
    if (el.isConnected) render();
  });
  render({ swap: true });

  return {
    id: 'categories',
    title: '分類',
    lede: '記帳用的支出與收入分類',
    icon: 'categories',
    el,
    show() {
      tabs.api.measure();
      render();
    },
    refreshGlass() {
      tabs.api.refreshGlass();
    },
  };
}
