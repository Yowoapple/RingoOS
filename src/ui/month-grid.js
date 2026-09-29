import { createMotion } from '../motion/animator.js';
import { MotionSettings } from '../motion/presets.js';
import { Fx } from './fx-tier.js';

const WEEK = ['一', '二', '三', '四', '五', '六', '日'];

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function pad(n) {
  return String(n).padStart(2, '0');
}

export function createMonthGrid(root, { value, onSelect, marks = () => false }) {
  root.classList.add('mg');
  root.innerHTML = '<div class="dp__head"><button type="button" class="dp__nav" data-step="-1" aria-label="上個月"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M7.4 3L4.4 6l3 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button><span class="dp__month mono" aria-live="polite"></span><button type="button" class="dp__nav" data-step="1" aria-label="下個月"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4.6 3l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>'
    + `<div class="dp__week" aria-hidden="true">${WEEK.map((d) => `<span>${d}</span>`).join('')}</div>`
    + '<div class="dp__grid" role="grid"></div>';
  const monthEl = root.querySelector('.dp__month');
  const grid = root.querySelector('.dp__grid');
  const navs = Array.from(root.querySelectorAll('.dp__nav'));
  const slide = createMotion({ e: 1, dir: 1 }, { response: 0.36, damping: 0.78, restDelta: { e: 0.002, dir: 0.01 } });
  let selected = startOfDay(value);
  let view = new Date(selected.getFullYear(), selected.getMonth(), 1);

  slide.onUpdate(({ e, dir }) => {
    const t = Math.max(0, Math.min(1, e));
    grid.style.opacity = t > 0.999 ? '' : String(t);
    grid.style.transform = t > 0.999 ? '' : `translate3d(${(1 - t) * 14 * dir}px, 0, 0)`;
    grid.style.filter = t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * 3).toFixed(2)}px)` : '';
  });

  function today() {
    return startOfDay(new Date());
  }

  function render() {
    monthEl.textContent = `${view.getFullYear()}.${pad(view.getMonth() + 1)}`;
    const now = today();
    navs[1].disabled = view.getFullYear() > now.getFullYear() || (view.getFullYear() === now.getFullYear() && view.getMonth() >= now.getMonth());
    const focusedDate = document.activeElement && grid.contains(document.activeElement) ? document.activeElement.dataset.date : null;
    grid.textContent = '';
    const offset = (view.getDay() + 6) % 7;
    const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    for (let i = 0; i < offset; i += 1) grid.appendChild(document.createElement('span'));
    for (let d = 1; d <= days; d += 1) {
      const date = new Date(view.getFullYear(), view.getMonth(), d);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'dp__day mono';
      cell.textContent = String(d);
      cell.dataset.date = String(date.getTime());
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', `${date.getMonth() + 1} 月 ${d} 日`);
      cell.tabIndex = sameDay(date, selected) ? 0 : -1;
      if (date > now) cell.disabled = true;
      if (sameDay(date, now)) cell.classList.add('is-today');
      if (sameDay(date, selected)) {
        cell.classList.add('is-selected');
        cell.setAttribute('aria-selected', 'true');
      }
      if (marks(date)) cell.classList.add('is-marked');
      grid.appendChild(cell);
    }
    if (focusedDate) {
      const again = grid.querySelector(`[data-date="${focusedDate}"]`);
      if (again) again.focus({ preventScroll: true });
    }
  }

  function shiftMonth(step, animate = true) {
    const next = new Date(view.getFullYear(), view.getMonth() + step, 1);
    const now = today();
    if (next > new Date(now.getFullYear(), now.getMonth(), 1)) return false;
    view = next;
    render();
    if (animate && !MotionSettings.reduced) {
      slide.set({ e: 0, dir: step });
      slide.to({ e: 1 }, { response: 0.36, damping: 0.78 });
    }
    return true;
  }

  function focusDay(date) {
    const cell = grid.querySelector(`[data-date="${startOfDay(date).getTime()}"]`);
    if (cell && !cell.disabled) cell.focus({ preventScroll: true });
  }

  navs.forEach((nav) => nav.addEventListener('click', () => shiftMonth(Number(nav.dataset.step))));
  grid.addEventListener('click', (event) => {
    const cell = event.target.closest('.dp__day');
    if (!cell || cell.disabled) return;
    const date = new Date(Number(cell.dataset.date));
    if (sameDay(date, selected)) return;
    selected = date;
    render();
    if (onSelect) onSelect(date);
  });
  root.addEventListener('keydown', (event) => {
    const active = document.activeElement;
    if (!active || !active.classList.contains('dp__day')) return;
    const focused = new Date(Number(active.dataset.date));
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (moves[event.key] !== undefined) {
      event.preventDefault();
      const next = new Date(focused.getFullYear(), focused.getMonth(), focused.getDate() + moves[event.key]);
      if (next > today()) return;
      if (next.getMonth() !== view.getMonth()) shiftMonth(next > focused ? 1 : -1);
      focusDay(next);
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      shiftMonth(event.key === 'PageUp' ? -1 : 1);
    }
  });

  render();

  return {
    get value() { return selected; },
    set(date) {
      const next = startOfDay(date);
      const step = next.getFullYear() * 12 + next.getMonth() - (view.getFullYear() * 12 + view.getMonth());
      selected = next;
      if (step !== 0) {
        view = new Date(next.getFullYear(), next.getMonth(), 1);
        render();
        if (!MotionSettings.reduced) {
          slide.set({ e: 0, dir: Math.sign(step) });
          slide.to({ e: 1 }, { response: 0.36, damping: 0.78 });
        }
      } else {
        render();
      }
    },
    refresh: render,
  };
}
