const LEVEL_SCALE = { soft: 0.4, normal: 1, rich: 1.7 };
const LEVEL_ALPHA = { soft: 0.65, normal: 1, rich: 1.2 };

export const PREVIEWS = [
  { id: 'sun', label: '晴天', weather: { mood: 'clear', glyph: 'sunny', temperature: 26, wind: 3 } },
  { id: 'hot', label: '炎熱', weather: { mood: 'clear', glyph: 'extreme-heat', temperature: 36, wind: 2 } },
  { id: 'rain', label: '下雨', weather: { mood: 'rain', glyph: 'rain', temperature: 22, wind: 12 } },
  { id: 'storm', label: '雷雨', weather: { mood: 'storm', glyph: 'thunderstorm', temperature: 24, wind: 20 } },
  { id: 'snow', label: '下雪', weather: { mood: 'snow', glyph: 'snow', temperature: -2, wind: 5 } },
  { id: 'night', label: '晴夜', weather: { mood: 'night', glyph: 'clear-night', temperature: 20, wind: 2 } },
  { id: 'cloud', label: '多雲', weather: { mood: 'cloudy', glyph: 'cloudy', temperature: 23, wind: 6 } },
  { id: 'fog', label: '有霧', weather: { mood: 'fog', glyph: 'fog', temperature: 16, wind: 1 } },
];

export function levelAlpha(level) {
  return LEVEL_ALPHA[level] || 1;
}

export function hasDetail(level, detail) {
  const table = {
    soft: [],
    normal: ['splash', 'rays', 'meteor', 'bolt'],
    rich: ['splash', 'rays', 'meteor', 'bolt', 'beads', 'settle', 'moreRays'],
  };
  return (table[level] || table.normal).includes(detail);
}

export function effectFor(weather) {
  if (!weather || !weather.mood) return null;
  const { mood, glyph = '', wind = 0, temperature = null } = weather;
  const slope = Math.min(0.5, 0.1 + Math.max(0, Number(wind) || 0) / 60);
  if (mood === 'storm') return { kind: 'storm', intensity: 3, slope: Math.min(0.55, slope + 0.12) };
  if (mood === 'rain') return { kind: 'rain', intensity: glyph === 'light-rain' ? 1 : 2, slope };
  if (mood === 'snow') return { kind: 'snow', intensity: glyph === 'sleet' ? 1 : 2, slope: slope * 0.6 };
  if (mood === 'clear') {
    const t = Number(temperature);
    const heat = Number.isFinite(t) ? (t >= 35 ? 2 : t >= 30 ? 1 : 0) : 0;
    return { kind: 'sun', intensity: heat, slope: 0 };
  }
  if (mood === 'night') return { kind: 'night', intensity: 1, slope: 0 };
  if (mood === 'fog') return { kind: 'fog', intensity: 1, slope: 0 };
  return { kind: 'cloud', intensity: glyph === 'overcast' ? 2 : 1, slope: 0 };
}

export function particleCount(kind, intensity, { width, height, level = 'normal', tier = 'full' }) {
  const area = Math.max(0, width * height) / 100000;
  const base = { rain: [0, 16, 30, 44], storm: [0, 0, 0, 54], snow: [0, 12, 22, 22], night: [0, 10, 10, 10] }[kind];
  if (!base) return 0;
  const tierScale = tier === 'lite' ? 0.5 : tier === 'solid' ? 0 : 1;
  return Math.round(Math.min(base[Math.min(3, intensity)] * area, 300) * (LEVEL_SCALE[level] || 1) * tierScale);
}

export function canAnimate({ tier, phone, reduced }) {
  return !reduced && tier !== 'solid' && !phone;
}

export function shouldRun({ enabled, reduced, visible, open, sized, covered, effect }) {
  return !!(enabled && !reduced && visible && open && sized && !covered && effect);
}

export function inside(x, y, rects, pad = 0) {
  return rects.some((r) => x >= r.left - pad && x <= r.left + r.width + pad && y >= r.top - pad && y <= r.top + r.height + pad);
}
