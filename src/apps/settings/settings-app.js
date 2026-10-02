import { createMotion } from '../../motion/animator.js';
import { MotionSettings } from '../../motion/presets.js';
import { Fx } from '../../ui/fx-tier.js';
import { ICONS, clamp, h, pulse, soft, text } from './kit.js';
import { appearancePage } from './pages/appearance.js';
import { motionPage } from './pages/motion.js';
import { desktopPage } from './pages/desktop.js';
import { notifyPage } from './pages/notify.js';
import { categoriesPage } from './pages/categories.js';
import { budgetPage } from './pages/budget.js';
import { reminderPage } from './pages/reminder.js';
import { weatherPage } from './pages/weather.js';
import { radioPage } from './pages/radio.js';
import { dataPage } from './pages/data.js';
import { aboutPage } from './pages/about.js';

const GROUPS = [['appearance', 'motion', 'desktop'], ['notify', 'data'], ['categories', 'budget', 'reminder', 'weather', 'radio']];
const LEAD = { response: 0.26, damping: 0.6 };
const TRAIL = { response: 0.46, damping: 0.72 };
const NARROW_REM = 32;
const SEARCH_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.4 10.4L14 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

function rem() {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 20.8;
}

function motionFor(el, store) {
  let m = store.get(el);
  if (m) return m;
  m = createMotion({ e: 1, y: 0 }, { response: 0.42, damping: 0.7, restDelta: { e: 0.002, y: 0.05 } });
  m.onUpdate(({ e, y }) => {
    const t = clamp(e, 0, 1);
    const still = t > 0.999 && Math.abs(y) < 0.05;
    el.style.opacity = still ? '' : String(t);
    el.style.transform = still ? '' : `translate3d(0, ${y.toFixed(2)}px, 0)`;
    el.style.filter = t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * 5).toFixed(2)}px)` : '';
  });
  store.set(el, m);
  return m;
}

export function createSettingsApp({ root, ctx }) {
  const win = root.closest('.wm-window');
  const frame = () => root.closest('.wm-window');
  const full = { ...ctx, frame };
  const pages = [
    appearancePage(full),
    motionPage(full),
    desktopPage(full),
    notifyPage(full),
    dataPage(full),
    categoriesPage(full),
    budgetPage(full),
    reminderPage(full),
    weatherPage(full),
    radioPage(full),
    aboutPage(full),
  ];
  const byId = new Map(pages.map((page) => [page.id, page]));
  const motions = new WeakMap();

  root.classList.add('st');
  root.innerHTML = `
    <aside class="st__side">
      <label class="st-search">${SEARCH_ICON}<input class="st-search__input" type="search" placeholder="搜尋設定" aria-label="搜尋設定" autocomplete="off" spellcheck="false"></label>
      <nav class="st__nav" aria-label="設定分類"><span class="st__platter" aria-hidden="true"></span></nav>
      <div class="st__results" role="listbox" aria-label="搜尋結果" hidden></div>
    </aside>
    <div class="st__main">
      <div class="st__bar"><button type="button" class="st__back"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M7.6 2.6L4 6l3.6 3.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>設定</button></div>
      <div class="st__scroll"></div>
    </div>`;
  const side = root.querySelector('.st__side');
  const nav = root.querySelector('.st__nav');
  const platterEl = root.querySelector('.st__platter');
  const results = root.querySelector('.st__results');
  const search = root.querySelector('.st-search__input');
  const main = root.querySelector('.st__main');
  const scroll = root.querySelector('.st__scroll');
  const back = root.querySelector('.st__back');

  const navButtons = new Map();
  GROUPS.forEach((ids, gi) => {
    const wrap = h('div', 'st__navgroup');
    ids.forEach((id) => {
      const page = byId.get(id);
      const button = h('button', 'st__navbtn', `${ICONS[page.icon]}<span></span>`);
      button.type = 'button';
      button.dataset.page = id;
      button.querySelector('span').textContent = page.title;
      button.addEventListener('click', () => go(id, { push: true }));
      navButtons.set(id, button);
      wrap.append(button);
    });
    if (gi > 0) wrap.classList.add('st__navgroup--gap');
    nav.append(wrap);
  });
  const aboutButton = h('button', 'st__navbtn st__navbtn--about', `${ICONS.about}<span>關於 RingoOS</span>`);
  aboutButton.type = 'button';
  aboutButton.dataset.page = 'about';
  aboutButton.addEventListener('click', () => go('about', { push: true }));
  navButtons.set('about', aboutButton);
  side.append(aboutButton);

  const sections = new Map();
  pages.forEach((page) => {
    const section = h('section', 'st-page');
    section.dataset.page = page.id;
    section.setAttribute('aria-label', page.title);
    section.hidden = true;
    if (!page.bare) {
      const head = h('header', 'st-page__head');
      head.append(text('h3', 'st-page__title', page.title), text('p', 'st-page__lede', page.lede || ''));
      section.append(head);
    }
    section.append(page.el);
    scroll.append(section);
    sections.set(page.id, section);
  });

  const platter = createMotion({ t: 0, b: 0, o: 0 }, { response: 0.3, damping: 0.8, restDelta: { t: 0.05, b: 0.05, o: 0.002 } });
  let itemHeight = 0;
  platter.onUpdate(({ t, b, o }) => {
    const top = Math.min(t, b);
    const height = Math.abs(b - t);
    const squash = MotionSettings.reduced || !itemHeight ? 0 : clamp(((height - itemHeight) / itemHeight) * 0.08, 0, 0.1);
    platterEl.style.transform = `translate3d(0, ${top.toFixed(2)}px, 0) scaleX(${(1 - squash).toFixed(4)})`;
    platterEl.style.height = `${height.toFixed(2)}px`;
    platterEl.style.opacity = String(clamp(o, 0, 1));
  });
  function placePlatter(button, immediate) {
    if (button && !nav.contains(button)) {
      platter.to({ o: 0 }, { response: 0.2, damping: 1 });
      return;
    }
    if (!button || !button.offsetHeight) return;
    const top = button.offsetTop;
    const bottom = top + button.offsetHeight;
    itemHeight = button.offsetHeight;
    if (immediate || platter.get('o') < 0.05) {
      platter.set({ t: top, b: bottom });
      platter.to({ o: 1 }, { response: 0.2, damping: 1 });
      return;
    }
    const down = top >= platter.get('t');
    platter.to({ b: bottom }, soft(down ? LEAD : TRAIL));
    platter.to({ t: top }, soft(down ? TRAIL : LEAD));
  }

  const push = createMotion({ p: 0 }, { response: 0.5, damping: 0.78, restDelta: 0.001 });
  push.onUpdate(({ p }) => {
    if (!narrow) {
      side.style.transform = '';
      side.style.opacity = '';
      main.style.transform = '';
      return;
    }
    const t = clamp(p, -0.1, 1.1);
    side.style.transform = `translate3d(${(-t * 26).toFixed(2)}%, 0, 0)`;
    side.style.opacity = String(clamp(1 - t * 0.6, 0, 1));
    main.style.transform = `translate3d(${((1 - t) * 100).toFixed(2)}%, 0, 0)`;
    side.inert = t > 0.5;
    main.inert = t < 0.5;
  });

  let current = null;
  let narrow = false;
  let opened = false;

  function enterPage(id) {
    const section = sections.get(id);
    const items = [section.querySelector('.st-page__head'), ...section.querySelectorAll('.st-page__body > *')].filter(Boolean);
    items.forEach((item, i) => {
      const m = motionFor(item, motions);
      if (MotionSettings.reduced) {
        m.set({ e: 0, y: 0 });
        m.to({ e: 1 }, MotionSettings.spring('focus'));
        return;
      }
      m.set({ e: 0, y: 18 + Math.min(i, 6) * 10 });
      m.to({ e: 1 }, { response: 0.32 + Math.min(i, 6) * 0.03, damping: 1 });
      m.to({ y: 0 }, { response: 0.46 + Math.min(i, 6) * 0.045, damping: 0.62 });
    });
  }

  function go(id, { push: pushIn = false, instant = false } = {}) {
    const page = byId.get(id);
    if (!page) return;
    const changed = id !== current;
    if (changed) {
      const previous = current ? byId.get(current) : null;
      const leaving = current ? sections.get(current) : null;
      current = id;
      navButtons.forEach((button, key) => {
        if (key === id) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      });
      placePlatter(navButtons.get(id), instant);
      if (previous && previous.hide) previous.hide();
      if (leaving) {
        if (instant || MotionSettings.reduced) {
          leaving.hidden = true;
        } else {
          leaving.classList.add('is-leaving');
          const m = motionFor(leaving, motions);
          m.to({ e: 0, y: -8 }, { response: 0.18, damping: 1 }).then(() => {
            if (current !== leaving.dataset.page) {
              leaving.hidden = true;
              leaving.classList.remove('is-leaving');
              m.set({ e: 1, y: 0 });
            }
          });
        }
      }
      const section = sections.get(id);
      section.hidden = false;
      section.classList.remove('is-leaving');
      motionFor(section, motions).set({ e: 1, y: 0 });
      scroll.scrollTop = 0;
      if (win) win.classList.remove('is-scrolled');
      if (page.show) page.show();
      if (!instant) enterPage(id);
    }
    if (narrow && pushIn) {
      if (MotionSettings.reduced) push.set({ p: 1 });
      else push.to({ p: 1 }, MotionSettings.presetName === 'ios' ? { response: 0.42, damping: 0.9 } : { response: 0.5, damping: 0.74 });
    }
  }

  back.addEventListener('click', () => {
    if (MotionSettings.reduced) push.set({ p: 0 });
    else push.to({ p: 0 }, MotionSettings.presetName === 'ios' ? { response: 0.4, damping: 0.92 } : { response: 0.48, damping: 0.78 });
    const button = navButtons.get(current);
    if (button) button.focus({ preventScroll: true });
  });

  nav.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const list = Array.from(navButtons.values());
    const index = list.indexOf(document.activeElement);
    const next = list[clamp(index + (event.key === 'ArrowDown' ? 1 : -1), 0, list.length - 1)];
    next.focus();
  });

  scroll.addEventListener('scroll', () => {
    if (win) win.classList.toggle('is-scrolled', scroll.scrollTop > 1);
  }, { passive: true });

  function searchIndex() {
    const list = [];
    pages.forEach((page) => {
      list.push({ page, el: null, label: page.title, hay: `${page.title} ${page.lede}`.toLowerCase() });
      sections.get(page.id).querySelectorAll('[data-search]').forEach((el) => {
        list.push({ page, el, label: el.dataset.label || '', hay: el.dataset.search });
      });
    });
    return list;
  }

  function reveal(el) {
    if (!el) return;
    const top = el.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop - 16;
    scroll.scrollTo({ top: Math.max(0, top), behavior: MotionSettings.reduced ? 'auto' : 'smooth' });
    el.classList.remove('is-found');
    window.requestAnimationFrame(() => {
      el.classList.add('is-found');
      pulse(el);
      window.setTimeout(() => el.classList.remove('is-found'), 1600);
    });
  }

  function renderResults(query) {
    const q = query.trim().toLowerCase();
    nav.hidden = !!q;
    results.hidden = !q;
    results.textContent = '';
    if (!q) {
      placePlatter(navButtons.get(current), true);
      return;
    }
    const words = q.split(/\s+/);
    const found = searchIndex()
      .filter((item) => words.every((w) => item.hay.includes(w)))
      .sort((a, b) => (a.el ? 1 : 0) - (b.el ? 1 : 0))
      .slice(0, 12);
    if (!found.length) {
      results.append(text('p', 'st__noresult', '找不到相關設定'));
      return;
    }
    found.forEach((item, i) => {
      const button = h('button', 'st__result');
      button.type = 'button';
      button.setAttribute('role', 'option');
      button.innerHTML = `${ICONS[item.page.icon]}<span class="st__result-text"><span></span><small></small></span>`;
      button.querySelector('span span').textContent = item.el ? item.label : item.page.title;
      button.querySelector('small').textContent = item.el ? item.page.title : item.page.lede;
      button.addEventListener('click', () => {
        go(item.page.id, { push: true });
        window.setTimeout(() => reveal(item.el), narrow ? 380 : 160);
      });
      results.append(button);
      if (!MotionSettings.reduced) {
        const m = motionFor(button, motions);
        m.set({ e: 0, y: 6 });
        m.to({ e: 1 }, { response: 0.26 + i * 0.02, damping: 1 });
        m.to({ y: 0 }, { response: 0.34 + i * 0.025, damping: 0.66 });
      }
    });
  }

  search.addEventListener('input', () => renderResults(search.value));
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const first = results.querySelector('.st__result');
      if (first) first.click();
    } else if (event.key === 'Escape') {
      search.value = '';
      renderResults('');
    } else if (event.key === 'ArrowDown') {
      const first = results.querySelector('.st__result');
      if (first) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  results.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const list = Array.from(results.querySelectorAll('.st__result'));
    const index = list.indexOf(document.activeElement);
    const next = index + (event.key === 'ArrowDown' ? 1 : -1);
    if (next < 0) search.focus();
    else if (list[next]) list[next].focus();
  });

  function measure() {
    const next = root.clientWidth > 0 && root.clientWidth < NARROW_REM * rem();
    if (next !== narrow) {
      narrow = next;
      root.classList.toggle('is-narrow', narrow);
      if (win) win.classList.toggle('is-narrow', narrow);
      push.set({ p: narrow ? 0 : 1 });
      if (!narrow) {
        side.inert = false;
        main.inert = false;
      }
    }
    if (!narrow) placePlatter(navButtons.get(current), true);
  }

  new ResizeObserver(measure).observe(root);
  go('appearance', { instant: true });

  return {
    measure,
    open(id) {
      go(id, { push: true });
    },
    intro() {
      measure();
      window.setTimeout(measure, 80);
      if (!opened) {
        opened = true;
        enterPage(current);
      }
      const page = byId.get(current);
      if (page && page.show) page.show();
      pages.forEach((p) => p.refreshGlass && p.refreshGlass());
    },
    refreshGlass() {
      pages.forEach((p) => p.refreshGlass && p.refreshGlass());
    },
    sync() {
      pages.forEach((p) => p.sync && p.sync());
    },
  };
}
