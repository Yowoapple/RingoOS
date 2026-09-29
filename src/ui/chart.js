import { createMotion } from '../motion/animator.js';
import { MotionSettings } from '../motion/presets.js';

export function createBarChart(root, labelsRoot, { values, labels, todayIndex, format }) {
  let data = values.slice();
  let bars = [];
  let timers = [];

  function column(i, start) {
    const col = document.createElement('div');
    col.className = 'chart__col';
    const bar = document.createElement('div');
    bar.className = 'chart__bar';
    const tip = document.createElement('div');
    tip.className = 'chart__tip';
    col.append(tip, bar);
    root.appendChild(col);
    const label = document.createElement('span');
    labelsRoot.appendChild(label);
    const motion = createMotion({ h: start }, { response: 0.6, damping: 0.56, restDelta: 0.0005 });
    motion.onUpdate(({ h }) => {
      const scale = Math.max(0, h);
      bar.style.transform = `scaleY(${scale})`;
      tip.style.transform = `translate(-50%, ${-(scale * bar.offsetHeight) - 6}px)`;
    });
    bar.style.transform = `scaleY(${Math.max(0, start)})`;
    return { column: col, bar, tip, label, motion, index: i };
  }

  function build(count) {
    bars.forEach((entry) => entry.motion.stop());
    root.textContent = '';
    labelsRoot.textContent = '';
    bars = Array.from({ length: count }, (_, i) => column(i, 0));
    root.style.setProperty('--cols', String(count));
    labelsRoot.style.setProperty('--cols', String(count));
    root.classList.toggle('chart--dense', count > 12);
    labelsRoot.classList.toggle('chart__labels--dense', count > 12);
  }

  function decorate(nextLabels, nextToday) {
    bars.forEach((entry, i) => {
      entry.column.classList.toggle('is-today', i === nextToday);
      entry.label.textContent = nextLabels[i] || '';
      entry.label.classList.toggle('is-today', i === nextToday);
    });
  }

  function clearTimers() {
    timers.forEach((id) => window.clearTimeout(id));
    timers = [];
  }

  function refresh(stagger) {
    clearTimers();
    const max = Math.max(1, ...data);
    const step = bars.length > 12 ? 14 : 55;
    bars.forEach((entry, i) => {
      entry.tip.textContent = format(data[i]);
      const target = data[i] / max;
      const run = () => entry.motion.to({ h: target }, MotionSettings.reduced ? MotionSettings.spring('focus') : undefined);
      if (stagger && !MotionSettings.reduced) timers.push(window.setTimeout(run, i * step));
      else run();
    });
  }

  build(data.length);
  decorate(labels, todayIndex);

  return {
    grow() {
      bars.forEach((entry) => entry.motion.set({ h: 0 }));
      refresh(true);
    },
    add(index, amount) {
      data[index] += amount;
      refresh(false);
    },
    update(next) {
      const resized = next.values.length !== bars.length;
      data = next.values.slice();
      if (resized) build(data.length);
      decorate(next.labels, next.todayIndex);
      if (resized) refresh(true);
      else refresh(!!next.stagger);
    },
  };
}
