import { Storage } from '../../../core/storage/storage.js';
import { AUTH_KEY, CACHE_KEY, LOCATION_KEY, getAuthKey, getLocation } from '../../weather/provider.js';
import { MotionSettings } from '../../../motion/presets.js';
import { getFxPreview, onFxPrefs, onFxPreview, readFxPrefs, setFxPrefs, setFxPreview } from '../../weather/fx/prefs.js';
import { PREVIEWS } from '../../weather/fx/plan.js';
import { button, group, h, row, segmented, swapText, toggle } from '../kit.js';

const FX_LEVELS = ['soft', 'normal', 'rich'];

export function weatherPage(ctx) {
  const { weather, island, frame } = ctx;
  const el = h('div', 'st-page__body');

  const placeButton = button('換地點', 'btn--secondary st-mini', () => weather.openPlacePicker({ source: placeButton, frame: frame() }));
  const placeRow = row({ label: '地點', control: placeButton, keywords: '城市 位置 縣市 天氣' });
  const cwaButton = button('連接', 'btn--secondary st-mini', () => weather.openCwa({ source: cwaButton, frame: frame() }));
  const cwaRow = row({ label: '臺灣氣象署', control: cwaButton, keywords: '授權碼 cwa 特報 中央氣象署 api key' });
  const cacheButton = button('重新抓取', 'btn--ghost st-mini', () => {
    Storage.remove(CACHE_KEY);
    weather.refresh({ force: true });
    island.toast({ text: '已清除天氣快取，重新抓取中', duration: 2200 });
  });

  const fx = readFxPrefs();
  const fxOn = toggle(fx.enabled, (on) => setFxPrefs({ enabled: on }), '天氣特效');
  const fxLevel = segmented(['輕微', '標準', '豐富'], FX_LEVELS.indexOf(fx.level), (i) => setFxPrefs({ level: FX_LEVELS[i] }), { label: '特效強度' });
  const fxFlash = toggle(fx.lightning, (on) => setFxPrefs({ lightning: on }), '閃電閃光');
  const fxRow = row({ label: '顯示特效', hint: '', control: fxOn.el, keywords: '特效 動畫 下雨 下雪 太陽 粒子 weather effect 關閉' });
  const levelRow = row({ label: '強度', hint: '雨滴和雪花的數量、光線的亮度', control: fxLevel.el, keywords: '特效 強度 粒子 數量' });
  const flashRow = row({ label: '閃電閃光', hint: '雷雨時畫面會閃白一下；對閃光敏感可以關掉，雨照下', control: fxFlash.el, keywords: '閃電 閃光 雷雨 光敏感 刺眼' });

  const chips = h('div', 'st-chips', '');
  chips.setAttribute('role', 'radiogroup');
  chips.setAttribute('aria-label', '預覽天氣特效');
  [{ id: null, label: '真實天氣' }, ...PREVIEWS].forEach((p) => {
    const chip = h('button', 'chip chip--sm');
    chip.type = 'button';
    chip.setAttribute('role', 'radio');
    chip.dataset.preview = p.id || '';
    chip.textContent = p.label;
    chip.addEventListener('click', () => {
      setFxPreview(p.id);
      if (p.id && ctx.ensureWeather) ctx.ensureWeather();
    });
    chips.append(chip);
  });
  const previewRow = row({ label: '預覽', hint: '先看看每種天氣的樣子；離開這頁就回到真實天氣', control: chips, stack: true, keywords: '預覽 試看 下雨 下雪 雷雨 晴天 炎熱 晴夜 多雲 霧' });
  function syncPreview(id = getFxPreview()) {
    chips.querySelectorAll('.chip').forEach((chip) => chip.setAttribute('aria-checked', String((chip.dataset.preview || null) === id)));
  }
  onFxPreview(syncPreview);
  syncPreview();

  function syncFx(prefs = readFxPrefs()) {
    fxOn.api.set(prefs.enabled);
    fxLevel.api.select(FX_LEVELS.indexOf(prefs.level));
    fxFlash.api.set(prefs.lightning);
    levelRow.el.classList.toggle('is-off', !prefs.enabled);
    flashRow.el.classList.toggle('is-off', !prefs.enabled);
    previewRow.el.classList.toggle('is-off', !prefs.enabled);
    swapText(fxRow.hintEl, MotionSettings.reduced ? '「減少動態」開著，天氣特效會先暫停' : '只在天氣視窗裡出現；視窗縮小或在背景時自動停止');
  }
  onFxPrefs(syncFx);
  MotionSettings.subscribe(() => syncFx());

  el.append(
    group([fxRow, levelRow, flashRow, previewRow], { title: '天氣特效' }),
    group([placeRow, cwaRow]),
    group([row({ label: '天氣快取', hint: '天氣每 30 分鐘更新一次；資料怪怪的時候可以清掉重抓', control: cacheButton, keywords: '更新 重新整理 快取' })]),
  );

  function sync() {
    syncFx();
    const location = getLocation();
    swapText(placeRow.hintEl, location ? [location.name, location.region || location.county, location.country].filter(Boolean).join(' · ') : '還沒選地點，選了之後選單列也會顯示天氣');
    placeButton.textContent = location ? '換地點' : '選地點';
    const tw = location && location.countryCode === 'TW';
    const key = getAuthKey();
    cwaButton.textContent = key ? '已連接' : '連接';
    cwaButton.classList.toggle('is-on', !!key);
    swapText(cwaRow.hintEl, tw
      ? (key ? '使用氣象署鄉鎮預報、測站實測溫度與特報' : '貼上自己的授權碼，就能用氣象署預報、實測溫度與特報')
      : '地點在臺灣時才會用到；授權碼只存在這台電腦');
  }

  Storage.subscribe(({ keys }) => {
    if (keys.includes(LOCATION_KEY) || keys.includes(AUTH_KEY)) sync();
  });

  return {
    id: 'weather',
    title: '天氣',
    lede: '特效、地點與資料來源',
    icon: 'weather',
    el,
    show() {
      sync();
      fxLevel.api.measure();
    },
    sync,
    hide() {
      setFxPreview(null);
    },
    refreshGlass() {
      fxLevel.api.refreshGlass();
    },
  };
}
