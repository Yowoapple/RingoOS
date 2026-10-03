export const BASE_SCALE = 1.3;

export const APPS = [
  { id: 'daily-entry', title: '每日記帳', size: { w: 400, h: 640 }, min: { w: 320, h: 360 } },
  { id: 'overview', title: '收支總覽', size: { w: 420, h: 600 }, min: { w: 320, h: 320 } },
  { id: 'life-reminder', title: '生活提醒', size: { w: 380, h: 520 }, min: { w: 300, h: 280 } },
  { id: 'calendar', title: '日曆', size: { w: 540, h: 640 }, min: { w: 360, h: 420 } },
  { id: 'weather', title: '天氣', size: { w: 500, h: 640 }, min: { w: 340, h: 360 } },
  { id: 'calculator', title: '計算機', size: { w: 320, h: 580 }, min: { w: 280, h: 460 } },
  { id: 'radio', title: '電台', size: { w: 500, h: 640 }, min: { w: 340, h: 420 } },
  { id: 'companion', title: '夥伴', size: { w: 520, h: 600 }, min: { w: 340, h: 420 } },
  { id: 'settings', title: '設定', size: { w: 680, h: 580 }, min: { w: 360, h: 380 } },
];

export function scaledApps(scaleFactor) {
  const ratio = Math.max(0.75, scaleFactor / BASE_SCALE);
  const scale = (value) => Math.round(value * ratio);
  return APPS.map((app) => ({
    ...app,
    size: { w: scale(app.size.w), h: scale(app.size.h) },
    min: { w: scale(app.min.w), h: scale(app.min.h) },
  }));
}
