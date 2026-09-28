const ICON_DEFS = {
  'daily-entry': {
    gradient: ['#6d9dff', '#3d7bfa'],
    glyph: '<path d="M6 4h9l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M14 4v4h4"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="15.5" x2="13" y2="15.5"/>',
  },
  'life-reminder': {
    gradient: ['#ffb15c', '#f0913f'],
    glyph: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-7z"/>',
  },
  overview: {
    gradient: ['#3fce8f', '#1f9d63'],
    glyph: '<line x1="6" y1="20" x2="6" y2="12"/><line x1="12" y1="20" x2="12" y2="7"/><line x1="18" y1="20" x2="18" y2="14"/>',
  },
  weather: {
    gradient: ['#5ec8f0', '#2f9fd9'],
    glyph: '<path d="M17.5 18a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6-1.6A4.5 4.5 0 0 0 7.5 18h10z"/>',
  },
  calculator: {
    gradient: ['#9a8dfb', '#6f5cf0'],
    glyph: '<rect x="6" y="3.5" width="12" height="17" rx="2"/><line x1="8.5" y1="7" x2="15.5" y2="7"/><line x1="8.5" y1="11" x2="8.5" y2="11"/><line x1="12" y1="11" x2="12" y2="11"/><line x1="15.5" y1="11" x2="15.5" y2="11"/><line x1="8.5" y1="14.2" x2="8.5" y2="14.2"/><line x1="12" y1="14.2" x2="12" y2="14.2"/><line x1="15.5" y1="14.2" x2="15.5" y2="14.2"/><line x1="8.5" y1="17.4" x2="8.5" y2="17.4"/><line x1="12" y1="17.4" x2="12" y2="17.4"/><line x1="15.5" y1="17.4" x2="15.5" y2="17.4"/>',
  },
  calendar: {
    gradient: ['#ff9a6c', '#f0682f'],
    glyph: '<rect x="4.5" y="5" width="15" height="14.5" rx="2.5"/><line x1="4.5" y1="9.3" x2="19.5" y2="9.3"/><line x1="8" y1="3.2" x2="8" y2="6.5"/><line x1="16" y1="3.2" x2="16" y2="6.5"/><line x1="8.3" y1="13" x2="8.3" y2="13"/><line x1="12" y1="13" x2="12" y2="13"/><line x1="15.7" y1="13" x2="15.7" y2="13"/><line x1="8.3" y1="16.3" x2="8.3" y2="16.3"/><line x1="12" y1="16.3" x2="12" y2="16.3"/>',
  },
  radio: {
    gradient: ['#ff8fb3', '#f0518f'],
    glyph: '<circle cx="12" cy="14" r="6.5"/><circle cx="12" cy="14" r="1.2" fill="white" stroke="none"/><path d="M8.5 4.5 12 7.5l3.5-3"/>',
  },
  settings: {
    gradient: ['#b9bec7', '#868d99'],
    glyph: '<circle cx="12" cy="12" r="6.4"/><circle cx="12" cy="12" r="2.1"/><line x1="12" y1="5.4" x2="12" y2="3.2" stroke-width="2.3"/><line x1="15.88" y1="6.66" x2="17.17" y2="4.88" stroke-width="2.3"/><line x1="18.28" y1="9.96" x2="20.37" y2="9.28" stroke-width="2.3"/><line x1="18.28" y1="14.04" x2="20.37" y2="14.72" stroke-width="2.3"/><line x1="15.88" y1="17.34" x2="17.17" y2="19.12" stroke-width="2.3"/><line x1="12" y1="18.6" x2="12" y2="20.8" stroke-width="2.3"/><line x1="8.12" y1="17.34" x2="6.83" y2="19.12" stroke-width="2.3"/><line x1="5.72" y1="14.04" x2="3.63" y2="14.72" stroke-width="2.3"/><line x1="5.72" y1="9.96" x2="3.63" y2="9.28" stroke-width="2.3"/><line x1="8.12" y1="6.66" x2="6.83" y2="4.88" stroke-width="2.3"/>',
  },
};

let counter = 0;

export function renderAppIcon(iconKey) {
  const def = ICON_DEFS[iconKey];
  if (!def) return '';
  counter += 1;
  const gradientId = `app-icon-${iconKey}-${counter}`;
  return `<svg class="app-icon" viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true"><defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${def.gradient[0]}"/><stop offset="100%" stop-color="${def.gradient[1]}"/></linearGradient></defs><rect width="24" height="24" rx="5.4" fill="url(#${gradientId})"/><g transform="translate(2.4 2.4) scale(0.8)" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.95">${def.glyph}</g></svg>`;
}
