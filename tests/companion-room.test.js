import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { DEX, DEX_FILES, dexProgress } from '../src/apps/companion/dex.js';
import { ACHIEVEMENTS, collectStats, loggedDays, newlyUnlocked, runsOf, streaks } from '../src/apps/companion/achievements.js';
import { FESTIVAL_IDS, LUNAR, SPRING, festivalLine, festivalOn } from '../src/apps/companion/festivals.js';
import { EGGS, IDLE, PET_IDLE, REACTIONS, MUSIC_IDLE, WEARY_IDLE } from '../src/apps/companion/behavior.js';
import { clearFresh, count, defaultLife, feed, markSeen, normalize } from '../src/apps/companion/pet-model.js';

function day(n, extra = {}) {
  return { income: [], expenses: Array.from({ length: n }, (_, i) => ({ id: `e${i}`, amount: 100, category: '餐飲', note: '', createdAt: new Date(2026, 8, 1, 12).getTime(), ...extra })), tasks: [] };
}

describe('dex', () => {
  it('lists every sprite file exactly once', () => {
    const files = readdirSync('public/characters/coffeebean').filter((f) => f.endsWith('.webp')).sort();
    expect([...DEX_FILES].sort()).toEqual(files);
    expect(new Set(DEX_FILES).size).toBe(DEX.length);
  });

  it('every sprite the pet can play is collectable', () => {
    const played = new Set([
      ...Object.values(IDLE).flat(),
      ...Object.values(PET_IDLE).flat(),
      ...Object.values(REACTIONS).map((r) => r.file),
      ...EGGS.map((e) => e.file),
      MUSIC_IDLE,
      WEARY_IDLE,
    ]);
    DEX_FILES.forEach((file) => expect(played.has(file)).toBe(true));
  });

  it('counts progress from seen files', () => {
    expect(dexProgress(['cake.webp', 'cake.webp', 'nope.webp'])).toEqual({ found: 1, total: 29 });
  });
});

