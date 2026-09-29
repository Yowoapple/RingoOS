const BAND_MAX = 6;
const STRENGTH = 7;

export function supportsRefraction() {
  const brands = navigator.userAgentData && navigator.userAgentData.brands;
  return !!brands && brands.some((entry) => /Chromium/.test(entry.brand));
}

function roundedRectDistance(x, y, halfW, halfH, radius) {
  const qx = Math.abs(x) - (halfW - radius);
  const qy = Math.abs(y) - (halfH - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - radius;
}

function buildMap(width, height, ratio) {
  const w = Math.max(2, Math.round(width * ratio));
  const h = Math.max(2, Math.round(height * ratio));
  const radius = Math.min(w, h) / 2;
  const band = Math.min(BAND_MAX * ratio, radius * 0.4);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(w, h);
  const halfW = w / 2;
  const halfH = h / 2;
  const sdf = (px, py) => roundedRectDistance(px - halfW, py - halfH, halfW, halfH, radius);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      const depth = -sdf(cx, cy);
      let dx = 0;
      let dy = 0;
      if (depth >= 0 && depth < band) {
        const nx = sdf(cx + 1, cy) - sdf(cx - 1, cy);
        const ny = sdf(cx, cy + 1) - sdf(cx, cy - 1);
        const length = Math.hypot(nx, ny) || 1;
        const t = 1 - depth / band;
        const strength = t * t;
        dx = (-nx / length) * strength;
        dy = (-ny / length) * strength;
      }
      const i = (y * w + x) * 4;
      image.data[i] = Math.round(128 + dx * 127);
      image.data[i + 1] = Math.round(128 + dy * 127);
      image.data[i + 2] = 128;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return { url: canvas.toDataURL('image/png'), w, h };
}

export function applyLens(element, enabled) {
  const mapNode = document.getElementById('lens-map');
  if (!enabled || !mapNode || !supportsRefraction()) {
    element.style.backdropFilter = '';
    element.style.webkitBackdropFilter = '';
    return false;
  }
  const ratio = window.devicePixelRatio || 1;
  const map = buildMap(element.offsetWidth, element.offsetHeight, ratio);
  mapNode.setAttribute('href', map.url);
  mapNode.setAttribute('width', String(map.w));
  mapNode.setAttribute('height', String(map.h));
  const displacement = document.getElementById('lens-displace');
  if (displacement) displacement.setAttribute('scale', String(STRENGTH * ratio));
  const value = 'url(#lens-filter) saturate(1.6) brightness(1.04)';
  element.style.backdropFilter = value;
  element.style.webkitBackdropFilter = value;
  return true;
}
