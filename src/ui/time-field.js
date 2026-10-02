import { createMotion } from '../motion/animator.js';
import { MotionSettings } from '../motion/presets.js';

function pad(n) {
  return String(n).padStart(2, '0');
}

function parse(value) {
  const [h, m] = String(value || '00:00').split(':').map(Number);
  return { h: Number.isFinite(h) ? Math.max(0, Math.min(23, h)) : 0, m: Number.isFinite(m) ? Math.max(0, Math.min(59, m)) : 0 };
}

export function createTimeField({ value = '00:00', label = '', onChange } = {}) {
  const el = document.createElement('span');
  el.className = 'tf';
  el.innerHTML = '<input class="tf__part tf__h mono" inputmode="numeric" maxlength="2" autocomplete="off"><span class="tf__colon mono" aria-hidden="true">:</span><input class="tf__part tf__m mono" inputmode="numeric" maxlength="2" autocomplete="off">';
  if (label) el.setAttribute('aria-label', label);
  const hours = el.querySelector('.tf__h');
  const minutes = el.querySelector('.tf__m');
  hours.setAttribute('aria-label', `${label} 小時`);
  minutes.setAttribute('aria-label', `${label} 分鐘`);
  let current = parse(value);
  const bump = createMotion({ s: 1 }, { response: 0.36, damping: 0.45, restDelta: 0.0005 });
  let bumped = hours;
  bump.onUpdate(({ s }) => {
    bumped.style.transform = Math.abs(s - 1) < 0.0005 ? '' : `scale(${s.toFixed(4)})`;
  });

  function pop(input) {
    if (MotionSettings.reduced) return;
    bumped = input;
    bump.set({ s: 0.9 });
    bump.to({ s: 1 }, { response: 0.36, damping: 0.45 });
  }

  function render() {
    hours.value = pad(current.h);
    minutes.value = pad(current.m);
  }

  function commit() {
    const next = `${pad(current.h)}:${pad(current.m)}`;
    if (onChange) onChange(next);
  }

  function readInput(input, max) {
    const digits = input.value.replace(/\D/g, '').slice(0, 2);
    if (!digits) return null;
    const n = Number(digits);
    if (n > max) {
      pop(input);
      return max;
    }
    return n;
  }

  function step(part, delta) {
    if (part === 'h') current.h = (current.h + delta + 24) % 24;
    else current.m = (Math.round(current.m / 5) * 5 + delta * 5 + 60) % 60;
    render();
    pop(part === 'h' ? hours : minutes);
    commit();
  }

  [[hours, 'h', 23], [minutes, 'm', 59]].forEach(([input, part, max]) => {
    input.addEventListener('focus', () => input.select());
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 2);
      if (part === 'h' && input.value.length === 2) minutes.focus();
    });
    input.addEventListener('change', () => {
      const n = readInput(input, max);
      if (n !== null) current[part] = n;
      render();
      commit();
    });
    input.addEventListener('blur', render);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        step(part, event.key === 'ArrowUp' ? 1 : -1);
      } else if (event.key === 'Enter') {
        input.blur();
      }
    });
    input.addEventListener('wheel', (event) => {
      if (document.activeElement !== input) return;
      event.preventDefault();
      step(part, event.deltaY < 0 ? 1 : -1);
    }, { passive: false });
  });

  render();
  return {
    el,
    get value() { return `${pad(current.h)}:${pad(current.m)}`; },
    set(next) {
      current = parse(next);
      render();
    },
  };
}