describe('ledger streaks', () => {
  const state = { days: { '2026-09-01': day(1), '2026-09-02': day(2), '2026-09-03': day(1), '2026-09-05': day(1), '2026-09-06': { income: [], expenses: [], tasks: [{ id: 't' }] }, '2026-10-02': day(1), '2026-10-03': day(1) } };

  it('only counts days with entries', () => {
    expect(loggedDays(state)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-05', '2026-10-02', '2026-10-03']);
  });

  it('finds the best and current run', () => {
    const keys = loggedDays(state);
    expect(streaks(keys, '2026-10-03')).toEqual({ best: 3, current: 2 });
    expect(streaks(keys, '2026-10-04')).toEqual({ best: 3, current: 2 });
    expect(streaks(keys, '2026-10-05')).toEqual({ best: 3, current: 0 });
  });

  it('marks neighbours for the calendar capsules', () => {
    const runs = runsOf(loggedDays(state));
    expect(runs.get('2026-09-02')).toEqual({ prev: true, next: true });
    expect(runs.get('2026-09-05')).toEqual({ prev: false, next: false });
  });
});

describe('achievements', () => {
  it('unlocks retroactively from the ledger', () => {
    const days = {};
    for (let i = 1; i <= 30; i += 1) days[`2026-08-${String(i).padStart(2, '0')}`] = day(4);
    const state = { days, settings: { savingsGoals: [{ id: 'g', targetAmount: 500, currentAmount: 0, deposits: [{ amount: 600, type: 'manual' }, { amount: 600, type: 'withdraw' }] }], recurring: [] } };
    const life = normalize({ bond: 260, seen: ['cake.webp'] });
    const stats = collectStats(state, life, '2026-10-03', { budgetsFor: (m) => (m === '2026-08' ? { 餐飲: 20000 } : {}) });
    expect(stats.entries).toBe(120);
    expect(stats.streakBest).toBe(30);
    expect(stats.goalDone).toBe(true);
    expect(stats.keptBudget).toBe(true);
    const ids = newlyUnlocked(stats, {});
    expect(ids).toEqual(expect.arrayContaining(['first-entry', 'entries-100', 'days-30', 'streak-7', 'streak-30', 'first-save', 'goal-done', 'budget-month', 'level-5']));
    expect(ids).not.toContain('entries-500');
    expect(newlyUnlocked(stats, Object.fromEntries(ids.map((id) => [id, 1])))).toEqual([]);
  });

  it('does not count the running month for the budget badge', () => {
    const state = { days: { '2026-10-01': day(1) }, settings: { savingsGoals: [] } };
    const stats = collectStats(state, defaultLife(), '2026-10-03', { budgetsFor: () => ({ 餐飲: 9999 }) });
    expect(stats.keptBudget).toBe(false);
  });

  it('reports progress for locked ones', () => {
    const a = ACHIEVEMENTS.find((x) => x.id === 'entries-500');
    expect(a.progress({ entries: 123 })).toEqual([123, 500]);
    expect(new Set(ACHIEVEMENTS.map((x) => x.id)).size).toBe(ACHIEVEMENTS.length);
  });
});

describe('festivals', () => {
  it('finds fixed, computed and lunar days', () => {
    expect(festivalOn('2026-10-31')).toEqual({ id: 'halloween', name: '萬聖節' });
    expect(festivalOn('2026-05-10').id).toBe('mother');
    expect(festivalOn('2027-05-09').id).toBe('mother');
    expect(festivalOn('2026-02-17').id).toBe('spring');
    expect(festivalOn('2026-02-16').id).toBe('springeve');
    expect(festivalOn('2026-03-03').id).toBe('lantern');
    expect(festivalOn('2026-09-25').id).toBe('midautumn');
    expect(festivalOn('2026-06-19').id).toBe('duanwu');
    expect(festivalOn('2026-10-05')).toBe(null);
  });

  it('puts the birthday first', () => {
    expect(festivalOn('2026-12-25', '12-25').id).toBe('birthday');
  });

  it('has lines for every festival and every voice', () => {
    FESTIVAL_IDS.forEach((id) => {
      ['neutral', 'maid', 'wife', 'sister'].forEach((v) => expect(festivalLine(id, v, { name: 'SAYA' })).not.toBe(''));
    });
    const ids = new Set();
    for (let y = 2026; y <= 2030; y += 1) {
      for (let d = new Date(y, 0, 1); d.getFullYear() === y; d.setDate(d.getDate() + 1)) {
        const key = `${y}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const fest = festivalOn(key);
        if (fest) ids.add(fest.id);
      }
    }
    FESTIVAL_IDS.filter((id) => id !== 'birthday').forEach((id) => expect(ids.has(id)).toBe(true));
    expect(Object.keys(LUNAR).length).toBe(5);
    expect(Object.keys(SPRING).length).toBe(10);
  });
});

describe('pet life v2 fields', () => {
  it('backfills totals and first day from old data', () => {
    const life = normalize({ days: { '2026-09-20': { pats: 3, feeds: 2, deposits: 1 }, '2026-09-21': { pats: 1, tasksDone: 2 } } });
    expect(life.totals).toEqual({ pats: 4, feeds: 2, deposits: 1, tasks: 2 });
    expect(life.firstSeen).toBe('2026-09-20');
    expect(life.achInit).toBe(false);
    expect(life.birthday).toBe(null);
    expect(normalize({ birthday: '02-30' }).birthday).toBe(null);
    expect(normalize({ birthday: '02-29' }).birthday).toBe('02-29');
  });

  it('keeps lifetime totals and fresh tags up to date', () => {
    let life = defaultLife();
    life = count(life, '2026-10-03', 'pats');
    life = { ...life, treats: 2 };
    life = feed(life, '2026-10-03').life;
    expect(life.totals.pats).toBe(1);
    expect(life.totals.feeds).toBe(1);
    life = markSeen(life, 'cake.webp');
    expect(life.fresh).toEqual(['dex:cake.webp']);
    expect(clearFresh(life, 'dex:').fresh).toEqual([]);
  });
});
