const TILE = '<rect class="i-base" width="64" height="64" rx="14.4"/>'
  + '<rect class="i-rim" x="0.75" y="0.75" width="62.5" height="62.5" rx="13.65" fill="none" stroke-width="1.5"/>'
  + '<rect class="i-edge" x="0.5" y="0.5" width="63" height="63" rx="13.9" fill="none"/>';

function calendarGlyph() {
  const day = new Date().getDate();
  return '<rect class="i-ink" x="14" y="14" width="36" height="37" rx="7"/>'
    + '<path class="i-acc" d="M21 14h22a7 7 0 0 1 7 7v3.5H14V21a7 7 0 0 1 7-7z"/>'
    + `<text class="i-tile i-num" x="32" y="44.6" text-anchor="middle">${day}</text>`;
}

const GLYPHS = {
  'daily-entry': () => '<rect class="i-ink" x="15" y="13" width="27" height="35" rx="5"/>'
    + '<rect class="i-tile" x="20.5" y="20.5" width="16" height="3" rx="1.5"/>'
    + '<rect class="i-tile" x="20.5" y="27.5" width="10" height="3" rx="1.5"/>'
    + '<rect class="i-tile" x="20.5" y="34.5" width="13" height="3" rx="1.5"/>'
    + '<circle class="i-acc s-tile" cx="42.5" cy="44" r="10" stroke-width="3.5"/>'
    + '<path class="s-on" d="M42.5 39.6v8.8M38.1 44h8.8" stroke-width="2.6" stroke-linecap="round" fill="none"/>',
  overview: () => '<rect class="i-ink" x="14" y="33" width="10" height="18" rx="3"/>'
    + '<rect class="i-ink" x="27" y="24" width="10" height="27" rx="3"/>'
    + '<rect class="i-acc" x="40" y="14" width="10" height="37" rx="3"/>',
  'life-reminder': () => '<path class="i-ink" d="M21 14h22a8 8 0 0 1 8 8v12a8 8 0 0 1-8 8H31.5l-8.5 7v-7h-2a8 8 0 0 1-8-8V22a8 8 0 0 1 8-8z"/>'
    + '<circle class="i-tile" cx="23.5" cy="28" r="2.8"/>'
    + '<circle class="i-tile" cx="32" cy="28" r="2.8"/>'
    + '<circle class="i-acc" cx="40.5" cy="28" r="2.8"/>',
  calendar: calendarGlyph,
  weather: () => '<circle class="i-acc" cx="39" cy="24" r="9.5"/>'
    + '<g class="i-tile"><circle cx="25" cy="38" r="11"/><circle cx="35" cy="34.5" r="12.5"/><circle cx="44.5" cy="40" r="10"/><rect x="14" y="35" width="41" height="16" rx="8"/></g>'
    + '<g class="i-ink"><circle cx="25" cy="38" r="8"/><circle cx="35" cy="34.5" r="9.5"/><circle cx="44.5" cy="40" r="7"/><rect x="17" y="38" width="35" height="10" rx="5"/></g>',
  calculator: () => '<rect class="i-ink" x="14" y="14" width="16" height="16" rx="4.5"/>'
    + '<rect class="i-ink" x="34" y="14" width="16" height="16" rx="4.5"/>'
    + '<rect class="i-ink" x="14" y="34" width="16" height="16" rx="4.5"/>'
    + '<rect class="i-acc" x="34" y="34" width="16" height="16" rx="4.5"/>'
    + '<path class="s-tile" d="M22 18.5v7M18.5 22h7M38.5 22h7M19.5 39.5l5 5M24.5 39.5l-5 5" stroke-width="2.4" stroke-linecap="round" fill="none"/>'
    + '<path class="s-on" d="M38.5 40h7M38.5 44h7" stroke-width="2.4" stroke-linecap="round" fill="none"/>',
  radio: () => '<circle class="i-ink" cx="32" cy="32" r="19.5"/>'
    + '<circle class="s-tile" cx="32" cy="32" r="14.5" fill="none" stroke-width="1.2" opacity="0.3"/>'
    + '<circle class="s-tile" cx="32" cy="32" r="10.5" fill="none" stroke-width="1.2" opacity="0.22"/>'
    + '<circle class="i-acc" cx="32" cy="32" r="6.5"/>'
    + '<circle class="i-tile" cx="32" cy="32" r="1.8"/>',
  settings: () => '<path class="s-ink" d="M15 21h34M15 32h34M15 43h34" stroke-width="3.5" stroke-linecap="round" fill="none"/>'
    + '<circle class="i-tile s-ink" cx="24.5" cy="21" r="5.2" stroke-width="3.5"/>'
    + '<circle class="i-acc s-tile" cx="40.5" cy="32" r="6.3" stroke-width="3"/>'
    + '<circle class="i-tile s-ink" cx="29" cy="43" r="5.2" stroke-width="3.5"/>',
};

export const APPS = [
  { id: 'daily-entry', title: '每日記帳' },
  { id: 'overview', title: '收支總覽' },
  { id: 'life-reminder', title: '生活提醒' },
  { id: 'calendar', title: '日曆' },
  { id: 'weather', title: '天氣' },
  { id: 'calculator', title: '計算機' },
  { id: 'radio', title: '電台' },
  { id: 'settings', title: '設定' },
];

export function renderIcon(id) {
  const glyph = GLYPHS[id];
  return `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">${TILE}${glyph ? glyph() : ''}</svg>`;
}
