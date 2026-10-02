import '@fontsource-variable/geist-mono';
import { Animator, createMotion } from '../../../src/motion/animator.js';

const VARIANTS = [
  { id: 'B+', name: '描邊＋液滴（選定）', motion: 'pour', note: '以 B 為基底：平常是和字同粗的描邊膠囊。被拉長時像液滴一樣灌滿簽名色，放開後彈回、顏色退掉。選單列與 16px 分頁圖示這種小尺寸自動換成實心，辨識度跟 A 一樣。' },
  { id: 'A', name: '實心膠囊', motion: 'stretch', note: '最直接：O 就是一顆強調色膠囊。和 Dock 的執行中指示、選取液滴、靈動島是同一個形狀，整個系統的語言收在這一筆裡。' },
  { id: 'B', name: '描邊膠囊', motion: 'draw', note: '線條和 Geist Mono 的筆畫一樣粗，最安靜、最像字。缺點是小尺寸時跟普通的 O 差不多。' },
  { id: 'C', name: '靈動島', motion: 'dot', note: '墨色膠囊加一顆強調色小點，直接引用靈動島。小點以後可以拿來表示狀態（播放中、有通知）。' },
  { id: 'D', name: '液滴', motion: 'drip', note: '選項切換時液滴被拉長的那一瞬間：前圓後尖，帶方向感。最有個性，但需要講才知道典故。' },
  { id: 'E', name: '標籤', motion: 'pop', note: 'OS 住進膠囊裡，像一枚系統標籤。小尺寸最好認，App 圖示最穩；但「O 變膠囊」的巧思變弱了。' },
  { id: 'F', name: '游標（對照）', motion: 'blink', note: '另一條路：全小寫，膠囊立起來當輸入游標，意思是「正在運作」。放在這裡當對照組。' },
];

const DROP = { r1: 0.62, r2: 1, d: 1 };

function hull(x1, r1, x2, r2) {
  const d = x2 - x1;
  const s = Math.max(-0.999, Math.min(0.999, (r1 - r2) / d));
  const c = Math.sqrt(1 - s * s);
  const p1 = [x1 + r1 * s, -r1 * c];
  const p2 = [x2 + r2 * s, -r2 * c];
  const f = (n) => n.toFixed(4);
  return `M${f(p1[0])} ${f(p1[1])}L${f(p2[0])} ${f(p2[1])}A${f(r2)} ${f(r2)} 0 ${s < 0 ? 1 : 0} 1 ${f(p2[0])} ${f(-p2[1])}L${f(p1[0])} ${f(-p1[1])}A${f(r1)} ${f(r1)} 0 ${s > 0 ? 1 : 0} 1 ${f(p1[0])} ${f(p1[1])}Z`;
}

function dropShape(r1, r2, d) {
  const x1 = r1;
  const x2 = r1 + d;
  return { path: hull(x1, r1, x2, r2), width: x2 + r2 };
}

function wordmark(v, size = '') {
  const cls = `wm wm--${v.id === 'B+' ? 'P' : v.id}${size ? ` wm--${size}` : ''}`;
  if (v.id === 'B+') {
    return `<span class="${cls}" role="img" aria-label="RingoOS"><span class="wm__r">Ringo</span><span class="wm__os"><span class="wm__o" aria-hidden="true"><i class="wm__pour"></i></span>S</span></span>`;
  }
  if (v.id === 'F') {
    return `<span class="${cls}" role="img" aria-label="RingoOS"><span class="wm__r">ringo</span><span class="wm__o" aria-hidden="true"></span><span class="wm__os">os</span></span>`;
  }
  if (v.id === 'E') {
    return `<span class="${cls}" role="img" aria-label="RingoOS"><span class="wm__r">Ringo</span><span class="wm__o" aria-hidden="true"><svg class="wm__svg" viewBox="0 0 92 40"><rect class="wm__pill" width="92" height="40" rx="20"/><text class="wm__tag" x="46" y="28.9" text-anchor="middle">OS</text></svg></span></span>`;
  }
  let inner = '';
  if (v.id === 'B') inner = '<svg class="wm__svg" viewBox="0 0 150 100"><rect class="wm__line" x="6.5" y="6.5" width="137" height="87" rx="43.5" pathLength="1"/></svg>';
  if (v.id === 'C') inner = '<i class="wm__dot"></i>';
  if (v.id === 'D') {
    const { path, width } = dropShape(DROP.r1, DROP.r2, DROP.d);
    inner = `<svg class="wm__svg" viewBox="0 -1 ${width.toFixed(4)} 2"><path class="wm__drop" d="${path}"/></svg>`;
  }
  return `<span class="${cls}" role="img" aria-label="RingoOS"><span class="wm__r">Ringo</span><span class="wm__os"><span class="wm__o" aria-hidden="true">${inner}</span>S</span></span>`;
}

