import { Data } from '../core/data-model.js';
import { Storage } from '../core/storage/storage.js';
import { setLocation } from '../apps/weather/provider.js';
import { setFxPreview } from '../apps/weather/fx/prefs.js';
import { Sound } from '../audio/sound.js';

const CURSOR = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 2.5v17.2l4.6-4.3 2.9 6.6 2.9-1.3-2.9-6.5h6.3z" fill="#fff" stroke="#0e0e10" stroke-width="1.4" stroke-linejoin="round"/></svg>';
const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const nextFrame = () => new Promise((resolve) => {
  requestAnimationFrame(resolve);
  window.setTimeout(resolve, 34);
});
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function ancestors(el) {
  const out = [];
  for (let n = el; n; n = n.parentElement) out.push(n);
  return out;
}

export function mountDemo(ctx) {
  const cursor = document.createElement('div');
  cursor.className = 'demo-cursor';
  cursor.innerHTML = CURSOR;
  cursor.hidden = true;
  Object.assign(cursor.style, { position: 'fixed', left: '0', top: '0', zIndex: '100000', pointerEvents: 'none', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))', transition: 'scale 120ms ease' });
  document.body.append(cursor);
  const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  let hovered = [];
  let buttons = 0;

  function place() {
    cursor.style.transform = `translate3d(${pos.x - 3}px, ${pos.y - 2}px, 0)`;
  }

  function fire(type, el, extra = {}) {
    if (!el) return;
    const Ctor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
    const bubbles = type !== 'pointerenter' && type !== 'pointerleave';
    el.dispatchEvent(new Ctor(type, { bubbles, cancelable: true, composed: true, clientX: pos.x, clientY: pos.y, pointerId: 7, pointerType: 'mouse', isPrimary: true, button: 0, buttons, view: window, ...extra }));
  }

  function target() {
    cursor.hidden = true;
    const el = document.elementFromPoint(pos.x, pos.y);
    cursor.hidden = false;
    return el;
  }

  function hover() {
    const el = target();
    const chain = el ? ancestors(el) : [];
    hovered.filter((n) => !chain.includes(n)).forEach((n) => fire('pointerleave', n));
    chain.filter((n) => !hovered.includes(n)).reverse().forEach((n) => fire('pointerenter', n));
    hovered = chain;
    fire('pointermove', el);
    return el;
  }

  async function move(x, y, ms = 600) {
    const from = { ...pos };
    const start = performance.now();
    for (;;) {
      const t = Math.min(1, (performance.now() - start) / ms);
      const k = ease(t);
      pos.x = from.x + (x - from.x) * k;
      pos.y = from.y + (y - from.y) * k;
      place();
      hover();
      if (t >= 1) break;
      await nextFrame();
    }
  }

  async function click(x, y, { ms = 500, hold = 90 } = {}) {
    if (x !== undefined) await move(x, y, ms);
    const el = target();
    buttons = 1;
    fire('pointerdown', el);
    fire('mousedown', el);
    cursor.classList.add('is-down');
    await wait(hold);
    buttons = 0;
    fire('pointerup', el);
    fire('mouseup', el);
    fire('click', el);
    cursor.classList.remove('is-down');
    return el;
  }

  async function drag(x, y, ms = 900) {
    const el = target();
    buttons = 1;
    fire('pointerdown', el);
    cursor.classList.add('is-down');
    await wait(60);
    const from = { ...pos };
    const start = performance.now();
    for (;;) {
      const t = Math.min(1, (performance.now() - start) / ms);
      const k = ease(t);
      pos.x = from.x + (x - from.x) * k;
      pos.y = from.y + (y - from.y) * k;
      place();
      fire('pointermove', el);
      if (t >= 1) break;
      await nextFrame();
    }
    await wait(60);
    buttons = 0;
    fire('pointerup', el);
    cursor.classList.remove('is-down');
  }

  async function type(input, text, gap = 90) {
    input.focus();
    for (const ch of text) {
      input.value += ch;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(gap);
    }
  }

  function center(el) {
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }

  function dockItem(id) {
    return document.querySelector(`.dock__item[data-app-id="${id}"]`);
  }

  function seed() {
    const today = new Date();
    const key = (d) => Data.toDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - d));
    const meals = [['餐飲', '午餐 便當', 120], ['餐飲', '咖啡', 85], ['餐飲', '晚餐 拉麵', 260], ['交通', '捷運', 35], ['娛樂', '電影', 320], ['餐飲', '早餐', 65], ['交通', 'Uber', 210], ['日用', '衛生紙', 189]];
    for (let d = 26; d >= 0; d -= 1) {
      const k = key(d);
      const n = 1 + ((d * 7) % 3);
      for (let i = 0; i < n; i += 1) {
        const [category, note, amount] = meals[(d * 3 + i) % meals.length];
        Data.addExpenseEntry(k, { amount: amount + ((d * 13 + i * 7) % 40), category, note, necessity: i % 2 ? 'want' : 'need' });
      }
    }
    Data.addIncomeEntry(key(Math.min(today.getDate() - 1, 26)), { amount: 52000, category: '薪資', note: '十月薪水' });
    const month = Data.toMonthKey(key(0));
    Data.setBudgetTemplate('餐飲', 6500, month);
    Data.setBudgetTemplate('交通', 1800, month);
    Data.setBudgetTemplate('娛樂', 2000, month);
    const goal = Data.addSavingsGoal({ title: '日本旅行', targetAmount: 40000 });
    Data.depositToGoal(goal, 12000, { dateKey: key(12) });
    Data.addTask(key(0), '繳電話費', '18:00');
    Data.addTask(key(-1), '牙醫回診', '10:30');
    setLocation({ name: '臺北市', region: '臺灣', country: '臺灣', countryCode: 'TW', lat: 25.0375, lon: 121.5637, county: '臺北市' });
    Sound.set({ asked: true, enabled: false });
    Storage.set('yoworingo.v2.pet-life', { name: 'SAYA', fullness: 72, mood: 80, bond: 96, treats: 3, lastTick: Date.now(), seen: ['nod_head_yes.webp', 'cake.webp', 'pat_head.webp', 'cheer_up.webp', 'laughing.webp', 'rose.webp', 'arrive_with_spoon.webp', 'craving.webp', 'dazed.webp', 'pointing.webp', 'popcat_frame.webp', 'notification_donation.webp', 'shake_head_no.webp', 'dizzy.webp', 'trashtuber_idle.webp', 'driving.webp'], achInit: true });
    return 'seeded';
  }

  let stream = null;
  let grabber = null;

  function armRecorder() {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '開始錄製（按一下，然後選「這個分頁」）';
    Object.assign(button.style, { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: '100001', padding: '18px 28px', borderRadius: '999px', border: '0', background: '#C8F03C', color: '#0e0e10', font: '700 20px system-ui', cursor: 'pointer', boxShadow: '0 10px 40px rgba(0,0,0,0.4)' });
    document.body.append(button);
    return new Promise((resolve, reject) => {
      button.addEventListener('click', async () => {
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude' });
          grabber = new ImageCapture(stream.getVideoTracks()[0]);
          button.remove();
          resolve('recording ready');
        } catch (err) {
          button.textContent = `沒有開始：${err.message}（再按一次）`;
          reject(err);
        }
      });
    });
  }

  async function capture(clip, run, { width = 1280, fps = 25 } = {}) {
    if (!grabber) throw new Error('press the record button first');
    let active = true;
    let index = 0;
    const canvas = document.createElement('canvas');
    const g = canvas.getContext('2d');
    const t0 = performance.now();
    const loop = (async () => {
      while (active) {
        const started = performance.now();
        try {
          const frame = await grabber.grabFrame();
          canvas.width = width;
          canvas.height = Math.round((frame.height / frame.width) * width);
          g.drawImage(frame, 0, 0, canvas.width, canvas.height);
          frame.close();
          const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
          fetch(`/frame?clip=${clip}&i=${index}&t=${started - t0}`, { method: 'POST', body: blob });
          index += 1;
        } catch (err) {
          await wait(10);
        }
        const spare = 1000 / fps - (performance.now() - started);
        if (spare > 0) await wait(spare);
      }
    })();
    try {
      await run();
    } finally {
      active = false;
      await loop;
    }
    return `${clip}: ${index} frames`;
  }

  const api = {
    seed,
    armRecorder,
    get ready() { return !!grabber; },
    capture,
    move,
    click,
    drag,
    type,
    center,
    dockItem,
    wait,
    showCursor(on = true) {
      cursor.hidden = !on;
      place();
    },
    setPreview: setFxPreview,
    stop() {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null;
      grabber = null;
    },
  };
  window.__demo = api;
  return api;
}
