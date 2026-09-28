import { beforeAll, describe, expect, it } from 'vitest';
import { createSpring, springCoefficients } from '../src/motion/spring.js';
import { Animator, createMotion } from '../src/motion/animator.js';

function run(spring, seconds, fps = 60) {
  const trace = [];
  const frames = Math.round(seconds * fps);
  for (let i = 0; i < frames; i += 1) {
    spring.step(1 / fps);
    trace.push(spring.value);
  }
  return trace;
}

describe('springCoefficients', () => {
  it('maps response and damping ratio to stiffness and friction', () => {
    const { stiffness, friction } = springCoefficients(0.5, 1);
    expect(stiffness).toBeCloseTo((2 * Math.PI / 0.5) ** 2, 6);
    expect(friction).toBeCloseTo(2 * (2 * Math.PI / 0.5), 6);
  });
});

describe('createSpring', () => {
  it('settles exactly on the target', () => {
    const spring = createSpring({ value: 0, target: 100, response: 0.35, damping: 1 });
    run(spring, 1.5);
    expect(spring.settled).toBe(true);
    expect(spring.value).toBe(100);
    expect(spring.velocity).toBe(0);
  });

  it('never overshoots when critically damped', () => {
    const spring = createSpring({ value: 0, target: 100, response: 0.4, damping: 1 });
    expect(Math.max(...run(spring, 2))).toBeLessThanOrEqual(100.0001);
  });

  it('overshoots when under-damped', () => {
    const spring = createSpring({ value: 0, target: 100, response: 0.4, damping: 0.6 });
    expect(Math.max(...run(spring, 2))).toBeGreaterThan(105);
  });

  it('gives the same motion regardless of frame rate', () => {
    const a = createSpring({ value: 0, target: 1, response: 0.42, damping: 0.86 });
    const b = createSpring({ value: 0, target: 1, response: 0.42, damping: 0.86 });
    run(a, 0.2, 30);
    run(b, 0.2, 144);
    expect(a.value).toBeCloseTo(b.value, 2);
  });

  it('keeps velocity when the target changes mid-flight', () => {
    const spring = createSpring({ value: 0, target: 100, response: 0.4, damping: 1 });
    run(spring, 0.1);
    const before = spring.velocity;
    spring.setTarget(0);
    expect(spring.velocity).toBe(before);
    expect(before).toBeGreaterThan(0);
  });

  it('accepts an initial velocity for gesture hand-off', () => {
    const spring = createSpring({ value: 0, target: 0, response: 0.4, damping: 0.8 });
    spring.setTarget(0, 2000);
    run(spring, 0.05);
    expect(spring.value).toBeGreaterThan(20);
  });

  it('clamps huge time steps so a stalled tab cannot explode the simulation', () => {
    const spring = createSpring({ value: 0, target: 100, response: 0.4, damping: 1 });
    spring.step(5);
    expect(spring.value).toBeGreaterThan(0);
    expect(spring.value).toBeLessThan(100);
  });
});

describe('createMotion', () => {
  beforeAll(() => Animator.setManual(true));

  it('resolves true when a transition completes', async () => {
    const motion = createMotion({ x: 0 }, { response: 0.3, damping: 1 });
    const done = motion.to({ x: 50 });
    for (let i = 0; i < 120 && motion.isAnimating; i += 1) Animator.step(16);
    await expect(done).resolves.toBe(true);
    expect(motion.get('x')).toBe(50);
  });

  it('resolves false when interrupted, and continues from the current value', async () => {
    const motion = createMotion({ x: 0 }, { response: 0.4, damping: 1 });
    const first = motion.to({ x: 100 });
    for (let i = 0; i < 6; i += 1) Animator.step(16);
    const midway = motion.get('x');
    const velocity = motion.velocity('x');
    const second = motion.to({ x: 0 });
    await expect(first).resolves.toBe(false);
    expect(motion.get('x')).toBe(midway);
    expect(motion.velocity('x')).toBe(velocity);
    for (let i = 0; i < 200 && motion.isAnimating; i += 1) Animator.step(16);
    await expect(second).resolves.toBe(true);
  });

  it('jumps to the end when everything is finished at once', async () => {
    const motion = createMotion({ x: 0, y: 0 });
    const done = motion.to({ x: 10, y: 20 });
    Animator.finishAll();
    await expect(done).resolves.toBe(true);
    expect(motion.values).toEqual({ x: 10, y: 20 });
    expect(Animator.activeCount).toBe(0);
  });

  it('supports per-key rest thresholds so pixel values settle as early as unit values', () => {
    const coarse = createMotion({ p: 0, px: 0 }, { response: 0.35, damping: 1, restDelta: { p: 0.0002, px: 0.05 } });
    const strict = createMotion({ p: 0, px: 0 }, { response: 0.35, damping: 1, restDelta: 0.0002 });
    coarse.to({ p: 1, px: 400 });
    strict.to({ p: 1, px: 400 });
    let coarseFrames = null;
    let strictFrames = null;
    for (let frame = 1; frame <= 500 && (coarseFrames === null || strictFrames === null); frame += 1) {
      Animator.step(16);
      if (coarseFrames === null && !coarse.isAnimating) coarseFrames = frame;
      if (strictFrames === null && !strict.isAnimating) strictFrames = frame;
    }
    expect(coarse.values).toEqual({ p: 1, px: 400 });
    expect(coarseFrames).toBeLessThan(strictFrames);
  });

  it('notifies listeners on every frame', () => {
    const motion = createMotion({ x: 0 });
    const seen = [];
    motion.onUpdate((values) => seen.push(values.x));
    motion.to({ x: 1 });
    Animator.step(16);
    Animator.step(16);
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen[1]).toBeGreaterThan(seen[0]);
    Animator.finishAll();
  });
});
