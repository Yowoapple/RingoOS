export const MIN_VISIBLE = 96;
export const SNAP_THRESHOLD = 14;

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function rubberband(overshoot, dimension, constant = 0.55) {
  if (overshoot === 0 || dimension <= 0) return 0;
  const sign = Math.sign(overshoot);
  const distance = Math.abs(overshoot);
  return sign * ((distance * dimension * constant) / (dimension + constant * distance));
}

export function projectMomentum(velocity, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

export function positionBounds(size, area) {
  return {
    minX: MIN_VISIBLE - size.w,
    maxX: area.w - MIN_VISIBLE,
    minY: 0,
    maxY: area.h - 40,
  };
}

export function clampPosition(x, y, size, area) {
  const b = positionBounds(size, area);
  return { x: clamp(x, b.minX, b.maxX), y: clamp(y, b.minY, b.maxY) };
}

export function rubberbandPosition(x, y, size, area) {
  const b = positionBounds(size, area);
  const band = (value, min, max, dimension) => {
    if (value < min) return min + rubberband(value - min, dimension);
    if (value > max) return max + rubberband(value - max, dimension);
    return value;
  };
  return { x: band(x, b.minX, b.maxX, area.w), y: band(y, b.minY, b.maxY, area.h) };
}

export function clampSize(w, h, min, area) {
  return {
    w: clamp(w, Math.min(min.w, area.w), area.w),
    h: clamp(h, Math.min(min.h, area.h), area.h),
  };
}

export function fitFrame(frame, min, area) {
  const size = clampSize(frame.w, frame.h, min, area);
  return {
    x: clamp(frame.x, 0, area.w - size.w),
    y: clamp(frame.y, 0, area.h - size.h),
    w: size.w,
    h: size.h,
  };
}

export function snapZoneAt(pointer, area, threshold = SNAP_THRESHOLD) {
  if (pointer.y <= threshold) return 'max';
  if (pointer.x <= threshold) return 'left';
  if (pointer.x >= area.w - threshold) return 'right';
  return null;
}

export function snapFrame(zone, area, gap = 0) {
  if (zone === 'max') return { x: 0, y: 0, w: area.w, h: area.h };
  const half = Math.round((area.w - gap) / 2);
  if (zone === 'left') return { x: 0, y: 0, w: half, h: area.h };
  if (zone === 'right') return { x: area.w - half, y: 0, w: half, h: area.h };
  return null;
}

export function detachFromSnap(pointer, grabOffsetX, snapped, restore) {
  const ratio = snapped.w > 0 ? clamp(grabOffsetX / snapped.w, 0, 1) : 0.5;
  return { x: pointer.x - restore.w * ratio, w: restore.w, h: restore.h };
}

export function resizeFrame(start, edges, dx, dy, min, area) {
  let { x, y, w, h } = start;
  if (edges.includes('e')) w = start.w + dx;
  if (edges.includes('s')) h = start.h + dy;
  if (edges.includes('w')) {
    w = start.w - dx;
    x = start.x + dx;
  }
  if (edges.includes('n')) {
    h = start.h - dy;
    y = start.y + dy;
  }
  if (w < min.w) {
    if (edges.includes('w')) x -= min.w - w;
    w = min.w;
  }
  if (h < min.h) {
    if (edges.includes('n')) y -= min.h - h;
    h = min.h;
  }
  if (x < 0) {
    w += x;
    x = 0;
  }
  if (y < 0) {
    h += y;
    y = 0;
  }
  w = Math.min(w, area.w - x);
  h = Math.min(h, area.h - y);
  return { x, y, w: Math.max(w, Math.min(min.w, area.w)), h: Math.max(h, Math.min(min.h, area.h)) };
}

export function morphState(progress, icon, frame, radii) {
  const side = Math.min(frame.w, frame.h);
  const startScale = icon.size / side;
  const p = progress;
  const scale = startScale * Math.pow(1 / startScale, p);
  const clipP = clamp(p, 0, 1);
  const insetX = lerp((frame.w - side) / 2, 0, clipP);
  const insetY = lerp((frame.h - side) / 2, 0, clipP);
  const radius = lerp(radii.icon / startScale, radii.window, clipP);
  const fromCenter = { x: icon.x + icon.size / 2, y: icon.y + icon.size / 2 };
  const toCenter = { x: frame.x + frame.w / 2, y: frame.y + frame.h / 2 };
  const cx = lerp(fromCenter.x, toCenter.x, p);
  const cy = lerp(fromCenter.y, toCenter.y, p);
  return {
    tx: cx - (frame.w / 2) * scale,
    ty: cy - (frame.h / 2) * scale,
    scale,
    insetX,
    insetY,
    radius,
    contentOpacity: smoothstep(0.08, 0.4, p),
    iconOpacity: 1 - smoothstep(0.02, 0.32, p),
  };
}
