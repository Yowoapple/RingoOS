const SAMPLE_WIDTH = 160;
const INK_DARK = 0.0045;
const INK_LIGHT = 0.88;
const KEEP_RATIO = 1.25;
const BUSY_SPREAD = 0.16;
const MIN_CONTRAST = 3.2;

const images = new Map();
const previous = new Map();

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

function luminance(r, g, b) {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
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

function measure({ ctx, scale }, rect) {
  const x = Math.max(0, Math.floor(rect.x * scale));
  const y = Math.max(0, Math.floor(rect.y * scale));
  const w = Math.max(1, Math.min(ctx.canvas.width - x, Math.ceil(rect.w * scale)));
  const h = Math.max(1, Math.min(ctx.canvas.height - y, Math.ceil(rect.h * scale)));
  const { data } = ctx.getImageData(x, y, w, h);
  const values = [];
  for (let i = 0; i < data.length; i += 4) values.push(luminance(data[i], data[i + 1], data[i + 2]));
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const spread = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
  return { mean, spread };
}

function decide(key, { mean, spread }) {
  const againstDark = (mean + 0.05) / (INK_DARK + 0.05);
  const againstLight = (INK_LIGHT + 0.05) / (mean + 0.05);
  let tone = againstDark >= againstLight ? 'dark' : 'light';
  const last = previous.get(key);
  if (last && last !== tone) {
    const ratio = Math.max(againstDark, againstLight) / Math.min(againstDark, againstLight);
    if (ratio < KEEP_RATIO) tone = last;
  }
  previous.set(key, tone);
  const contrast = tone === 'dark' ? againstDark : againstLight;
  return { tone, busy: spread > BUSY_SPREAD || contrast < MIN_CONTRAST };
}

export function presetTones(theme) {
  const tone = theme === 'dark' ? 'light' : 'dark';
  return { bar: { tone, busy: false }, dock: { tone, busy: false } };
}

export async function sampleWallTones(url, regions) {
  const img = await loadImage(url);
  const canvas = drawCover(img);
  const out = {};
  Object.entries(regions).forEach(([key, rect]) => {
    out[key] = decide(key, measure(canvas, rect));
  });
  return out;
}
