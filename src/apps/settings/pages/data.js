import { createMotion } from '../../../motion/animator.js';
import { MotionSettings } from '../../../motion/presets.js';
import { Storage } from '../../../core/storage/storage.js';
import { Data } from '../../../core/data-model.js';
import { isLedgerShape } from '../../../core/migrations.js';
import { button, clamp, group, h, row, swapText, text, toggle } from '../kit.js';

const VERSION = '26.0.0';
const HOLD_MS = 1500;
const PARTS = [
  { id: 'ledger', label: '帳本與代辦', test: (key) => key === 'yoworingo.ledger' },
  { id: 'wall', label: '桌布', test: (key) => key === 'yoworingo.v2.wallpaper' || key.startsWith('yoworingo.wallpaper') },
  { id: 'radio', label: '電台與清單', test: (key) => key.includes('radio') || key.includes('yt-') },
  { id: 'other', label: '其他設定', test: () => true },
];

function sizeOf(value) {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'string') return value.length * 2;
  try {
    return JSON.stringify(value).length * 2;
  } catch (err) {
    return 0;
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function stamp() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function summarize(doc) {
  let days = 0;
  let entries = 0;
  let tasks = 0;
  Object.values(doc.days || {}).forEach((day) => {
    const income = Array.isArray(day.income) ? day.income.length : 0;
    const expenses = Array.isArray(day.expenses) ? day.expenses.length : 0;
    const dayTasks = Array.isArray(day.tasks) ? day.tasks.length : 0;
    if (income + expenses + dayTasks > 0) days += 1;
    entries += income + expenses;
    tasks += dayTasks;
  });
  const goals = Array.isArray(doc.settings && doc.settings.savingsGoals) ? doc.settings.savingsGoals.length : 0;
  return { days, entries, tasks, goals };
}

function holdButton(label, onDone) {
  const el = h('button', 'st-hold');
  el.type = 'button';
  el.innerHTML = '<svg class="st-hold__ring" viewBox="0 0 24 24" aria-hidden="true"><circle class="st-hold__track" cx="12" cy="12" r="9.5"/><circle class="st-hold__fill" cx="12" cy="12" r="9.5" pathLength="1" transform="rotate(-90 12 12)"/></svg><span class="st-hold__label"></span>';
  el.querySelector('.st-hold__label').textContent = label;
  el.setAttribute('aria-label', `${label}，按住 1.5 秒`);
  const fill = el.querySelector('.st-hold__fill');
  const back = createMotion({ p: 0, s: 1 }, { response: 0.4, damping: 0.7, restDelta: { p: 0.001, s: 0.0005 } });
  let raf = 0;
  let started = 0;
  let holding = false;
  back.onUpdate(({ p, s }) => {
    fill.style.strokeDashoffset = String(1 - clamp(p, 0, 1));
    el.style.transform = Math.abs(s - 1) < 0.0005 ? '' : `scale(${s.toFixed(4)})`;
  });
  function tick() {
    if (!holding) return;
    const p = Math.min(1, (performance.now() - started) / HOLD_MS);
    back.set({ p, s: 1 - 0.05 * p });
    if (p >= 1) {
      holding = false;
      back.to({ s: 1 }, { response: 0.4, damping: 0.4, velocity: { s: 1.2 } });
      onDone();
      return;
    }
    raf = requestAnimationFrame(tick);
  }
  function start(event) {
    if (event.button !== undefined && event.button !== 0) return;
    holding = true;
    started = performance.now() - back.get('p') * HOLD_MS;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    if (!holding) return;
    holding = false;
    cancelAnimationFrame(raf);
    back.to({ p: 0, s: 1 }, MotionSettings.reduced ? { response: 0.2, damping: 1 } : { response: 0.42, damping: 0.6 });
  }
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointerleave', stop);
  el.addEventListener('pointercancel', stop);
  el.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
      event.preventDefault();
      start(event);
    }
  });
  el.addEventListener('keyup', (event) => {
    if (event.key === 'Enter' || event.key === ' ') stop();
  });
  return el;
}

