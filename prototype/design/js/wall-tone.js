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
  let alpha = glass.alpha;
  while (alpha < MAX_ALPHA) {
    const mixed = toLinear(wallGray * (1 - alpha) + glassGray * alpha);
    if (contrast(mixed, glass.ink) >= TARGET_CONTRAST && contrast(mixed, glass.ink2) >= SECONDARY_CONTRAST) break;
    alpha += ALPHA_STEP;
  }
  return Math.min(MAX_ALPHA, alpha);
}

export function baseThickness(theme) {
  const alpha = GLASS[theme === 'dark' ? 'dark' : 'light'].alpha;
  return { bar: alpha, dock: alpha };
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
