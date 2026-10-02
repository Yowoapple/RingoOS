import { Storage } from '../../../core/storage/storage.js';
import { AUTH_KEY, CACHE_KEY, LOCATION_KEY, getAuthKey, getLocation } from '../../weather/provider.js';
import { button, group, h, row, swapText } from '../kit.js';

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

  el.append(
    group([placeRow, cwaRow]),
    group([row({ label: '天氣快取', hint: '天氣每 30 分鐘更新一次；資料怪怪的時候可以清掉重抓', control: cacheButton, keywords: '更新 重新整理 快取' })]),
  );

  function sync() {
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
    lede: '地點與資料來源',
    icon: 'weather',
    el,
    show: sync,
    sync,
  };
}