function mark(v, small = false) {
  const body = {
    'B+': small ? '<rect class="m-acc" x="11" y="22" width="42" height="20" rx="10"/>' : '<rect class="m-line" x="13.25" y="24.25" width="37.5" height="15.5" rx="7.75"/>',
    A: '<rect class="m-acc" x="11" y="22" width="42" height="20" rx="10"/>',
    B: '<rect class="m-line" x="13.25" y="24.25" width="37.5" height="15.5" rx="7.75"/>',
    C: '<rect class="m-ink" x="11" y="22" width="42" height="20" rx="10"/><circle class="m-acc" cx="43" cy="32" r="4.6"/>',
    D: (() => {
      const { path, width } = dropShape(DROP.r1, DROP.r2, DROP.d);
      const k = 11;
      return `<path class="m-acc" transform="translate(${(32 - (width * k) / 2).toFixed(2)} 32) scale(${k})" d="${path}"/>`;
    })(),
    E: '<rect class="m-acc" x="7" y="19" width="50" height="26" rx="13"/><text class="m-on m-text" x="32" y="37.6" text-anchor="middle">OS</text>',
    F: '<rect class="m-acc" x="26.5" y="13" width="11" height="38" rx="5.5"/>',
  }[v.id];
  return `<svg class="mk" viewBox="0 0 64 64" aria-hidden="true">${body}</svg>`;
}

function tabMock(v) {
  return `<div class="tab"><span class="fav fav--16">${mark(v, true)}</span><span class="tab__title">RingoOS</span><span class="tab__x" aria-hidden="true"></span></div>`;
}

