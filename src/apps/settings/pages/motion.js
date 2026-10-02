import { createMotion } from '../../../motion/animator.js';
import { MotionSettings } from '../../../motion/presets.js';
import { Storage } from '../../../core/storage/storage.js';
import { group, h, row, segmented, select } from '../kit.js';

const REDUCED_KEY = 'yoworingo.reduced-motion';
const REDUCED = ['system', 'off', 'on'];

function demo() {
  const el = h('div', 'st-demo');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<span class="st-demo__track"></span><span class="st-demo__ball"></span><span class="st-demo__label mono"></span>';
  const ball = el.querySelector('.st-demo__ball');
  const label = el.querySelector('.st-demo__label');
  const motion = createMotion({ x: 0, s: 1 }, { response: 0.5, damping: 0.7, restDelta: { x: 0.0005, s: 0.0005 } });
  let side = 0;
  let timer = 0;
  let running = false;
  motion.onUpdate(({ x, s }) => {
    const width = el.clientWidth - ball.offsetWidth - 16;
    const v = motion.velocity('x') * width;
    const stretch = MotionSettings.reduced ? 0 : Math.min(0.32, Math.abs(v) / 2400);
    ball.style.transform = `translate3d(${(8 + x * width).toFixed(2)}px, -50%, 0) scale(${(s * (1 + stretch)).toFixed(4)}, ${(s * (1 - stretch * 0.5)).toFixed(4)})`;
  });
  function flip() {
    if (!running) return;
    if (!el.offsetParent || document.visibilityState === 'hidden') {
      running = false;
      return;
    }
    side = 1 - side;
    const spring = MotionSettings.reduced ? MotionSettings.spring('focus') : MotionSettings.raw('open');
    label.textContent = MotionSettings.reduced ? '減少動態' : `${MotionSettings.presetName === 'ios' ? 'iOS' : '澎湃 OS'} · ${spring.response.toFixed(2)} / ${spring.damping.toFixed(2)}`;
    motion.to({ x: side }, spring).then(() => {
      if (running) timer = window.setTimeout(flip, 700);
    });
  }
  return {
    el,
    start() {
      if (running) return;
      running = true;
      window.clearTimeout(timer);
      timer = window.setTimeout(flip, 250);
    },
    stop() {
      running = false;
      window.clearTimeout(timer);
    },
    replay() {
      window.clearTimeout(timer);
      if (!running) return;
      motion.set({ s: 0.8 });
      motion.to({ s: 1 }, { response: 0.4, damping: 0.45 });
      flip();
    },
  };
}

export function motionPage(ctx) {
  const el = h('div', 'st-page__body');
  const show = demo();
  const preset = select({
    options: [{ value: 'hyperos', label: '澎湃 OS' }, { value: 'ios', label: 'iOS' }],
    value: MotionSettings.presetName,
    menuHost: ctx.menuHost,
    label: '動畫風格',
    onChange(v) {
      ctx.setMotionPreset(v);
      show.replay();
    },
  });
  const stored = Storage.get(REDUCED_KEY, 'system');
  const reduced = segmented(['跟隨系統', '關', '開'], Math.max(0, REDUCED.indexOf(stored)), (i) => {
    ctx.setReduced(REDUCED[i]);
    show.replay();
  }, { label: '減少動態效果' });

  el.append(
    show.el,
    group([
      row({ label: '動畫風格', hint: '澎湃 OS 軟、會回彈；iOS 俐落、收得乾淨', control: preset.el, keywords: '彈簧 hyperos ios 手感' }),
      row({ label: '減少動態效果', hint: '開啟後改用短淡入，不做擠壓、拉伸與模糊', control: reduced.el, keywords: '暈 無障礙 reduce motion' }),
    ]),
  );

  return {
    id: 'motion',
    title: '動態',
    lede: '動畫的手感與無障礙',
    icon: 'motion',
    el,
    show() {
      reduced.api.measure();
      show.start();
    },
    hide() {
      show.stop();
    },
    refreshGlass() {
      reduced.api.refreshGlass();
    },
    sync() {
      preset.api.set(MotionSettings.presetName);
    },
  };
}