export function dataPage(ctx) {
  const { island, dialogs, frame, appearance } = ctx;
  let withWall = false;
  const el = h('div', 'st-page__body');

  const usage = h('div', 'st-usage');
  usage.innerHTML = '<span class="st-hero__label">這台電腦上的 RingoOS</span><span class="st-usage__num mono"></span><span class="st-usage__bar"></span><span class="st-usage__legend"></span><span class="st-usage__quota"></span>';
  const usageNum = usage.querySelector('.st-usage__num');
  const usageBar = usage.querySelector('.st-usage__bar');
  const legend = usage.querySelector('.st-usage__legend');
  const quota = usage.querySelector('.st-usage__quota');
  const segments = PARTS.map((part, i) => {
    const seg = h('i', `st-usage__seg st-usage__seg--${i}`);
    usageBar.append(seg);
    const key = h('span', 'st-usage__key');
    key.innerHTML = `<i class="st-usage__dot st-usage__seg--${i}"></i><span></span><b class="mono"></b>`;
    key.querySelector('span').textContent = part.label;
    legend.append(key);
    const motion = createMotion({ w: 0 }, { response: 0.7, damping: 0.62, restDelta: 0.0005 });
    motion.onUpdate(({ w }) => {
      seg.style.flexGrow = String(Math.max(0, w));
    });
    return { part, seg, key, motion };
  });

  function measureUsage() {
    const sizes = Object.fromEntries(PARTS.map((part) => [part.id, 0]));
    Storage.keys().forEach((key) => {
      const part = PARTS.find((p) => p.test(key));
      sizes[part.id] += sizeOf(Storage.get(key));
    });
    const totalBytes = Object.values(sizes).reduce((a, b) => a + b, 0);
    usageNum.textContent = formatBytes(totalBytes);
    segments.forEach(({ part, key, motion }) => {
      key.querySelector('b').textContent = formatBytes(sizes[part.id]);
      const share = totalBytes ? sizes[part.id] / totalBytes : 0;
      if (MotionSettings.reduced) motion.set({ w: share });
      else motion.to({ w: share }, { response: 0.7, damping: 0.62 });
    });
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(({ quota: q }) => {
        if (q) quota.textContent = `瀏覽器給的空間約 ${formatBytes(q)}`;
      }).catch(() => {});
    }
    const persisted = navigator.storage && navigator.storage.persisted;
    if (persisted) navigator.storage.persisted().then((ok) => {
      if (ok) quota.textContent = `${quota.textContent ? `${quota.textContent} · ` : ''}已設為不會被瀏覽器自動清掉`;
    }).catch(() => {});
  }

  const exportButton = button('匯出 JSON', 'btn--primary st-mini', () => {
    const payload = { ...Data.getState(), ringoos: { version: VERSION, exportedAt: new Date().toISOString() } };
    const photo = withWall && appearance ? appearance.photoData : null;
    if (photo) payload.wallpaper = { dataUrl: photo };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ringoos-backup-${stamp()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    island.toast({ text: photo ? '已匯出備份與桌布' : '已匯出備份', duration: 2400 });
  });

  const wallToggle = toggle(false, (on) => { withWall = on; }, '匯出時包含桌布');
  const wallRow = row({ label: '包含桌布', hint: '換電腦時想一起帶走再打開', control: wallToggle.el, keywords: '桌布 照片 wallpaper 匯出' });

  function syncWallRow() {
    const has = !!(appearance && appearance.hasPhoto);
    wallRow.el.hidden = !has;
    if (has) wallRow.hintEl.textContent = `檔案會多約 ${formatBytes(appearance.photoData.length)}；換電腦時想一起帶走再打開`;
    if (!has && withWall) {
      withWall = false;
      wallToggle.api.set(false);
    }
  }

  const fileInput = h('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json,.json';
  fileInput.hidden = true;
  const drop = h('button', 'st-drop');
  drop.type = 'button';
  drop.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4.5M7.5 9L12 4.5 16.5 9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 14.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg><span class="st-drop__title">匯入備份</span><span class="st-drop__hint">把 JSON 檔拖進來，或點這裡選檔；1.0 的檔案也可以</span>';
  drop.addEventListener('click', () => fileInput.click());
  drop.addEventListener('dragover', (event) => {
    event.preventDefault();
    drop.classList.add('is-over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (event) => {
    event.preventDefault();
    drop.classList.remove('is-over');
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) importFile(file);
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (file) importFile(file);
  });

  async function importFile(file) {
    let doc;
    try {
      doc = JSON.parse(await file.text());
    } catch (err) {
      island.toast({ text: '這個檔案不是有效的 JSON', duration: 3200 });
      return;
    }
    if (!doc || typeof doc !== 'object' || !isLedgerShape(doc)) {
      island.toast({ text: '這不是 RingoOS 的備份檔', duration: 3200 });
      return;
    }
    const incoming = summarize(doc);
    const current = summarize(Data.getState());
    const when = doc.ringoos && doc.ringoos.exportedAt ? new Date(doc.ringoos.exportedAt).toLocaleString('zh-TW', { hour12: false }) : '';
    const preview = h('div', 'st-compare');
    preview.innerHTML = '<div class="st-compare__col"><span class="st-compare__head">檔案</span></div><div class="st-compare__col st-compare__col--now"><span class="st-compare__head">現在</span></div>';
    const [fileCol, nowCol] = preview.querySelectorAll('.st-compare__col');
    [['days', '天有紀錄'], ['entries', '筆收支'], ['tasks', '件代辦'], ['goals', '個存錢目標']].forEach(([key, unit]) => {
      const a = h('p', 'st-compare__line');
      a.innerHTML = `<b class="mono">${incoming[key]}</b> ${unit}`;
      fileCol.append(a);
      const b = h('p', 'st-compare__line');
      b.innerHTML = `<b class="mono">${current[key]}</b> ${unit}`;
      nowCol.append(b);
    });
    const wallIn = doc.wallpaper && typeof doc.wallpaper.dataUrl === 'string' && doc.wallpaper.dataUrl.startsWith('data:image/') ? doc.wallpaper.dataUrl : null;
    if (wallIn && appearance) {
      const a = h('p', 'st-compare__line');
      a.textContent = '含桌布';
      fileCol.append(a);
      const b = h('p', 'st-compare__line');
      b.textContent = appearance.hasPhoto ? '有桌布' : '沒有桌布';
      nowCol.append(b);
    }
    const ok = await dialogs.present({
      source: drop,
      frame: frame(),
      title: '用這個檔案取代目前的帳本？',
      text: when ? `備份時間 ${when}。取代後可以馬上復原。` : '取代後可以馬上復原。',
      content: preview,
      width: 22,
      actions: [{ label: '取消', className: 'btn--secondary', value: false, focus: true }, { label: '取代', className: 'btn--danger-fill', value: true }],
    });
    if (!ok) return;
    const backup = JSON.parse(JSON.stringify(Data.getState()));
    const wallBefore = appearance ? appearance.photoData : null;
    const wallState = appearance ? appearance.state.wall : null;
    try {
      const clean = { ...doc };
      delete clean.ringoos;
      delete clean.wallpaper;
      Data.replaceStore(clean);
    } catch (err) {
      island.toast({ text: err.message || '匯入失敗', duration: 4200 });
      return;
    }
    const wallApplied = !!(wallIn && appearance && appearance.setPhotoData(wallIn));
    measureUsage();
    syncWallRow();
    island.toast({
      text: wallApplied ? '已匯入備份與桌布' : '已匯入備份',
      action: '復原',
      duration: 6000,
      onAction: () => {
        Data.replaceStore(backup);
        if (wallApplied) {
          if (wallBefore) {
            appearance.setPhotoData(wallBefore);
            if (wallState !== 'photo') appearance.set('wall', wallState);
          } else {
            appearance.clearPhoto();
          }
        }
        measureUsage();
        syncWallRow();
      },
    });
  }

  const wipe = holdButton('清除所有資料', () => {
    Storage.keys().filter((key) => key.startsWith('yoworingo.')).forEach((key) => Storage.remove(key));
    Promise.resolve(Storage.flush()).then(() => {
      island.toast({ text: '已清除，重新開始', duration: 1600 });
      window.setTimeout(() => window.location.reload(), 900);
    });
  });

  const transfer = h('div', 'st-inline');
  transfer.append(exportButton);

  el.append(
    group([usage], { className: 'st-group--pad' }),
    group([
      row({ label: '備份', hint: '帳本、代辦、預算、分類與存錢目標；不含氣象署授權碼', control: transfer, keywords: '匯出 export 下載 backup json' }),
      wallRow,
      drop,
      fileInput,
    ], { className: 'st-group--pad' }),
    group([
      row({ label: '清除所有資料', hint: '帳本、設定、桌布、電台全部刪除，回到第一次打開的樣子；沒辦法復原，先匯出備份', control: wipe, stack: true, keywords: '刪除 重設 reset 全部' }),
    ], { className: 'st-group--danger' }),
  );

  Data.subscribe(() => {
    if (el.isConnected) measureUsage();
  });
  if (appearance) appearance.subscribe(syncWallRow);
  syncWallRow();

  return {
    id: 'data',
    title: '資料',
    lede: '備份、匯入與這台電腦上的空間',
    icon: 'data',
    el,
    show: () => {
      syncWallRow();
      measureUsage();
    },
  };
}
