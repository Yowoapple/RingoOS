const TILE = '<rect class="i-tile" width="64" height="64" rx="14.4"/>'
  + '<rect class="i-sheen" width="64" height="64" rx="14.4" fill="url(#ico-sheen)"/>'
  + '<rect class="i-edge" x="0.5" y="0.5" width="63" height="63" rx="13.9" fill="none"/>';

const GLYPHS = {
  'daily-entry': '<rect class="i-ink" x="14" y="11" width="28" height="37" rx="5"/>'
    + '<rect class="i-tile" x="19.5" y="19" width="17" height="3" rx="1.5"/>'
    + '<rect class="i-tile" x="19.5" y="26" width="11" height="3" rx="1.5"/>'
    + '<rect class="i-tile" x="19.5" y="33" width="14" height="3" rx="1.5"/>'
    + '<circle class="i-acc s-tile" cx="43" cy="44" r="10.5" stroke-width="3.5"/>'
    + '<path class="s-on" d="M43 39.2v9.6M38.2 44h9.6" stroke-width="2.6" stroke-linecap="round" fill="none"/>',
  overview: '<rect class="i-ink" x="13" y="33" width="10" height="18" rx="3"/>'
    + '<rect class="i-ink" x="27" y="24" width="10" height="27" rx="3"/>'
    + '<rect class="i-acc" x="41" y="13" width="10" height="38" rx="3"/>',
  'life-reminder': '<path class="i-ink" d="M20 13h24a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8H31l-9 7.5V43h-2a8 8 0 0 1-8-8V21a8 8 0 0 1 8-8z"/>'
    + '<circle class="i-tile" cx="23" cy="28" r="3"/>'
    + '<circle class="i-tile" cx="32" cy="28" r="3"/>'
    + '<circle class="i-acc" cx="41" cy="28" r="3"/>',
  calendar: '<rect class="i-ink" x="12" y="13" width="40" height="39" rx="7"/>'
    + '<path class="i-acc" d="M19 13h26a7 7 0 0 1 7 7v4.5H12V20a7 7 0 0 1 7-7z"/>'
    + '<text class="i-tile i-num" x="32" y="45.5" text-anchor="middle">29</text>',
  weather: '<circle class="i-acc" cx="39" cy="23" r="10"/>'
    + '<g class="i-tile"><circle cx="25" cy="38" r="11"/><circle cx="35" cy="34" r="13"/><circle cx="45" cy="40" r="10"/><rect x="14" y="35" width="42" height="16" rx="8"/></g>'
    + '<g class="i-ink"><circle cx="25" cy="38" r="8"/><circle cx="35" cy="34" r="10"/><circle cx="45" cy="40" r="7"/><rect x="17" y="38" width="35" height="10" rx="5"/></g>',
  calculator: '<rect class="i-ink" x="14" y="14" width="16" height="16" rx="4.5"/>'
    + '<rect class="i-ink" x="34" y="14" width="16" height="16" rx="4.5"/>'
    + '<rect class="i-ink" x="14" y="34" width="16" height="16" rx="4.5"/>'
    + '<rect class="i-acc" x="34" y="34" width="16" height="16" rx="4.5"/>'
    + '<path class="s-tile" d="M22 18.5v7M18.5 22h7M38.5 22h7M19.5 39.5l5 5M24.5 39.5l-5 5" stroke-width="2.4" stroke-linecap="round" fill="none"/>'
    + '<path class="s-on" d="M38.5 40h7M38.5 44h7" stroke-width="2.4" stroke-linecap="round" fill="none"/>',
  radio: '<circle class="i-ink" cx="32" cy="32" r="20"/>'
    + '<circle class="s-tile" cx="32" cy="32" r="15" fill="none" stroke-width="1.2" opacity="0.3"/>'
    + '<circle class="s-tile" cx="32" cy="32" r="11" fill="none" stroke-width="1.2" opacity="0.22"/>'
    + '<circle class="i-acc" cx="32" cy="32" r="7"/>'
    + '<circle class="i-tile" cx="32" cy="32" r="1.8"/>',
  settings: '<path class="s-ink" d="M14 20h36M14 32h36M14 44h36" stroke-width="3.5" stroke-linecap="round" fill="none"/>'
    + '<circle class="i-tile s-ink" cx="24" cy="20" r="5.5" stroke-width="3.5"/>'
    + '<circle class="i-acc s-tile" cx="41" cy="32" r="6.5" stroke-width="3"/>'
    + '<circle class="i-tile s-ink" cx="29" cy="44" r="5.5" stroke-width="3.5"/>',
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
  return `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">${TILE}${GLYPHS[id] || ''}</svg>`;
}
