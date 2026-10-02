import { describe, expect, it } from 'vitest';
import { EGGS, IDLE, MUSIC_IDLE, REACTIONS, clampInto, findPerch, pickEgg, pickIdle, project, reactionForNotice, restUntil, stashSide } from '../src/apps/companion/behavior.js';

const bounds = { left: 0, top: 40, right: 1000, bottom: 700 };
const size = { w: 200, h: 200 };

describe('idle and reactions', () => {
  it('keeps the same idle for a day and status, and prefers music', () => {
    const a = pickIdle('positive', '2026-10-02');
    expect(IDLE.positive).toContain(a);
    expect(pickIdle('positive', '2026-10-02')).toBe(a);
    expect(pickIdle('danger', '2026-10-02', { music: true })).toBe(MUSIC_IDLE);
    expect(pickIdle('unknown', '2026-10-02')).toBe(IDLE.empty[0]);
  });

  it('never repeats the last easter egg', () => {
    for (let i = 0; i < 20; i += 1) {
      const last = EGGS[i % EGGS.length].file;
      expect(pickEgg(Math.random(), last).file).not.toBe(last);
    }
    expect(pickEgg(0.9999, null)).toBe(EGGS[EGGS.length - 1]);
  });

  it('cries for budgets, gets nervous before, points for everything else', () => {
    expect(reactionForNotice({ key: 'budget-100:2026-10' })).toBe(REACTIONS.overAll);
    expect(reactionForNotice({ key: 'budget-cat:2026-10:餐飲' })).toBe(REACTIONS.over);
    expect(reactionForNotice({ key: 'budget-proj:2026-10' })).toBe(REACTIONS.nervous);
    expect(reactionForNotice({ key: 'wx-rain:2026-10-02' })).toBe(REACTIONS.notify);
    expect(reactionForNotice(null)).toBeNull();
  });
});

describe('throwing and stashing', () => {
  it('projects along the velocity and clamps inside the desk', () => {
    expect(project({ x: 100, y: 100, vx: 1000, vy: -500 })).toEqual({ x: 260, y: 20 });
    expect(clampInto({ x: -50, y: 900 }, size, bounds)).toEqual({ x: 0, y: 500 });
  });

  it('stashes when pushed past an edge or flung toward a nearby edge', () => {
    expect(stashSide({ x: -100, vx: 0 }, size, bounds)).toBe('left');
    expect(stashSide({ x: 900, vx: 0 }, size, bounds)).toBe('right');
    expect(stashSide({ x: 700, vx: 1500 }, size, bounds)).toBe('right');
    expect(stashSide({ x: 300, vx: 1500 }, size, bounds)).toBeNull();
    expect(stashSide({ x: 400, vx: 0 }, size, bounds)).toBeNull();
  });
});

describe('perching', () => {
  const windows = [
    { id: 'a', left: 100, right: 600, top: 300, z: 11 },
    { id: 'b', left: 300, right: 900, top: 310, z: 12 },
  ];

  it('sits on the topmost window whose top edge is under her feet', () => {
    expect(findPerch({ x: 400, y: 305 }, windows)).toEqual({ id: 'b', offset: 100 / 600 });
    expect(findPerch({ x: 150, y: 298 }, windows).id).toBe('a');
    expect(findPerch({ x: 400, y: 380 }, windows)).toBeNull();
    expect(findPerch({ x: 95, y: 300 }, windows)).toBeNull();
  });
});

describe('rest', () => {
  it('computes when she comes back', () => {
    const now = new Date('2026-10-02T21:00:00');
    expect(restUntil('30m', now) - now.getTime()).toBe(30 * 60000);
    expect(new Date(restUntil('tomorrow', now)).toString()).toBe(new Date('2026-10-03T06:00:00').toString());
    expect(restUntil('nope', now)).toBe(0);
  });
});
