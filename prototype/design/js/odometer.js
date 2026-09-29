import { createMotion } from '../../../src/motion/animator.js';
import { MotionSettings } from '../../../src/motion/presets.js';

const DIGITS = '0123456789';
const REST = 0.0005;

export function formatAmount(value) {
  return Math.round(Math.abs(value)).toLocaleString('en-US');
}

export function createOdometer(element, { value = 0, format = formatAmount } = {}) {
  let current = value;
  let columns = [];
  let shape = '';

  element.classList.add('odo');

  function shapeOf(text) {
    return text.replace(/\d/g, '0');
  }

  function build(text, startDigits) {
    element.textContent = '';
    columns = [];
    let digitIndex = 0;
    Array.from(text).forEach((char) => {
      if (!/\d/.test(char)) {
        const sep = document.createElement('span');
        sep.className = 'odo__sep';
        sep.textContent = char;
        sep.setAttribute('aria-hidden', 'true');
        element.appendChild(sep);
        return;
      }
      const column = document.createElement('span');
      column.className = 'odo__col';
      column.setAttribute('aria-hidden', 'true');
      const strip = document.createElement('span');
      strip.className = 'odo__strip';
      Array.from(DIGITS).forEach((digit) => {
        const cell = document.createElement('span');
        cell.textContent = digit;
        strip.appendChild(cell);
      });
      const still = document.createElement('span');
      still.className = 'odo__still';
      column.append(strip, still);
      element.appendChild(column);
      const start = startDigits ? startDigits[digitIndex] ?? 0 : Number(char);
      const entry = { motion: null, digit: Number(char), column, strip, still };
      const motion = createMotion({ d: start }, { response: 0.6, damping: 0.86, restDelta: 0.001 });
      motion.onUpdate(({ d }) => paint(entry, d));
      entry.motion = motion;
      paint(entry, start);
      columns.push(entry);
      digitIndex += 1;
    });
    shape = shapeOf(text);
  }

  function paint(entry, d) {
    const resting = Math.abs(d - entry.digit) < REST;
    if (resting) {
      if (!entry.column.classList.contains('is-rest')) {
        entry.still.textContent = String(entry.digit);
        entry.strip.style.transform = '';
        entry.column.classList.add('is-rest');
      }
      return;
    }
    entry.column.classList.remove('is-rest');
    entry.strip.style.transform = `translate3d(0, ${-d * 1.08}em, 0)`;
  }

  function digitsOf(text) {
    return Array.from(text).filter((char) => /\d/.test(char)).map(Number);
  }

  function set(next, { from } = {}) {
    const text = format(next);
    const fromText = format(from ?? current);
    element.setAttribute('aria-label', text);
    if (shapeOf(text) !== shape || from !== undefined) {
      const previous = digitsOf(fromText);
      const target = digitsOf(text);
      const offset = target.length - previous.length;
      const start = target.map((_, i) => (i - offset >= 0 ? previous[i - offset] : 0));
      build(text, start);
    }
    const digits = digitsOf(text);
    const count = columns.length;
    columns.forEach((entry, i) => {
      const changed = entry.digit !== digits[i];
      entry.digit = digits[i];
      if (changed || !entry.column.classList.contains('is-rest')) paint(entry, entry.motion.get('d'));
      const spring = MotionSettings.reduced ? MotionSettings.spring('focus') : { response: 0.5 + (count - i) * 0.06, damping: 0.68 };
      entry.motion.to({ d: digits[i] }, spring);
    });
    current = next;
  }

  build(format(value));
  element.setAttribute('aria-label', format(value));

  return {
    get value() { return current; },
    set,
  };
}
