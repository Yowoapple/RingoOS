import { createMotion } from '../../../motion/animator.js';
import { Fx } from '../../../ui/fx-tier.js';
import { clamp, group, h, pulse, row, segmented, select, slider, soft } from '../kit.js';

const LEAD = { response: 0.26, damping: 0.6 };
const TRAIL = { response: 0.46, damping: 0.72 };
const ACCENT_NAMES = { apple: '青蘋果', signal: '信號橘', ultramarine: '群青' };
const FX_NAMES = { full: '完整', lite: '精簡', solid: '實色' };
const STYLES = ['a', 'c'];
const THEMES = ['auto', 'light', 'dark'];

function accentPicker(value, onChange) {
  const el = h('div', 'acc');
  el.setAttribute('role', 'radiogroup');
  el.setAttribute('aria-label', '強調色');
  el.innerHTML = '<span class="acc__ring" aria-hidden="true"></span><button type="button" class="acc__dot acc__dot--auto" role="radio" data-value="auto" aria-label="自動，跟隨桌布"></button><button type="button" class="acc__dot acc__dot--apple" role="radio" data-value="apple" aria-label="青蘋果"></button><button type="button" class="acc__dot acc__dot--signal" role="radio" data-value="signal" aria-label="信號橘"></button><button type="button" class="acc__dot acc__dot--ultramarine" role="radio" data-value="ultramarine" aria-label="群青"></button>';
  const ring = el.querySelector('.acc__ring');
  const dots = Array.from(el.querySelectorAll('.acc__dot'));
  const motion = createMotion({ l: 0, r: 0, o: 0 }, { response: 0.3, damping: 0.8, restDelta: { l: 0.05, r: 0.05, o: 0.002 } });
  let current = value;
  motion.onUpdate(({ l, r, o }) => {
    ring.style.transform = `translate3d(${Math.min(l, r)}px, 0, 0)`;
    ring.style.width = `${Math.abs(r - l)}px`;
    ring.style.opacity = String(clamp(o, 0, 1));
  });
  function place(immediate) {
    const dot = dots.find((d) => d.dataset.value === current) || dots[0];
    if (!dot.offsetWidth) return;
    const inset = dot.offsetWidth * 0.16;
    const left = dot.offsetLeft - inset;
    const right = dot.offsetLeft + dot.offsetWidth + inset;
    dots.forEach((d) => d.setAttribute('aria-checked', String(d === dot)));
    if (immediate || motion.get('o') < 0.05) {
      motion.set({ l: left, r: right });
      motion.to({ o: 1 }, { response: 0.2, damping: 1 });
      return;
    }
    const forward = left >= motion.get('l');
    motion.to({ r: right }, soft(forward ? LEAD : TRAIL));
    motion.to({ l: left }, soft(forward ? TRAIL : LEAD));
  }
  dots.forEach((dot) => dot.addEventListener('click', () => {
    if (dot.dataset.value === current) return;
    current = dot.dataset.value;
    place(false);
    onChange(current);
  }));
  return {
    el,
    measure: () => place(true),
    set(next) {
      if (next === current) return;
      current = next;
      place(false);
    },
  };
}

