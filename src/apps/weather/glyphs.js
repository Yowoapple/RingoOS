const CLOUD = 'M7.5 19h9a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6 1.2A2.9 2.9 0 0 0 7.5 19z';

function rays(cx, cy, inner, outer, count = 8, from = 0, to = 360) {
  const step = (to - from) / (to - from === 360 ? count : count - 1);
  let out = '';
  for (let i = 0; i < count; i += 1) {
    const a = ((from + i * step) * Math.PI) / 180;
    const x1 = (cx + Math.cos(a) * inner).toFixed(2);
    const y1 = (cy + Math.sin(a) * inner).toFixed(2);
    const x2 = (cx + Math.cos(a) * outer).toFixed(2);
    const y2 = (cy + Math.sin(a) * outer).toFixed(2);
    out += `<line class="g-ray" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }
  return out;
}

const cloud = (dy = 0, cls = 'g-ink g-cut') => `<path class="${cls}" d="${CLOUD}" transform="translate(0 ${dy})"/>`;
const moon = (cls, transform = '') => `<path class="${cls}" d="M19.4 14.6A7.6 7.6 0 1 1 9.4 4.6a6.1 6.1 0 0 0 10 10z"${transform ? ` transform="${transform}"` : ''}/>`;

const GLYPHS = {
  sunny: () => `${rays(12, 12, 6.7, 9)}<circle class="g-acc" cx="12" cy="12" r="4.4"/>`,
  'clear-night': () => `${moon('g-ink')}<path class="g-acc" d="M17.6 3.2l.55 1.45 1.45.55-1.45.55-.55 1.45-.55-1.45-1.45-.55 1.45-.55z"/>`,
  'partly-cloudy': () => `${rays(9, 9, 5.2, 7, 5, 150, 330)}<circle class="g-acc" cx="9" cy="9" r="3.5"/>${cloud(1)}`,
  'partly-cloudy-night': () => `${moon('g-acc', 'translate(-3.2 -2.4) scale(.62)')}${cloud(1)}`,
  cloudy: () => `<path class="g-soft" d="${CLOUD}" transform="translate(4.2 -5) scale(.78)"/>${cloud(1)}`,
  overcast: () => `<path class="g-soft" d="${CLOUD}" transform="translate(4.2 -6) scale(.78)"/>${cloud(-1)}<line class="g-line g-dim" x1="6.5" y1="21.4" x2="17.5" y2="21.4"/>`,
  fog: () => '<line class="g-line" x1="5" y1="8" x2="16" y2="8"/><line class="g-line g-dim" x1="8" y1="12" x2="19" y2="12"/><line class="g-line" x1="5" y1="16" x2="19" y2="16"/><line class="g-line g-dim" x1="9" y1="20" x2="15" y2="20"/>',
  'light-rain': () => `${cloud(-3)}<line class="g-line g-dim" x1="9.6" y1="18.6" x2="8.8" y2="20.8"/><line class="g-line g-dim" x1="14.6" y1="18.6" x2="13.8" y2="20.8"/>`,
  rain: () => `${cloud(-3)}<line class="g-line g-dim" x1="8.4" y1="18.4" x2="7.2" y2="21.8"/><line class="g-line g-dim" x1="12.4" y1="18.4" x2="11.2" y2="21.8"/><line class="g-line g-dim" x1="16.4" y1="18.4" x2="15.2" y2="21.8"/>`,
  sleet: () => `${cloud(-3)}<line class="g-line g-dim" x1="8.6" y1="18.4" x2="7.6" y2="21.4"/><circle class="g-soft-solid" cx="12" cy="20.2" r="1.15"/><line class="g-line g-dim" x1="16.4" y1="18.4" x2="15.4" y2="21.4"/>`,
  snow: () => `${cloud(-3)}<circle class="g-soft-solid" cx="8.2" cy="19.4" r="1.15"/><circle class="g-soft-solid" cx="12" cy="21.4" r="1.15"/><circle class="g-soft-solid" cx="15.8" cy="19.4" r="1.15"/>`,
  thunderstorm: () => `${cloud(-3)}<path class="g-acc" d="M12.9 15.2l-3.4 4.6h2.4l-1.2 3.6 4.3-5.3h-2.5l1.3-2.9z"/>`,
  'extreme-heat': () => `${rays(12, 10, 6.2, 8.4)}<circle class="g-acc" cx="12" cy="10" r="4.1"/><path class="g-line g-dim" d="M5 21.2c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0"/>`,
};

export function glyph(name, className = 'wx-g') {
  const draw = GLYPHS[name] || GLYPHS.cloudy;
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" data-glyph="${name in GLYPHS ? name : 'cloudy'}">${draw()}</svg>`;
}

export const GLYPH_NAMES = Object.keys(GLYPHS);
