import { createMotion } from '../../../motion/animator.js';
import { MotionSettings } from '../../../motion/presets.js';
import { createTimeField } from '../../../ui/time-field.js';
import { button, clamp, group, h, row, swapText, toggle } from '../kit.js';

const KINDS = [
  { key: 'calendar', label: '代辦提醒', hint: '照代辦設定的「提前多久」提醒' },
  { key: 'summary', label: '每日代辦摘要', hint: '一早告訴你今天有幾件事' },
  { key: 'weather', label: '天氣', hint: '特報、三小時內可能下雨、極熱或偏冷' },
  { key: 'budget', label: '預算', hint: '用到 80%、用完、某分類超支、推估會超支' },
];

function collapsible(content, open) {
  const el = h('div', 'st-collapse');
  el.append(content);
  const motion = createMotion({ p: open ? 1 : 0 }, { response: 0.42, damping: 0.72, restDelta: 0.001 });
  motion.onUpdate(({ p }) => {
    const t = clamp(p, 0, 1.2);
    if (Math.abs(p - 1) < 0.001) {
      el.style.height = '';
      el.style.opacity = '';
      el.style.transform = '';
      return;
    }
    el.style.height = `${Math.max(0, t) * content.offsetHeight}px`;
    el.style.opacity = String(clamp(p * 1.4 - 0.2, 0, 1));
    el.style.transform = `translate3d(0, ${((1 - clamp(p, 0, 1)) * -6).toFixed(2)}px, 0)`;
  });
  motion.set({ p: open ? 1 : 0 });
  return {
    el,
    set(next) {
      el.inert = !next;
      if (MotionSettings.reduced) motion.set({ p: next ? 1 : 0 });
      else motion.to({ p: next ? 1 : 0 }, next ? { response: 0.46, damping: 0.66 } : { response: 0.34, damping: 0.9 });
    },
  };
}

function permissionText() {
  if (typeof Notification === 'undefined') return { state: 'unsupported', text: '這個瀏覽器不支援系統通知' };
  if (Notification.permission === 'denied') return { state: 'denied', text: '瀏覽器封鎖了通知：點網址列左邊的圖示，把「通知」改成允許' };
  if (Notification.permission === 'granted') return { state: 'granted', text: '分頁在背景時，代辦提醒與天氣特報會跳出系統通知' };
  return { state: 'default', text: '分頁在背景時也能收到代辦提醒與天氣特報' };
}

