const SAMPLE_WIDTH = 160;
const TARGET_CONTRAST = 4.5;
const MAX_ALPHA = 0.92;
const ALPHA_STEP = 0.02;
const WORST_PERCENTILE = 0.8;

const SECONDARY_CONTRAST = 3;

const GLASS = {
  light: { rgb: [255, 255, 255], alpha: 0.36, ink: 0.0045, ink2: 0.11 },
  dark: { rgb: [34, 34, 40], alpha: 0.42, ink: 0.85, ink2: 0.36 },
};

const images = new Map();

function loadImage(url) {
  if (!images.has(url)) {
    images.set(url, new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    }));
  }
  return images.get(url);
}

function toLinear(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function toGamma(linear) {
  const c = linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, c * 255));
}

function luminance(r, g, b) {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrast(a, b) {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function drawCover(img) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = SAMPLE_WIDTH / vw;
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_WIDTH;
  canvas.height = Math.max(1, Math.round(vh * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const cover = Math.max(vw / img.naturalWidth, vh / img.naturalHeight);
  const dw = img.naturalWidth * cover;
  const dh = img.naturalHeight * cover;
  ctx.drawImage(img, ((vw - dw) / 2) * scale, ((vh - dh) / 2) * scale, dw * scale, dh * scale);
  return { ctx, scale };
}

function regionLuminances({ ctx, scale }, rect) {
  const x = Math.max(0, Math.floor(rect.x * scale));
  const y = Math.max(0, Math.floor(rect.y * scale));
  const w = Math.max(1, Math.min(ctx.canvas.width - x, Math.ceil(rect.w * scale)));
  const h = Math.max(1, Math.min(ctx.canvas.height - y, Math.ceil(rect.h * scale)));
  const { data } = ctx.getImageData(x, y, w, h);
  const values = [];
  for (let i = 0; i < data.length; i += 4) values.push(luminance(data[i], data[i + 1], data[i + 2]));
  return values.sort((a, b) => a - b);
}

function thickness(values, glass) {
  const lightInk = glass.ink > 0.5;
  const pick = lightInk ? WORST_PERCENTILE : 1 - WORST_PERCENTILE;
  const worst = values[Math.min(values.length - 1, Math.floor(values.length * pick))];
  const wallGray = toGamma(worst);
  const glassGray = toGamma(luminance(...glass.rgb));
  const behind = (alpha) => toLinear(wallGray * (1 - alpha) + glassGray * alpha);
  let alpha = glass.alpha;
  while (alpha < MAX_ALPHA && contrast(behind(alpha), glass.ink) < TARGET_CONTRAST) alpha += ALPHA_STEP;
  alpha = Math.min(MAX_ALPHA, alpha);
  return { alpha, solid: contrast(behind(alpha), glass.ink2) < SECONDARY_CONTRAST };
}

const ACCENT_HUES = { apple: 75, signal: 16, ultramarine: 236 };
const PRESET_ACCENT = { mono: 'apple', aurora: 'ultramarine' };
const HUE_SAMPLE = 48;
const MIN_SATURATION = 0.25;
const MIN_CHROMA_SHARE = 0.12;

function hueOf(r, g, b) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return null;
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  if (saturation < MIN_SATURATION || lightness < 0.12 || lightness > 0.9) return null;
  let hue;
  if (max === r / 255) hue = ((g - b) / 255 / delta) % 6;
  else if (max === g / 255) hue = (b - r) / 255 / delta + 2;
  else hue = (r - g) / 255 / delta + 4;
  return { hue: (hue * 60 + 360) % 360, weight: saturation };
}

function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function presetAccent(wall) {
  return PRESET_ACCENT[wall] || 'apple';
}

export async function wallpaperAccent(url) {
  const img = await loadImage(url);
  const canvas = document.createElement('canvas');
  canvas.width = HUE_SAMPLE;
  canvas.height = Math.max(1, Math.round((HUE_SAMPLE * img.naturalHeight) / img.naturalWidth));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const votes = { apple: 0, signal: 0, ultramarine: 0 };
  let chromatic = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const sample = hueOf(data[i], data[i + 1], data[i + 2]);
    if (!sample) continue;
    chromatic += 1;
    let best = 'apple';
    Object.entries(ACCENT_HUES).forEach(([name, hue]) => {
      if (hueDistance(sample.hue, hue) < hueDistance(sample.hue, ACCENT_HUES[best])) best = name;
    });
    votes[best] += sample.weight;
  }
  if (chromatic / pixels < MIN_CHROMA_SHARE) return 'apple';
  return Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
}

export function baseThickness(theme) {
  const alpha = GLASS[theme === 'dark' ? 'dark' : 'light'].alpha;
  return { bar: { alpha, solid: false }, dock: { alpha, solid: false } };
}

export async function sampleGlassThickness(url, regions, theme) {
  const glass = GLASS[theme === 'dark' ? 'dark' : 'light'];
  const img = await loadImage(url);
  const canvas = drawCover(img);
  const out = {};
  Object.entries(regions).forEach(([key, rect]) => {
    out[key] = thickness(regionLuminances(canvas, rect), glass);
  });
  return out;
}
