import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Animator, createMotion } from '../src/motion/animator.js';

let queue = [];
let clock = 0;

function flushFrame() {
  const callbacks = queue;
  queue = [];
  clock += 6;
  callbacks.forEach((cb) => cb(clock));
  return callbacks.length;
}

beforeEach(() => {
  queue = [];
  clock = 0;
  globalThis.requestAnimationFrame = (cb) => {
    queue.push(cb);
    return queue.length;
  };
  globalThis.cancelAnimationFrame = () => {};
  Animator.setManual(false);
});

afterEach(() => {
  Animator.finishAll();
  while (queue.length) flushFrame();
  delete globalThis.requestAnimationFrame;
  delete globalThis.cancelAnimationFrame;
});

describe('Animator frame loop', () => {
  it('keeps a single loop when an update starts another motion', () => {
    const follower = createMotion({ v: 0 }, { response: 0.4, damping: 0.7 });
    const leader = createMotion({ v: 0 }, { response: 0.4, damping: 0.7 });
    leader.onUpdate(({ v }) => follower.to({ v }));
    leader.to({ v: 1 });
    let most = 0;
    for (let i = 0; i < 40; i += 1) {
      most = Math.max(most, queue.length);
      flushFrame();
    }
    expect(most).toBe(1);
  });

  it('advances by real time, not by the number of motions touched', () => {
    const leader = createMotion({ v: 0 }, { response: 0.5, damping: 1 });
    const followers = Array.from({ length: 5 }, () => createMotion({ v: 0 }, { response: 0.5, damping: 1 }));
    leader.onUpdate(({ v }) => followers.forEach((f) => f.to({ v })));
    leader.to({ v: 1 });
    for (let i = 0; i < 5; i += 1) flushFrame();
    expect(leader.get('v')).toBeLessThan(0.2);
  });

  it('stops a motion whose update throws without stalling the others', () => {
    const broken = createMotion({ v: 0 }, { response: 0.3, damping: 1 });
    const healthy = createMotion({ v: 0 }, { response: 0.3, damping: 1 });
    let calls = 0;
    broken.onUpdate(() => {
      calls += 1;
      if (calls > 1) throw new Error('boom');
    });
    const error = console.error;
    console.error = () => {};
    broken.to({ v: 1 });
    healthy.to({ v: 1 });
    for (let i = 0; i < 200 && queue.length; i += 1) flushFrame();
    console.error = error;
    expect(healthy.get('v')).toBe(1);
    expect(Animator.activeCount).toBe(0);
  });
});
