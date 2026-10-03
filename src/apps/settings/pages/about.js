import { createMotion } from '../../../motion/animator.js';
import { MotionSettings } from '../../../motion/presets.js';
import { Storage } from '../../../core/storage/storage.js';
import { Data } from '../../../core/data-model.js';
import { Fx } from '../../../ui/fx-tier.js';
import { createOdometer } from '../../../ui/odometer.js';
import { animateWordmark, wordmarkHTML } from '../../../ui/wordmark.js';
import { h, text } from '../kit.js';

const BUILD = typeof __RINGO_BUILD__ !== 'undefined' ? __RINGO_BUILD__ : { version: '26.0.0', codename: 'Fuji', commit: '', date: '' };
const DEV_KEY = 'yoworingo.v2.developer';
const DEV_DAY = 24 * 60 * 60 * 1000;

export function developerUntil(now = Date.now()) {
  const value = Storage.get(DEV_KEY, null);
  if (!value) return 0;
  if (value === true) {
    const until = now + DEV_DAY;
    Storage.set(DEV_KEY, { until });
    return until;
  }
  if (typeof value.until === 'number' && value.until > now) return value.until;
  Storage.remove(DEV_KEY);
  return 0;
}

function untilText(until) {
  const d = new Date(until);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${sameDay ? '今天' : '明天'} ${time} `;
}
const ARROW = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 8.5l5-5M4.5 3.5h4v4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const FX_NAMES = { full: '完整', lite: '精簡', solid: '實色' };

const MADE = [
  { label: '作者網站', note: 'yowoapple.github.io/YoWoRingo', href: 'https://yowoapple.github.io/YoWoRingo/' },
  { label: '原始碼', note: 'github.com/Yowoapple/RingoOS', href: 'https://github.com/Yowoapple/RingoOS' },
  { label: '授權', note: 'All rights reserved', href: 'https://github.com/Yowoapple/RingoOS/blob/main/LICENSE' },
];

const CREDITS = [
  { name: 'EmoteLab', note: '桌寵角色的動畫以 EmoteLab 製作，角色設計屬於原作者', links: [['emotelab.app', 'https://emotelab.app']] },
  { name: '交通部中央氣象署', note: '臺灣的鄉鎮預報、測站實測與天氣特報，依政府資料開放授權條款使用', links: [['開放資料平臺', 'https://opendata.cwa.gov.tw']] },
  { name: 'Open-Meteo', note: '全球天氣預報，CC BY 4.0', links: [['open-meteo.com', 'https://open-meteo.com']] },
  { name: 'OpenStreetMap', note: '地名搜尋（Photon），© OpenStreetMap 貢獻者，ODbL', links: [['版權資訊', 'https://www.openstreetmap.org/copyright']] },
  { name: 'GeoNames', note: '外國城市的中文地名，CC BY 4.0', links: [['geonames.org', 'https://www.geonames.org']] },
  { name: 'YouTube', note: '電台的 YouTube 模式使用 YouTube API Services', links: [['YouTube 服務條款', 'https://www.youtube.com/t/terms'], ['Google 隱私權政策', 'https://policies.google.com/privacy']] },
  { name: 'HarmonyOS Sans', note: '介面字型，依 HarmonyOS Sans Fonts License 使用' },
  { name: 'Geist Mono', note: '數字與等寬字，SIL Open Font License 1.1', links: [['geist-font', 'https://github.com/vercel/geist-font']] },
  { name: 'qrcode-generator', note: '日曆的 QR code，MIT License' },
];

function link(label, href, className = 'ab-link') {
  const a = h('a', className, `<span></span>${ARROW}`);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.querySelector('span').textContent = label;
  return a;
}

function stats() {
  const days = Data.getState().days || {};
  let entries = 0;
  let logged = 0;
  let done = 0;
  let first = null;
  Object.entries(days).forEach(([key, day]) => {
    const count = (day.income || []).length + (day.expenses || []).length;
    const tasks = day.tasks || [];
    entries += count;
    if (count) logged += 1;
    done += tasks.filter((t) => t.done).length;
    if ((count || tasks.length) && (!first || key < first)) first = key;
  });
  let since = 0;
  if (first) {
    const [y, m, d] = first.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    const today = new Date();
    since = Math.max(1, Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()) - start) / 86400000) + 1);
  }
  return { entries, logged, done, since };
}

function browserName() {
  const brands = navigator.userAgentData && navigator.userAgentData.brands;
  if (brands) {
    const known = brands.find((b) => /Edge|Chrome|Opera|Brave/i.test(b.brand) && !/Not/i.test(b.brand) && b.brand !== 'Chromium');
    if (known) return `${known.brand.replace('Google ', '').replace('Microsoft ', '')} ${known.version}`;
  }
  const ua = navigator.userAgent;
  const match = ua.match(/Edg\/(\d+)/) || ua.match(/Firefox\/(\d+)/) || ua.match(/Chrome\/(\d+)/) || ua.match(/Version\/(\d+).*Safari/);
  if (!match) return '未知';
  if (match[0].startsWith('Edg')) return `Edge ${match[1]}`;
  if (match[0].startsWith('Firefox')) return `Firefox ${match[1]}`;
  if (match[0].startsWith('Chrome')) return `Chrome ${match[1]}`;
  return `Safari ${match[1]}`;
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(0)} GB`;
}

