import { Fx } from './fx-tier.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const REBUILD_DELAY = 140;
let counter = 0;
let defs = null;
let lensOn = true;
const instances = new Set();

export function setRefraction(on) {
  lensOn = !!on;
  instances.forEach((sync) => sync());
}

export function refractionOn() {
  return lensOn;
}

export function supportsRefraction() {
  const brands = navigator.userAgentData && navigator.userAgentData.brands;
  return !!brands && brands.some((entry) => /Chromium/.test(entry.brand));
}

function ensureDefs() {
  if (defs) return defs;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 'sr-only');
  defs = document.createElementNS(SVG_NS, 'defs');
  svg.appendChild(defs);
  document.body.appendChild(svg);
  return defs;
}

function cornerFor(x, y, radii) {
  if (x < 0) return y < 0 ? radii[0] : radii[3];
  return y < 0 ? radii[1] : radii[2];
}

function roundedDistance(x, y, halfW, halfH, radii) {
  const radius = cornerFor(x, y, radii);
  const qx = Math.abs(x) - (halfW - radius);
  const qy = Math.abs(y) - (halfH - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - radius;
}

function buildMap(width, height, radii, bandCss, ratio) {
  const w = Math.max(2, Math.round(width * ratio));
  const h = Math.max(2, Math.round(height * ratio));
  const scaled = radii.map((r) => Math.min(r * ratio, w / 2, h / 2));
  const band = Math.max(1, Math.min(bandCss * ratio, Math.min(w, h) * 0.4));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(w, h);
  const halfW = w / 2;
  const halfH = h / 2;
  const sdf = (px, py) => roundedDistance(px - halfW, py - halfH, halfW, halfH, scaled);
  for (let y = 0; y < h; y += 1) {
    const cy = y + 0.5;
    const nearY = Math.min(cy, h - cy) < band + 1;
    for (let x = 0; x < w; x += 1) {
      const cx = x + 0.5;
      const i = (y * w + x) * 4;
      image.data[i + 2] = 128;
      image.data[i + 3] = 255;
      if (!nearY && Math.min(cx, w - cx) >= band + Math.max(...scaled) + 1) {
        image.data[i] = 128;
        image.data[i + 1] = 128;
        continue;
      }
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
      image.data[i] = Math.round(128 + dx * 127);
      image.data[i + 1] = Math.round(128 + dy * 127);
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

function createFilter(id) {
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', id);
  filter.setAttribute('x', '0');
  filter.setAttribute('y', '0');
  filter.setAttribute('width', '100%');
  filter.setAttribute('height', '100%');
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  filter.innerHTML = '<feFlood flood-color="rgb(128, 128, 128)" result="neutral"/>'
    + '<feImage preserveAspectRatio="none" result="raw"/>'
    + '<feComposite in="raw" in2="neutral" operator="over" result="map"/>'
    + '<feDisplacementMap in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G"/>';
  ensureDefs().appendChild(filter);
  return { filter, image: filter.querySelector('feImage'), displace: filter.querySelector('feDisplacementMap') };
}

export function createGlass(holder, { measure, observe, band = 6, strength = 6, variable }) {
  const id = `glass-${counter += 1}`;
  const parts = createFilter(id);
  let key = '';
  let timer = 0;
  let enabled = false;

  function wanted() {
    return lensOn && Fx.tier === 'full' && supportsRefraction();
  }

  function build() {
    const size = measure();
    if (!size || size.w < 4 || size.h < 4) return false;
    const ratio = window.devicePixelRatio || 1;
    const radii = Array.isArray(size.r) ? size.r : [size.r, size.r, size.r, size.r];
    const next = `${Math.round(size.w)}x${Math.round(size.h)}:${radii.map((r) => Math.round(r)).join(',')}:${ratio}`;
    if (next === key) return true;
    key = next;
    parts.image.setAttribute('href', buildMap(size.w, size.h, radii, size.band ?? band, ratio));
    parts.displace.setAttribute('scale', String((size.strength ?? strength) * ratio));
    return true;
  }

  let retries = 0;

  function sync() {
    const want = wanted();
    const on = want && build();
    if (want && !on && retries < 12) {
      retries += 1;
      schedule();
    } else if (on) {
      retries = 0;
    }
    if (on === enabled) return;
    enabled = on;
    if (on) holder.style.setProperty(variable, `url(#${id})`);
    else holder.style.removeProperty(variable);
  }

  function schedule() {
    window.clearTimeout(timer);
    timer = window.setTimeout(sync, REBUILD_DELAY);
  }

  const observer = observe ? new ResizeObserver(schedule) : null;
  if (observer) observer.observe(observe);
  window.addEventListener('resize', schedule);
  const unsubscribe = Fx.subscribe(sync);
  instances.add(sync);
  sync();

  return {
    refresh() {
      retries = 0;
      sync();
    },
    rebuild() {
      key = '';
      retries = 0;
      sync();
    },
    get enabled() { return enabled; },
    destroy() {
      window.clearTimeout(timer);
      if (observer) observer.disconnect();
      window.removeEventListener('resize', schedule);
      unsubscribe();
      instances.delete(sync);
      holder.style.removeProperty(variable);
      parts.filter.remove();
    },
  };
}