function section(v, i) {
  const el = document.createElement('section');
  el.className = 'lb-v';
  el.dataset.v = v.id;
  el.innerHTML = `
    <div class="lb-v__meta">
      <span class="lb-v__id mono">${v.id}</span>
      <div>
        <h2 class="lb-v__name">${v.name}</h2>
        <p class="lb-v__note">${v.note}</p>
      </div>
      <span class="lb-v__count mono">${String(i + 1).padStart(2, '0')} / ${String(VARIANTS.length).padStart(2, '0')}</span>
    </div>
    <div class="lb-heroes">
      <div class="lb-hero ctx--dark" data-hero>${wordmark(v, 'xl')}<span class="lb-hero__tag mono">DARK</span></div>
      <div class="lb-hero ctx--light" data-hero>${wordmark(v, 'xl')}<span class="lb-hero__tag mono">LIGHT</span></div>
    </div>
    <div class="lb-ctx">
      <figure class="lb-cell lb-cell--bars">
        <div class="bar ctx--dark">${wordmark(v)}<span class="bar__app">桌面</span><span class="bar__sp"></span><span class="bar__clock mono">10/02 週五 21:40</span></div>
        <div class="bar ctx--light">${wordmark(v)}<span class="bar__app">每日記帳</span><span class="bar__sp"></span><span class="bar__clock mono">10/02 週五 21:40</span></div>
        <figcaption class="mono">MENUBAR · 實際大小</figcaption>
      </figure>
      <figure class="lb-cell lb-cell--icons">
        <div class="icons">
          <div class="icons__half ctx--dark"><span class="tile">${mark(v)}</span><span class="tile tile--sm">${mark(v)}</span></div>
          <div class="icons__half ctx--light"><span class="tile">${mark(v)}</span><span class="tile tile--sm">${mark(v)}</span></div>
        </div>
        <figcaption class="mono">APP ICON · 64 / 40 PX</figcaption>
      </figure>
      <figure class="lb-cell lb-cell--tabs">
        <div class="strip ctx--dark">${tabMock(v)}<span class="fav fav--32">${mark(v)}</span><span class="fav fav--16">${mark(v, true)}</span></div>
        <div class="strip ctx--light">${tabMock(v)}<span class="fav fav--32">${mark(v)}</span><span class="fav fav--16">${mark(v, true)}</span></div>
        <figcaption class="mono">FAVICON · 32 / 16 PX</figcaption>
      </figure>
      <figure class="lb-cell lb-cell--readme">
        <div class="readme ctx--light">
          <div class="readme__chrome"><i></i><i></i><i></i><span class="mono">github.com/Yowoapple/RingoOS</span></div>
          <div class="readme__body">
            ${wordmark(v, 'md')}
            <p class="readme__tag">A webOS written from scratch — windows, dock, springs.</p>
            <p class="readme__meta mono">26.0.0 · Fuji · by YoWoRingo</p>
          </div>
        </div>
        <figcaption class="mono">README HEADER</figcaption>
      </figure>
      <figure class="lb-cell lb-cell--about">
        <div class="about ctx--dark">
          <span class="about__num mono" aria-hidden="true">26</span>
          <div class="about__body">
            ${wordmark(v, 'md')}
            <p class="about__code">Fuji</p>
            <p class="about__ver mono">26.0.0 · d3dfe71 · 2026.10.02</p>
          </div>
        </div>
        <figcaption class="mono">ABOUT · 關於這台 RingoOS</figcaption>
      </figure>
    </div>`;
  return el;
}

const list = document.getElementById('lb-list');
VARIANTS.forEach((v, i) => list.appendChild(section(v, i)));

function capRatio() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = '600 100px "Geist Mono Variable"';
  const box = ctx.measureText('S');
  return box.actualBoundingBoxAscent / 100;
}