export function aboutPage(ctx) {
  const { island } = ctx;
  const el = h('div', 'st-page__body ab');

  const hero = h('section', 'ab-hero');
  hero.innerHTML = `<span class="ab-hero__num mono" aria-hidden="true">26</span><div class="ab-hero__copy">${wordmarkHTML('line')}<p class="ab-hero__code">${BUILD.codename}</p><button type="button" class="ab-hero__build mono"></button></div>`;
  const num = hero.querySelector('.ab-hero__num');
  const mark = hero.querySelector('.wm');
  const build = hero.querySelector('.ab-hero__build');
  build.textContent = [BUILD.version, BUILD.commit, BUILD.date].filter(Boolean).join(' · ');
  build.setAttribute('aria-label', `版本 ${build.textContent}`);
  const wordmark = animateWordmark(mark);
  mark.addEventListener('pointerenter', () => wordmark.play());
  const rise = createMotion({ y: 0 }, { response: 0.8, damping: 0.72, restDelta: 0.001 });
  rise.onUpdate(({ y }) => {
    num.style.transform = Math.abs(y) < 0.001 ? '' : `translate3d(0, ${(y * 100).toFixed(2)}%, 0)`;
  });

  let taps = 0;
  let tapTimer = 0;
  build.addEventListener('click', () => {
    window.clearTimeout(tapTimer);
    tapTimer = window.setTimeout(() => { taps = 0; }, 1600);
    taps += 1;
    const until = developerUntil();
    if (until) {
      if (taps === 1) island.toast({ text: `開發者模式 · ${untilText(until).trim()}關閉`, duration: 2400 });
      if (taps >= 4 && taps < 7) island.toast({ text: `再點 ${7 - taps} 下關閉`, duration: 1200 });
      if (taps === 7) {
        taps = 0;
        Storage.remove(DEV_KEY);
        island.toast({ text: '開發者模式已關閉', duration: 2400 });
      }
      return;
    }
    if (taps >= 4 && taps < 7) island.toast({ text: `再點 ${7 - taps} 下`, duration: 1200 });
    if (taps === 7) {
      taps = 0;
      Storage.set(DEV_KEY, { until: Date.now() + DEV_DAY });
      island.toast({ text: '開發者模式已開啟', duration: 2600 });
    }
  });

  const you = h('section', 'ab-block ab-you');
  you.append(text('h4', 'ab-block__title', '你和 RingoOS'));
  const grid = h('div', 'ab-stats');
  const statDefs = [['entries', '筆收支紀錄'], ['logged', '天有記帳'], ['done', '件代辦完成'], ['since', '天，從第一筆紀錄到今天']];
  const odos = {};
  statDefs.forEach(([key, label]) => {
    const item = h('div', 'ab-stat');
    item.innerHTML = '<span class="ab-stat__num mono"><span class="odo-host"></span></span><span class="ab-stat__label"></span>';
    item.querySelector('.ab-stat__label').textContent = label;
    odos[key] = createOdometer(item.querySelector('.odo-host'), { value: 0, format: (v) => Math.round(v).toLocaleString('en-US') });
    grid.append(item);
  });
  you.append(grid);

  const device = h('section', 'ab-block ab-device');
  device.append(text('h4', 'ab-block__title', '這台裝置'));
  const list = h('dl', 'ab-facts');
  const facts = {};
  [['browser', '瀏覽器'], ['screen', '螢幕'], ['fx', '效果等級'], ['storage', '使用空間'], ['persist', '資料保存']].forEach(([key, label]) => {
    const row = h('div', 'ab-fact');
    row.append(text('dt', '', label));
    facts[key] = text('dd', 'mono', '');
    row.append(facts[key]);
    list.append(row);
  });
  device.append(list);

  const made = h('section', 'ab-block ab-made');
  made.append(text('h4', 'ab-block__title', '製作'), text('p', 'ab-made__name', 'YoWoRingo'), text('p', 'ab-made__line', '設計、動畫引擎與每一個 App，一個人做的網頁作業系統。'));
  const madeLinks = h('div', 'ab-links');
  MADE.forEach((item) => {
    const a = link(item.label, item.href, 'ab-link ab-link--big');
    a.append(text('small', 'ab-link__note', item.note));
    madeLinks.append(a);
  });
  made.append(madeLinks);

  const credits = h('section', 'ab-block ab-credits');
  credits.append(text('h4', 'ab-block__title', '致謝與授權'));
  const creditList = h('ul', 'ab-credits__list');
  CREDITS.forEach((item) => {
    const li = h('li', 'ab-credit');
    li.append(text('span', 'ab-credit__name', item.name), text('span', 'ab-credit__note', item.note));
    if (item.links) {
      const links = h('span', 'ab-credit__links');
      item.links.forEach(([label, href]) => links.append(link(label, href)));
      li.append(links);
    }
    creditList.append(li);
  });
  credits.append(creditList);

  const foot = text('p', 'ab-foot mono', `© 2026 YoWoRingo · RingoOS ${BUILD.version} ${BUILD.codename}`);

  el.append(hero, you, device, made, credits, foot);

  function fillFacts() {
    facts.browser.textContent = browserName();
    facts.screen.textContent = `${window.screen.width} × ${window.screen.height} · ${Number(window.devicePixelRatio || 1).toFixed(2).replace(/\.?0+$/, '')}x`;
    facts.fx.textContent = Fx.choice === 'auto' ? `自動 · ${FX_NAMES[Fx.auto] || ''}` : FX_NAMES[Fx.choice] || Fx.choice;
    facts.storage.textContent = '—';
    facts.persist.textContent = '—';
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(({ usage, quota }) => {
        facts.storage.textContent = `${formatBytes(usage)} / ${formatBytes(quota)}`;
      }).catch(() => {});
    }
    if (navigator.storage && navigator.storage.persisted) {
      navigator.storage.persisted().then((ok) => {
        facts.persist.textContent = ok ? '不會被瀏覽器自動清除' : '空間不足時可能被瀏覽器清除';
      }).catch(() => {});
    }
  }

  function fillStats(fromZero) {
    const s = stats();
    Object.keys(odos).forEach((key) => {
      if (fromZero && !MotionSettings.reduced) odos[key].set(s[key], { from: 0 });
      else odos[key].set(s[key]);
    });
  }

  Data.subscribe(() => {
    if (el.isConnected) fillStats(false);
  });

  return {
    id: 'about',
    title: '關於',
    lede: `RingoOS ${BUILD.version.split('.')[0]} · ${BUILD.codename}`,
    icon: 'about',
    bare: true,
    el,
    show() {
      fillFacts();
      fillStats(true);
      if (MotionSettings.reduced) return;
      rise.set({ y: 0.55 });
      rise.to({ y: 0 }, { response: 0.8, damping: 0.72 });
      window.setTimeout(() => wordmark.play(), 520);
    },
  };
}
