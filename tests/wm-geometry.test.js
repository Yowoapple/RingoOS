import { describe, expect, it } from 'vitest';
import {
  clampPosition,
  detachFromSnap,
  fitFrame,
  glideDistance,
  morphState,
  resizeFrame,
  rubberband,
  rubberbandPosition,
  snapFrame,
  snapZoneAt,
} from '../src/wm/geometry.js';
import { createSpring } from '../src/motion/spring.js';

const AREA = { w: 1200, h: 700 };
const MIN = { w: 320, h: 220 };

describe('rubberband', () => {
  it('resists more the further it is pulled and never exceeds the pull', () => {
    const small = rubberband(20, 700);
    const large = rubberband(400, 700);
    expect(small).toBeGreaterThan(0);
    expect(small).toBeLessThan(20);
    expect(large).toBeLessThan(400 * 0.55);
    expect(rubberband(-50, 700)).toBeCloseTo(-rubberband(50, 700));
  });
});

describe('positions', () => {
  it('keeps enough of the window visible to grab it again', () => {
    const size = { w: 400, h: 300 };
    expect(clampPosition(-1000, -50, size, AREA)).toEqual({ x: 96 - 400, y: 0 });
    expect(clampPosition(5000, 5000, size, AREA)).toEqual({ x: 1200 - 96, y: 700 - 40 });
  });

  it('lets windows travel past the edge with resistance while dragging', () => {
    const pos = rubberbandPosition(100, -80, { w: 400, h: 300 }, AREA);
    expect(pos.x).toBe(100);
    expect(pos.y).toBeLessThan(0);
    expect(pos.y).toBeGreaterThan(-80);
  });

  it('fits oversized frames into a smaller work area', () => {
    expect(fitFrame({ x: 900, y: 500, w: 1600, h: 900 }, MIN, AREA)).toEqual({ x: 0, y: 0, w: 1200, h: 700 });
  });

  it('glides only as far as the spring naturally carries the release velocity', () => {
    expect(glideDistance(0, 0.4)).toBe(0);
    expect(glideDistance(1000, 0.4)).toBeCloseTo(63.66, 2);
    expect(glideDistance(-1000, 0.4)).toBeCloseTo(-63.66, 2);
  });

  it('only slows down after release until the window first comes to a stop', () => {
    [1, 0.8, 0.7].forEach((damping) => {
      const response = 0.4;
      const velocity = 1500;
      const spring = createSpring({ value: 0, target: glideDistance(velocity, response), response, damping });
      spring.setVelocity(velocity);
      let previous = velocity;
      for (let i = 0; i < 120 && spring.velocity > 0; i += 1) {
        spring.step(1 / 60);
        if (spring.velocity <= 0) break;
        expect(spring.velocity).toBeLessThanOrEqual(previous + 1e-6);
        previous = spring.velocity;
      }
    });
  });
});

describe('snapping', () => {
  it('detects edge zones', () => {
    expect(snapZoneAt({ x: 600, y: 4 }, AREA)).toBe('max');
    expect(snapZoneAt({ x: 3, y: 300 }, AREA)).toBe('left');
    expect(snapZoneAt({ x: 1197, y: 300 }, AREA)).toBe('right');
    expect(snapZoneAt({ x: 600, y: 300 }, AREA)).toBeNull();
  });

  it('builds half and full frames', () => {
    expect(snapFrame('left', AREA)).toEqual({ x: 0, y: 0, w: 600, h: 700 });
    expect(snapFrame('right', AREA)).toEqual({ x: 600, y: 0, w: 600, h: 700 });
    expect(snapFrame('max', AREA)).toEqual({ x: 0, y: 0, w: 1200, h: 700 });
  });

  it('keeps the grab point under the pointer when leaving a snapped layout', () => {
    const detached = detachFromSnap({ x: 900, y: 10 }, 300, { w: 600 }, { w: 400, h: 300 });
    expect(detached).toEqual({ x: 900 - 200, w: 400, h: 300 });
  });
});

describe('resizeFrame', () => {
  const start = { x: 200, y: 100, w: 500, h: 400 };

  it('resizes from the bottom-right corner', () => {
    expect(resizeFrame(start, 'se', 100, 50, MIN, AREA)).toEqual({ x: 200, y: 100, w: 600, h: 450 });
  });

  it('moves the origin when resizing from the top-left corner', () => {
    expect(resizeFrame(start, 'nw', 50, 40, MIN, AREA)).toEqual({ x: 250, y: 140, w: 450, h: 360 });
  });

  it('respects the minimum size without drifting the opposite edge', () => {
    const r = resizeFrame(start, 'w', 400, 0, MIN, AREA);
    expect(r.w).toBe(320);
    expect(r.x + r.w).toBe(start.x + start.w);
  });

  it('stays inside the work area', () => {
    const r = resizeFrame(start, 'se', 2000, 2000, MIN, AREA);
    expect(r.x + r.w).toBe(1200);
    expect(r.y + r.h).toBe(700);
  });
});

describe('morphState', () => {
  const icon = { x: 580, y: 740, size: 56 };
  const frame = { x: 300, y: 120, w: 600, h: 400 };
  const radii = { icon: 13, window: 12 };

  it('starts as a square the size of the icon, centred on the icon', () => {
    const m = morphState(0, icon, frame, radii);
    const visibleW = (frame.w - 2 * m.insetX) * m.scale;
    const visibleH = (frame.h - 2 * m.insetY) * m.scale;
    expect(visibleW).toBeCloseTo(56, 5);
    expect(visibleH).toBeCloseTo(56, 5);
    expect(m.tx + (frame.w / 2) * m.scale).toBeCloseTo(608, 5);
    expect(m.ty + (frame.h / 2) * m.scale).toBeCloseTo(768, 5);
    expect(m.radius * m.scale).toBeCloseTo(13, 5);
    expect(m.iconOpacity).toBe(1);
    expect(m.contentOpacity).toBe(0);
  });

  it('ends exactly on the window frame', () => {
    const m = morphState(1, icon, frame, radii);
    expect(m).toMatchObject({ tx: 300, ty: 120, scale: 1, insetX: 0, insetY: 0, radius: 12, contentOpacity: 1, iconOpacity: 0 });
  });

  it('scales uniformly so content is never squashed', () => {
    [0.1, 0.5, 0.9].forEach((p) => {
      const m = morphState(p, icon, frame, radii);
      expect(Number.isFinite(m.scale)).toBe(true);
      expect(m.scale).toBeGreaterThan(0);
    });
  });

  it('overshoots gracefully without negative clipping', () => {
    const m = morphState(1.05, icon, frame, radii);
    expect(m.scale).toBeGreaterThan(1);
    expect(m.insetX).toBe(0);
    expect(m.insetY).toBe(0);
  });
});