function preview() {
  const el = h('div', 'st-preview');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="st-preview__wall"></div>
    <div class="st-preview__bar"><span class="st-preview__mark">Ringo<i></i>S</span><span class="st-preview__sp"></span><span class="st-preview__time mono"></span></div>
    <div class="st-preview__win">
      <div class="st-preview__head"><i></i><i></i><i></i></div>
      <div class="st-preview__lines"><b></b><b></b><b></b></div>
      <span class="st-preview__pill"></span>
    </div>
    <div class="st-preview__dock"><i></i><i></i><i class="is-on"></i><i></i><i></i></div>`;
  const wall = el.querySelector('.st-preview__wall');
  const time = el.querySelector('.st-preview__time');
  return {
    el,
    sync() {
      const source = document.getElementById('wall');
      if (source) {
        const style = getComputedStyle(source);
        wall.style.backgroundImage = style.backgroundImage;
        wall.style.backgroundColor = style.backgroundColor;
        wall.style.backgroundPosition = style.backgroundPosition;
      }
      const now = new Date();
      time.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    },
  };
}

export function appearancePage(ctx) {
  const { appearance, menuHost } = ctx;
  const el = h('div', 'st-page__body');
  const view = preview();
  const state = appearance.state;

  const style = segmented(['混合玻璃', '首爾單色'], STYLES.indexOf(state.style), (i) => appearance.set('style', STYLES[i]), { label: '風格' });
  const theme = segmented(['自動', '淺色', '深色'], THEMES.indexOf(state.theme), (i) => appearance.set('theme', THEMES[i]), { label: '深淺色' });
  const accent = accentPicker(state.accent, (v) => appearance.set('accent', v));
  const accentRow = row({ label: '強調色', control: accent.el, keywords: '顏色 主色 青蘋果 信號橘 群青' });

  const wallOptions = () => {
    const list = [{ value: 'mono', label: '單色' }, { value: 'aurora', label: '極光' }];
    if (appearance.hasPhoto) list.push({ value: 'photo', label: '我的照片' });
    list.push({ value: 'upload', label: '選擇照片…' });
    return list;
  };
  let wall = null;
  const wallSlot = h('div', 'st-inline');
  const removePhoto = h('button', 'btn btn--ghost st-mini', '移除照片');
  removePhoto.type = 'button';
  removePhoto.addEventListener('click', () => appearance.clearPhoto());
  function buildWall() {
    if (wall) wall.api.close();
    wallSlot.textContent = '';
    wall = select({
      options: wallOptions(),
      value: appearance.state.wall,
      menuHost,
      label: '桌布',
      onChange(v) {
        if (v === 'upload') {
          wall.api.set(appearance.state.wall);
          ctx.pickPhoto();
          return;
        }
        appearance.set('wall', v);
      },
    });
    wallSlot.append(wall.el);
    if (appearance.hasPhoto) wallSlot.append(removePhoto);
  }
  buildWall();

  const scale = slider({
    min: 100,
    max: 200,
    step: 10,
    value: Math.round(appearance.scale * 100),
    format: (v) => `${Math.round(v)}%`,
    onInput: (v) => appearance.setScale(v / 100),
    label: '字級',
  });

  const fx = select({
    options: [{ value: 'auto', label: '自動' }, { value: 'full', label: '完整' }, { value: 'lite', label: '精簡' }, { value: 'solid', label: '實色' }],
    value: Fx.choice,
    menuHost,
    label: '效果等級',
    onChange: (v) => Fx.set(v),
  });

  el.append(
    view.el,
    group([
      row({ label: '風格', hint: '混合玻璃讓浮在上面的東西透出桌布', control: style.el, keywords: '玻璃 單色 首爾' }),
      row({ label: '深淺色', control: theme.el, keywords: '主題 深色 淺色 暗色 dark light' }),
      accentRow,
    ]),
    group([
      row({ label: '桌布', hint: '照片會壓縮後只存在這台電腦的瀏覽器裡', control: wallSlot, keywords: '背景 圖片 照片 wallpaper' }),
      row({ label: '字級', hint: '整個介面一起等比放大，預設 130%', control: scale.el, stack: true, keywords: '文字大小 放大 縮放' }),
      row({ label: '效果等級', hint: '自動會依裝置與實際順暢度調整玻璃與模糊', control: fx.el, keywords: '效能 模糊 玻璃 卡頓 實色' }),
    ]),
  );

  let lastPhoto = appearance.hasPhoto;
  function sync() {
    const next = appearance.state;
    style.api.select(Math.max(0, STYLES.indexOf(next.style)));
    theme.api.select(Math.max(0, THEMES.indexOf(next.theme)));
    accent.set(next.accent);
    accentRow.hintEl.textContent = next.accent === 'auto' ? `跟隨桌布 · 目前是${ACCENT_NAMES[appearance.autoAccent] || ''}` : '';
    if (appearance.hasPhoto !== lastPhoto) {
      lastPhoto = appearance.hasPhoto;
      buildWall();
    } else {
      wall.api.set(next.wall);
    }
    scale.api.set(Math.round(appearance.scale * 100));
    fx.api.set(Fx.choice);
    fx.api.setLabel('auto', `自動 · ${FX_NAMES[Fx.auto]}`);
    view.sync();
  }

  appearance.subscribe(() => {
    sync();
    pulse(view.el);
  });
  Fx.subscribe(sync);
  sync();

  return {
    id: 'appearance',
    title: '外觀',
    lede: '風格、顏色、桌布與字級',
    icon: 'appearance',
    el,
    show() {
      style.api.measure();
      theme.api.measure();
      accent.measure();
      view.sync();
    },
    refreshGlass() {
      style.api.refreshGlass();
      theme.api.refreshGlass();
    },
  };
}
