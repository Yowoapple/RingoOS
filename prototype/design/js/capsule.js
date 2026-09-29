import { createMotion } from '../../../src/motion/animator.js';
import { MotionSettings } from '../../../src/motion/presets.js';

export function createCapsule({ root, pill, panel, onOpen }) {
  const motion = createMotion({ p: 0 }, { response: 0.5, damping: 0.75, restDelta: 0.0005 });
  let open = false;
  let rem = 20.8;
  let size = { W: 0, H: 0, w: 0, h: 0 };

  function measure() {
    rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 20.8;
    size = { W: root.offsetWidth, H: root.offsetHeight, w: pill.offsetWidth, h: pill.offsetHeight };
  }

  function render(p) {
    const { W, H, w, h } = size;
    const width = w + (W - w) * p;
    const height = h + (H - h) * p;
    const side = (W - width) / 2;
    const bottom = H - height;
    const radius = 0.7 * rem + (1.2 - 0.7) * rem * Math.min(1, Math.max(0, p));
    root.style.clipPath = `inset(0 ${side}px ${bottom}px ${side}px round ${radius}px)`;
    const reveal = Math.min(1, Math.max(0, (p - 0.35) / 0.5));
    panel.style.opacity = String(reveal);
    panel.style.visibility = p > 0.02 ? 'visible' : 'hidden';
    pill.style.opacity = String(Math.max(0, 1 - p * 3));
    pill.style.pointerEvents = p > 0.3 ? 'none' : '';
  }

  function set(next) {
    if (next === open) return;
    open = next;
    pill.setAttribute('aria-expanded', String(open));
    measure();
    motion.to({ p: open ? 1 : 0 }, MotionSettings.spring(open ? 'open' : 'close'));
    if (open && onOpen) onOpen();
  }

  motion.onUpdate(({ p }) => render(p));
  pill.addEventListener('click', () => set(true));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') set(false);
  });
  document.addEventListener('pointerdown', (event) => {
    if (open && !root.contains(event.target)) set(false);
  });
  window.addEventListener('resize', () => {
    measure();
    render(motion.get('p'));
  });

  measure();
  render(0);

  return {
    get open() { return open; },
    set,
    relayout() {
      measure();
      render(motion.get('p'));
    },
  };
}