function soft(config, reduced) {
  return reduced ? { response: 0.3, damping: 1 } : config;
}

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function animator(wm, kind) {
  const o = wm.querySelector('.wm__o');
  if (kind === 'pour') {
    const pour = o.querySelector('.wm__pour');
    let base = 0;
    let em = 16;
    const m = createMotion({ w: 0, p: 1, f: 0 }, { response: 0.4, damping: 0.6, restDelta: { w: 0.0005, p: 0.0005, f: 0.001 } });
    m.onUpdate(({ w, p, f }) => {
      if (!base) return;
      const extra = w * em;
      o.style.width = Math.abs(w) < 0.0005 ? '' : `${base + extra}px`;
      const squash = Math.min(0.14, Math.max(0, extra / base) * 0.22);
      o.style.transform = Math.abs(p - 1) < 0.0005 && squash < 0.001 ? '' : `scale(${p}, ${p * (1 - squash)})`;
      const level = Math.max(0, Math.min(1, f));
      pour.style.transform = level < 0.001 ? '' : `scaleX(${level.toFixed(4)})`;
      pour.style.opacity = level < 0.001 ? '' : '1';
    });
    return async () => {
      o.style.width = '';
      base = o.getBoundingClientRect().width / (m.get('p') || 1);
      em = parseFloat(getComputedStyle(o).fontSize);
      await m.to({ p: 0.9 }, soft({ response: 0.14, damping: 1 }, reduced));
      m.to({ p: 1 }, soft({ response: 0.38, damping: 0.42 }, reduced));
      m.to({ f: 1 }, soft({ response: 0.3, damping: 0.7 }, reduced));
      await m.to({ w: 0.62 }, soft({ response: 0.26, damping: 0.6 }, reduced));
      m.to({ w: 0 }, soft({ response: 0.46, damping: 0.5 }, reduced));
      await new Promise((resolve) => window.setTimeout(resolve, 260));
      await m.to({ f: 0 }, soft({ response: 0.5, damping: 0.9 }, reduced));
    };
  }
  if (kind === 'pop') {
    const m = createMotion({ p: 1 }, { response: 0.4, damping: 0.5, restDelta: 0.0005 });
    m.onUpdate(({ p }) => {
      o.style.transform = Math.abs(p - 1) < 0.0005 ? '' : `scale(${p})`;
    });
    o.style.transformOrigin = '50% 50%';
    return async () => {
      await m.to({ p: 0.84 }, soft({ response: 0.16, damping: 1 }, reduced));
      await m.to({ p: 1 }, soft({ response: 0.42, damping: 0.38 }, reduced));
    };
  }
  if (kind === 'stretch') {
    let base = 0;
    let em = 16;
    const m = createMotion({ w: 0, p: 1 }, { response: 0.4, damping: 0.6, restDelta: { w: 0.0005, p: 0.0005 } });
    m.onUpdate(({ w, p }) => {
      if (!base) return;
      const extra = w * em;
      o.style.width = Math.abs(w) < 0.0005 ? '' : `${base + extra}px`;
      const squash = Math.min(0.14, Math.max(0, extra / base) * 0.22);
      o.style.transform = Math.abs(p - 1) < 0.0005 && squash < 0.001 ? '' : `scale(${p}, ${p * (1 - squash)})`;
    });
    return async () => {
      o.style.width = '';
      base = o.getBoundingClientRect().width / (m.get('p') || 1);
      em = parseFloat(getComputedStyle(o).fontSize);
      await m.to({ p: 0.9 }, soft({ response: 0.14, damping: 1 }, reduced));
      m.to({ p: 1 }, soft({ response: 0.38, damping: 0.42 }, reduced));
      await m.to({ w: 0.62 }, soft({ response: 0.26, damping: 0.6 }, reduced));
      await m.to({ w: 0 }, soft({ response: 0.46, damping: 0.5 }, reduced));
    };
  }
  if (kind === 'draw') {
    const line = o.querySelector('.wm__line');
    const m = createMotion({ t: 1, p: 1 }, { response: 0.6, damping: 1, restDelta: { t: 0.001, p: 0.0005 } });
    m.onUpdate(({ t, p }) => {
      line.style.strokeDashoffset = String(1 - Math.max(0, Math.min(1, t)));
      o.style.transform = Math.abs(p - 1) < 0.0005 ? '' : `scale(${p})`;
    });
    return async () => {
      m.set({ t: 0, p: 0.86 });
      m.to({ p: 1 }, soft({ response: 0.5, damping: 0.45 }, reduced));
      await m.to({ t: 1 }, soft({ response: 0.7, damping: 1 }, reduced));
    };
  }
  if (kind === 'dot') {
    const dot = o.querySelector('.wm__dot');
    const m = createMotion({ x: 0, s: 1, w: 0 }, { response: 0.5, damping: 0.6, restDelta: { x: 0.001, s: 0.001, w: 0.001 } });
    m.onUpdate(({ x, s, w }) => {
      const span = o.clientWidth - o.clientHeight;
      dot.style.transform = Math.abs(x) < 0.001 && Math.abs(s - 1) < 0.001 ? '' : `translate3d(${(x * span).toFixed(2)}px, 0, 0) scale(${s})`;
      o.style.transform = Math.abs(w) < 0.001 ? '' : `scale(${1 + w * 0.08}, ${1 - w * 0.06})`;
    });
    return async () => {
      await m.to({ s: 0.4 }, soft({ response: 0.16, damping: 1 }, reduced));
      m.set({ x: -1 });
      m.to({ s: 1 }, soft({ response: 0.36, damping: 0.45 }, reduced));
      m.to({ w: 1 }, soft({ response: 0.22, damping: 0.7 }, reduced)).then(() => m.to({ w: 0 }, soft({ response: 0.42, damping: 0.42 }, reduced)));
      await m.to({ x: 0 }, soft({ response: 0.5, damping: 0.58 }, reduced));
    };
  }
  if (kind === 'drip') {
    const svg = o.querySelector('svg');
    const path = o.querySelector('.wm__drop');
    const m = createMotion({ r: DROP.r1, d: DROP.d }, { response: 0.5, damping: 0.5, restDelta: { r: 0.0005, d: 0.0005 } });
    m.onUpdate(({ r, d }) => {
      const rest = Math.abs(r - DROP.r1) < 0.0005 && Math.abs(d - DROP.d) < 0.0005;
      const shape = dropShape(Math.max(0.2, r), DROP.r2, Math.max(0.05, d));
      path.setAttribute('d', shape.path);
      svg.setAttribute('viewBox', `0 -1 ${shape.width.toFixed(4)} 2`);
      o.style.width = rest ? '' : `${(shape.width / 2) * o.clientHeight}px`;
    });
    return async () => {
      await m.to({ d: 2.1, r: 0.34 }, soft({ response: 0.26, damping: 0.6 }, reduced));
      await m.to({ d: DROP.d, r: DROP.r1 }, soft({ response: 0.52, damping: 0.48 }, reduced));
    };
  }
  const m = createMotion({ y: 1, x: 0 }, { response: 0.36, damping: 0.4, restDelta: { y: 0.001, x: 0.001 } });
  m.onUpdate(({ y, x }) => {
    o.style.transform = Math.abs(y - 1) < 0.001 && Math.abs(x) < 0.001 ? '' : `translate3d(${(x * o.clientWidth).toFixed(2)}px, 0, 0) scaleY(${y})`;
  });
  return async () => {
    for (let k = 0; k < 3; k += 1) {
      m.set({ x: -0.9, y: 0.55 });
      m.to({ x: 0 }, soft({ response: 0.3, damping: 0.62 }, reduced));
      await m.to({ y: 1 }, soft({ response: 0.36, damping: 0.4 }, reduced));
      await new Promise((resolve) => window.setTimeout(resolve, 90));
    }
  };
}

