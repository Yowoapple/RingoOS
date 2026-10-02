import { describe, expect, it } from 'vitest';
import { DEFAULT_NAME, FEEDS_PER_DAY, LEVELS, TREAT_CAP, count, decay, defaultLife, feed, goalsFor, levelOf, mealFor, normalize, stateOf, sync } from '../src/apps/companion/pet-model.js';

const ctx = (patch = {}) => ({ entries: 0, tagged: 0, noted: 0, pendingTasks: 0, goals: 0, dailyBudget: 0, expense: 0, hour: 12, ...patch });

describe('life basics', () => {
  it('starts with SAYA and repairs broken saves', () => {
    expect(defaultLife().name).toBe(DEFAULT_NAME);
    const fixed = normalize({ name: '  ', fullness: 300, mood: -5, treats: 99 });
    expect(fixed.name).toBe(DEFAULT_NAME);
    expect(fixed.fullness).toBe(100);
    expect(fixed.mood).toBe(15);
    expect(fixed.treats).toBe(TREAT_CAP);
  });

  it('levels up along the thresholds', () => {
    expect(levelOf(0).level).toBe(1);
    expect(levelOf(LEVELS[2]).level).toBe(3);
    expect(levelOf(LEVELS[2] - 1).level).toBe(2);
    expect(levelOf(99999)).toMatchObject({ level: 10, next: null, progress: 1 });
  });

  it('gets hungry over time and her mood drifts back to calm without dropping below the floor', () => {
    const start = { ...defaultLife(0), fullness: 80, mood: 90, lastTick: 0 };
    const later = decay(start, 10 * 3600000);
    expect(later.fullness).toBe(40);
    expect(later.mood).toBe(70);
    expect(decay({ ...start, mood: 20 }, 100 * 3600000).mood).toBe(50);
  });

  it('reports a state for idle and lines', () => {
    expect(stateOf({ fullness: 10, mood: 90 })).toBe('hungry');
    expect(stateOf({ fullness: 60, mood: 20 })).toBe('sad');
    expect(stateOf({ fullness: 60, mood: 80 })).toBe('happy');
    expect(stateOf({ fullness: 60, mood: 50 })).toBe('calm');
  });
});

describe('feeding by logging', () => {
  it('fills her up with diminishing meals and takes it back when entries are deleted', () => {
    expect(mealFor(1)).toBe(30);
    expect(mealFor(3)).toBe(53);
    expect(mealFor(50)).toBe(70);
    let life = { ...defaultLife(0), fullness: 10 };
    life = sync(life, '2026-10-02', ctx({ entries: 2 })).life;
    expect(life.fullness).toBe(55);
    life = sync(life, '2026-10-02', ctx({ entries: 1 })).life;
    expect(life.fullness).toBe(40);
  });

  it('checks in once a day, keeps a streak, and undoes it if the day is emptied', () => {
    let life = defaultLife(0);
    let out = sync(life, '2026-10-01', ctx({ entries: 1 }));
    expect(out.events.map((e) => e.type)).toContain('checkin');
    life = out.life;
    out = sync(life, '2026-10-02', ctx({ entries: 1 }));
    life = out.life;
    expect(life.streak).toEqual({ count: 2, last: '2026-10-02' });
    const bond = life.bond;
    expect(sync(life, '2026-10-02', ctx({ entries: 3 })).events.filter((e) => e.type === 'checkin')).toHaveLength(0);
    out = sync(life, '2026-10-02', ctx({ entries: 0 }));
    expect(out.life.streak).toEqual({ count: 1, last: '2026-10-01' });
    expect(out.life.bond).toBe(bond - 12);
    expect(sync(life, '2026-10-04', ctx({ entries: 1 })).life.streak.count).toBe(1);
  });
});

describe('daily goals and treats', () => {
  it('always includes logging and only offers goals that make sense', () => {
    const plain = goalsFor('2026-10-02', ctx());
    expect(plain[0]).toBe('log');
    expect(plain).toHaveLength(3);
    expect(plain).not.toContain('save');
    expect(plain).not.toContain('budget');
    expect(goalsFor('2026-10-02', ctx())).toEqual(plain);
  });

  it('pays a treat per finished goal up to the daily cap', () => {
    let life = defaultLife(0);
    life = count(life, '2026-10-02', 'pats');
    const out = sync(life, '2026-10-02', ctx({ entries: 1, tagged: 1, noted: 1 }));
    const goals = out.events.filter((e) => e.type === 'goal').length;
    expect(goals).toBeGreaterThan(0);
    expect(out.life.treats).toBe(1 + Math.min(goals, 3));
  });

  it('takes back entry goals and their treats when the entries are deleted', () => {
    let life = defaultLife(0);
    life = sync(life, '2026-10-02', ctx({ entries: 1 })).life;
    expect(life.days['2026-10-02'].goals.log).toBe(true);
    expect(life.treats).toBe(2);
    const out = sync(life, '2026-10-02', ctx({ entries: 0 }));
    expect(out.life.days['2026-10-02'].goals.log).toBeUndefined();
    expect(out.life.treats).toBe(0);
    expect(out.life.bond).toBe(0);
  });

  it('feeds a treat with daily and stock limits', () => {
    let life = { ...defaultLife(0), treats: 7, fullness: 20, mood: 40 };
    let out = feed(life, '2026-10-02');
    expect(out.ok).toBe(true);
    expect(out.life).toMatchObject({ treats: 6, fullness: 35, mood: 50, bond: 1 });
    life = out.life;
    for (let i = 1; i < FEEDS_PER_DAY; i += 1) life = feed(life, '2026-10-02').life;
    expect(feed(life, '2026-10-02')).toMatchObject({ ok: false, reason: 'full' });
    expect(feed({ ...defaultLife(0), treats: 0 }, '2026-10-02')).toMatchObject({ ok: false, reason: 'empty' });
  });
});
