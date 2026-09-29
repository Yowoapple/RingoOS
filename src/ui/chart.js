import { createMotion } from '../motion/animator.js';
import { MotionSettings } from '../motion/presets.js';

export function createBarChart(root, labelsRoot, { values, labels, todayIndex, format }) {
  const data = values.slice();
  const bars = data.map((value, i) => {
    const column = document.createElement('div');
    column.className = 'chart__col';
    if (i === todayIndex) column.classList.add('is-today');
    const bar = document.createElement('div');
    bar.className = 'chart__bar';
    const tip = document.createElement('div');
    tip.className = 'chart__tip';
    column.append(tip, bar);
    root.appendChild(column);
    const label = document.createElement('span');
    label.textContent = labels[i];
    labelsRoot.appendChild(label);
    const motion = createMotion({ h: 0 }, { response: 0.6, damping: 0.56, restDelta: 0.0005 });
    motion.onUpdate(({ h }) => {
      const scale = Math.max(0, h);
      bar.style.transform = `scaleY(${scale})`;
      tip.style.transform = `translate(-50%, ${-(scale * bar.offsetHeight) - 6}px)`;
    });
    return { column, bar, tip, motion };
  });

  function maxValue() {
    return Math.max(1, ...data);
  }

  function refresh(stagger) {
    const max = maxValue();
    bars.forEach((entry, i) => {
      entry.tip.textContent = format(data[i]);
      const target = data[i] / max;
      const run = () => entry.motion.to({ h: target }, MotionSettings.reduced ? MotionSettings.spring('focus') : undefined);
      if (stagger && !MotionSettings.reduced) window.setTimeout(run, i * 55);
      else run();
    });
  }

  return {
    grow() {
      bars.forEach((entry) => entry.motion.set({ h: 0 }));
      refresh(true);
    },
    add(index, amount) {
      data[index] += amount;
      refresh(false);
    },
  };
}