const players = [];

function wire() {
  document.querySelectorAll('.lb-v').forEach((sectionEl) => {
    const v = VARIANTS.find((item) => item.id === sectionEl.dataset.v);
    sectionEl.querySelectorAll('[data-hero]').forEach((hero) => {
      const wm = hero.querySelector('.wm');
      const play = animator(wm, v.motion);
      let busy = false;
      const run = async () => {
        if (busy) return;
        busy = true;
        try {
          await play();
        } finally {
          busy = false;
        }
      };
      hero.addEventListener('pointerenter', run);
      players.push(run);
    });
  });
}

function setAccent(name) {
  document.documentElement.dataset.brand = name;
  document.querySelectorAll('.lb-accent').forEach((button) => {
    button.setAttribute('aria-checked', String(button.dataset.accent === name));
  });
}

document.querySelector('.lb-accents').addEventListener('click', (event) => {
  const button = event.target.closest('.lb-accent');
  if (button) setAccent(button.dataset.accent);
});

document.getElementById('lb-play').addEventListener('click', () => {
  players.forEach((run, i) => window.setTimeout(run, i * 70));
});

setAccent('apple');
document.fonts.ready.then(() => {
  document.documentElement.style.setProperty('--cap', capRatio().toFixed(3));
  requestAnimationFrame(wire);
});

if (new URLSearchParams(window.location.search).has('debug')) window.__logoLab = { Animator, players };
