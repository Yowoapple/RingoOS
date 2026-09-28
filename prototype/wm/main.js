import { Animator } from '../../src/motion/animator.js';
import { MotionSettings } from '../../src/motion/presets.js';
import { createWindowStore } from '../../src/wm/store.js';
import { createWindowManager } from '../../src/wm/window-manager.js';
import { createDock } from '../../src/dock/dock.js';
import { APPS } from './apps.js';
import { createTweaks } from './tweaks.js';

const root = document.getElementById('proto');
const renderIcon = (app) => `<span class="proto-icon proto-icon--${app.tone}"><span>${app.short}</span></span>`;

const store = createWindowStore();
let wm = null;
const dock = createDock({
  root: document.getElementById('dock'),
  apps: APPS,
  store,
  renderIcon,
  onActivate: (id) => wm.open(id),
});

wm = createWindowManager({
  root,
  areaEl: document.getElementById('wm-area'),
  backdropEl: document.getElementById('proto-backdrop'),
  apps: APPS,
  store,
  dock,
  renderIcon,
});

const focusedLabel = document.getElementById('proto-focused');
const hint = document.getElementById('proto-hint');
store.subscribe(() => {
  const focused = store.focusedId ? store.get(store.focusedId) : null;
  focusedLabel.textContent = focused ? focused.title : '';
  hint.hidden = store.all().some((record) => record.state !== 'closed');
});

const clock = document.getElementById('proto-clock');
function tickClock() {
  const now = new Date();
  clock.textContent = `${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}
tickClock();
window.setInterval(tickClock, 15000);

function createHud(el) {
  let enabled = false;
  let frames = 0;
  let worst = 0;
  let last = performance.now();
  let windowStart = last;
  function loop(now) {
    if (!enabled) return;
    const dt = now - last;
    last = now;
    frames += 1;
    worst = Math.max(worst, dt);
    if (now - windowStart >= 500) {
      const fps = Math.round((frames * 1000) / (now - windowStart));
      el.textContent = `fps ${fps}\nworst frame ${worst.toFixed(1)} ms\nactive springs ${Animator.activeCount}\nspeed ${Animator.timeScale}×\nlayout ${wm.layout}`;
      frames = 0;
      worst = 0;
      windowStart = now;
    }
    requestAnimationFrame(loop);
  }
  return {
    setEnabled(value) {
      enabled = value;
      el.hidden = !value;
      if (value) {
        last = performance.now();
        windowStart = last;
        requestAnimationFrame(loop);
      }
    },
  };
}

createTweaks({
  panel: document.getElementById('tweaks'),
  toggle: document.getElementById('tweaks-toggle'),
  dock,
  root,
  hud: createHud(document.getElementById('proto-hud')),
});

dock.setBadge('calendar', 2);

window.__ringo = { Animator, MotionSettings, store, wm, dock };