export function notifyPage(ctx) {
  const { notifier, island } = ctx;
  const el = h('div', 'st-page__body');
  let prefs = notifier.prefs;

  const master = toggle(prefs.enabled, (on) => notifier.setPrefs({ enabled: on }), '通知');
  const dnd = toggle(prefs.dnd.on, (on) => notifier.setPrefs({ dnd: { on } }), '勿擾');
  const schedule = toggle(prefs.dnd.schedule, (on) => notifier.setPrefs({ dnd: { schedule: on } }), '勿擾時段');
  const from = createTimeField({ value: prefs.dnd.from, label: '勿擾開始', onChange: (v) => notifier.setPrefs({ dnd: { from: v } }) });
  const to = createTimeField({ value: prefs.dnd.to, label: '勿擾結束', onChange: (v) => notifier.setPrefs({ dnd: { to: v } }) });
  const span = h('div', 'st-span');
  span.append(from.el, h('span', 'st-span__to', '到'), to.el);
  const spanBox = collapsible(row({ label: '時段', hint: '跨過午夜也可以，例如 23:00 到 07:00', control: span }).el, prefs.dnd.schedule);

  const kindToggles = KINDS.map((kind) => {
    const t = toggle(prefs.kinds[kind.key] !== false, (on) => notifier.setPrefs({ kinds: { [kind.key]: on } }), kind.label);
    return { kind, t, row: row({ label: kind.label, hint: kind.hint, control: t.el, keywords: '通知 提醒' }) };
  });
  const daily = toggle(!!prefs.kinds.daily, (on) => notifier.setPrefs({ kinds: { daily: on } }), '每日記帳提醒');
  const dailyTime = createTimeField({ value: prefs.dailyTime, label: '提醒時間', onChange: (v) => notifier.setPrefs({ dailyTime: v }) });
  const dailyBox = collapsible(row({ label: '提醒時間', hint: '過了這個時間還沒記帳才會提醒', control: dailyTime.el }).el, !!prefs.kinds.daily);

  const systemState = h('span', 'st-row__hint');
  const systemButton = button('允許', 'btn--secondary st-mini', async () => {
    const info = permissionText();
    if (info.state === 'granted') {
      notifier.setPrefs({ system: !notifier.prefs.system });
      return;
    }
    if (info.state !== 'default') return;
    await notifier.requestSystem();
    sync();
  });
  const systemRow = row({ label: '系統通知', control: systemButton, keywords: 'windows 桌面通知 權限 背景' });
  systemRow.hintEl.replaceWith(systemState);

  const test = button('送一則測試通知', 'btn--secondary', () => {
    notifier.notify({
      key: `test:${Date.now()}`,
      app: 'settings',
      kind: null,
      title: '這是一則測試通知',
      body: notifier.quiet ? '勿擾中，所以只收進通知中心，不會跳出來' : '真正的通知會從這裡出現，也會收進右上角的通知中心',
    });
  });
  const clear = button('清除通知紀錄', 'btn--ghost', () => {
    const count = notifier.history.length;
    notifier.clear();
    island.toast({ text: count ? '已清除通知紀錄' : '沒有通知紀錄', note: count ? `${count} 則` : '', duration: 2400 });
  });
  const actions = h('div', 'st-actions');
  actions.append(test, clear);

  const off = h('div', 'st-off');
  off.append(
    group([
      row({ label: '勿擾', hint: '通知照樣收進通知中心，只是不跳出來', control: dnd.el, keywords: 'dnd 安靜 免打擾' }),
      row({ label: '勿擾時段', hint: '每天固定時間自動進入勿擾', control: schedule.el, keywords: 'dnd 睡覺 晚上' }),
      spanBox,
    ]),
    group([
      ...kindToggles.map((item) => item.row),
      row({ label: '每日記帳提醒', hint: '當天還沒記帳時提醒一下，預設關閉', control: daily.el, keywords: '記帳 忘記' }),
      dailyBox,
    ]),
    group([systemRow, actions]),
  );
  const offBox = collapsible(off, prefs.enabled);

  el.append(
    group([row({ label: '通知', hint: '關閉後不會產生任何通知', control: master.el, keywords: '全部 總開關' })]),
    offBox.el,
  );

  function sync() {
    prefs = notifier.prefs;
    master.api.set(prefs.enabled);
    offBox.set(prefs.enabled);
    dnd.api.set(prefs.dnd.on);
    schedule.api.set(prefs.dnd.schedule);
    spanBox.set(prefs.dnd.schedule);
    if (document.activeElement && !span.contains(document.activeElement)) {
      from.set(prefs.dnd.from);
      to.set(prefs.dnd.to);
    }
    kindToggles.forEach(({ kind, t }) => t.api.set(prefs.kinds[kind.key] !== false));
    daily.api.set(!!prefs.kinds.daily);
    dailyBox.set(!!prefs.kinds.daily);
    const info = permissionText();
    swapText(systemState, info.state === 'granted' && !prefs.system ? '已允許，但目前關閉' : info.text);
    systemButton.hidden = info.state === 'denied' || info.state === 'unsupported';
    systemButton.textContent = info.state === 'granted' ? (prefs.system ? '關閉' : '開啟') : '允許';
  }

  notifier.subscribe(({ type }) => {
    if (type === 'prefs' || type === 'sync') sync();
  });
  sync();

  return {
    id: 'notify',
    title: '通知',
    lede: '什麼時候提醒你、要不要打擾你',
    icon: 'notify',
    el,
    show: sync,
  };
}
