const LEVEL_SCALE = { soft: 0.5, normal: 1, rich: 1.6 };

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
  const base = { rain: [0, 26, 52, 78], storm: [0, 0, 0, 90], snow: [0, 18, 34, 34], night: [0, 14, 14, 14] }[kind];
  if (!base) return 0;
  const tierScale = tier === 'lite' ? 0.5 : tier === 'solid' ? 0 : 1;
  return Math.round(Math.min(base[Math.min(3, intensity)] * area, 420) * (LEVEL_SCALE[level] || 1) * tierScale);
}

export function canAnimate({ tier, phone, reduced }) {
  return !reduced && tier !== 'solid' && !phone;
}

export function shouldRun({ enabled, reduced, visible, open, sized, covered, effect }) {
  return !!(enabled && !reduced && visible && open && sized && !covered && effect);
}
