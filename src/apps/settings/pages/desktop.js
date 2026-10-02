import { group, h, row, select, slider, toggle } from '../kit.js';

const WIDGETS = [
  { key: 'island', label: '記一筆', hint: '選單列中間的靈動島，隨時快速記帳' },
  { key: 'weather', label: '天氣', hint: '目前地點的天氣與溫度' },
  { key: 'radio', label: '正在播放', hint: '電台或 YouTube 播放時才會出現' },
  { key: 'bell', label: '通知鈴鐺', hint: '未讀通知數與通知中心' },
  { key: 'clock', label: '日期與時間' },
];

export function desktopPage(ctx) {
  const { desktopPrefs, dock } = ctx;
  const prefs = desktopPrefs.get();
  const el = h('div', 'st-page__body');

  const mode = select({
    options: [{ value: 'launcher', label: '常駐所有 App' }, { value: 'minimized', label: '只放縮小的視窗' }],
    value: prefs.dockMode,
    menuHost: ctx.menuHost,
    label: 'Dock 內容',
    onChange: (v) => desktopPrefs.set({ dockMode: v }),
  });
  const hide = toggle(prefs.dockAutoHide, (on) => desktopPrefs.set({ dockAutoHide: on }), '自動隱藏 Dock');
  const magnify = slider({
    min: 1,
    max: 2,
    step: 0.05,
    value: dock.magnify,
    format: (v) => `${v.toFixed(2)}×`,
    onInput: (v) => desktopPrefs.setMagnify(v),
    label: 'Dock 放大程度',
  });

  const widgetToggles = WIDGETS.map((widget) => {
    const t = toggle(prefs.widgets[widget.key] !== false, (on) => desktopPrefs.set({ widgets: { [widget.key]: on } }), widget.label);
    return { widget, t, row: row({ label: widget.label, hint: widget.hint || '', control: t.el, keywords: '選單列 小工具 menubar' }) };
  });

  el.append(
    group([
      row({ label: 'Dock 內容', hint: '只放縮小的視窗時，Dock 平常會很乾淨', control: mode.el, keywords: 'dock 圖示 常駐' }),
      row({ label: '自動隱藏', hint: '滑鼠移到畫面最下方時才滑出來', control: hide.el, keywords: 'dock 隱藏 autohide' }),
      row({ label: 'Dock 放大程度', control: magnify.el, stack: true, keywords: 'dock 放大 magnify' }),
    ], { title: 'Dock' }),
    group(widgetToggles.map((item) => item.row), { title: '選單列' }),
  );

  return {
    id: 'desktop',
    title: '桌面',
    lede: 'Dock 與選單列',
    icon: 'desktop',
    el,
    sync() {
      const next = desktopPrefs.get();
      mode.api.set(next.dockMode);
      hide.api.set(next.dockAutoHide);
      widgetToggles.forEach(({ widget, t }) => t.api.set(next.widgets[widget.key] !== false));
      magnify.api.set(dock.magnify);
    },
  };
}
