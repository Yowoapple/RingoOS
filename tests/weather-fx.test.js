import { describe, expect, it } from 'vitest';
import { PREVIEWS, canAnimate, effectFor, glowFor, hasDetail, inside, particleCount, shouldRun } from '../src/apps/weather/fx/plan.js';

describe('sunny glow and levels', () => {
  it('only glows on clear days and warms up with the heat', () => {
    expect(glowFor({ mood: 'rain', temperature: 36 })).toBe(null);
    expect(glowFor({ mood: 'night', temperature: 36 })).toBe(null);
    expect(glowFor({ mood: 'clear', temperature: 25 }).heat).toBe(1);
    expect(glowFor({ mood: 'clear', temperature: 31 }).heat).toBe(2);
    expect(glowFor({ mood: 'clear', temperature: 35 }).heat).toBe(3);
    expect(glowFor({ mood: 'clear', temperature: 36 }, { enabled: false })).toBe(null);
  });

  it('gives each strength a visibly different set of details', () => {
    const hot = { mood: 'clear', temperature: 36 };
    expect(glowFor(hot, { level: 'soft' })).toEqual({ heat: 3, sheen: 'off', shimmer: false });
    expect(glowFor(hot, { level: 'normal' })).toEqual({ heat: 3, sheen: 'normal', shimmer: true });
    expect(glowFor({ mood: 'clear', temperature: 31 }, { level: 'normal' }).shimmer).toBe(false);
    expect(glowFor({ mood: 'clear', temperature: 31 }, { level: 'rich' })).toEqual({ heat: 2, sheen: 'rich', shimmer: true });
    expect(glowFor(hot, { level: 'rich', animate: false })).toEqual({ heat: 3, sheen: 'off', shimmer: false });
    expect(hasDetail('soft', 'splash')).toBe(false);
    expect(hasDetail('normal', 'splash')).toBe(true);
    expect(hasDetail('normal', 'settle')).toBe(false);
    expect(hasDetail('rich', 'settle')).toBe(true);
  });

  it('has a preview for every kind of effect', () => {
    const kinds = new Set(PREVIEWS.map((p) => effectFor(p.weather).kind));
    ['sun', 'rain', 'storm', 'snow', 'night', 'cloud', 'fog'].forEach((k) => expect(kinds.has(k)).toBe(true));
    expect(inside(5, 5, [{ left: 0, top: 0, width: 10, height: 10 }])).toBe(true);
    expect(inside(15, 5, [{ left: 0, top: 0, width: 10, height: 10 }], 4)).toBe(false);
  });
});

describe('weather fx plan', () => {
  it('maps weather to an effect and its strength', () => {
    expect(effectFor(null)).toBe(null);
    expect(effectFor({ mood: 'rain', glyph: 'light-rain', wind: 0 })).toMatchObject({ kind: 'rain', intensity: 1 });
    expect(effectFor({ mood: 'rain', glyph: 'rain', wind: 0 })).toMatchObject({ kind: 'rain', intensity: 2 });
    expect(effectFor({ mood: 'storm', glyph: 'thunderstorm' })).toMatchObject({ kind: 'storm', intensity: 3 });
    expect(effectFor({ mood: 'snow', glyph: 'snow' }).kind).toBe('snow');
    expect(effectFor({ mood: 'night' }).kind).toBe('night');
    expect(effectFor({ mood: 'fog' }).kind).toBe('fog');
    expect(effectFor({ mood: 'cloudy', glyph: 'overcast' })).toMatchObject({ kind: 'cloud', intensity: 2 });
  });

  it('turns up the sun with the heat', () => {
    expect(effectFor({ mood: 'clear', temperature: 26 }).intensity).toBe(0);
    expect(effectFor({ mood: 'clear', temperature: 31 }).intensity).toBe(1);
    expect(effectFor({ mood: 'clear', temperature: 36 }).intensity).toBe(2);
  });

  it('leans the rain with the wind but caps it', () => {
    const calm = effectFor({ mood: 'rain', glyph: 'rain', wind: 0 }).slope;
    const windy = effectFor({ mood: 'rain', glyph: 'rain', wind: 20 }).slope;
    const gale = effectFor({ mood: 'rain', glyph: 'rain', wind: 200 }).slope;
    expect(windy).toBeGreaterThan(calm);
    expect(gale).toBeLessThanOrEqual(0.5);
  });

  it('scales particles with area, level and tier', () => {
    const size = { width: 800, height: 600 };
    const normal = particleCount('rain', 2, { ...size, level: 'normal', tier: 'full' });
    expect(particleCount('rain', 2, { ...size, level: 'soft', tier: 'full' })).toBeLessThan(normal);
    expect(particleCount('rain', 2, { ...size, level: 'rich', tier: 'full' })).toBeGreaterThan(normal);
    expect(particleCount('rain', 2, { ...size, level: 'normal', tier: 'lite' })).toBe(Math.round(normal / 2));
    expect(particleCount('rain', 2, { ...size, level: 'normal', tier: 'solid' })).toBe(0);
    expect(particleCount('rain', 3, { width: 4000, height: 3000, level: 'rich', tier: 'full' })).toBeLessThanOrEqual(420 * 1.6);
    expect(particleCount('sun', 1, { ...size })).toBe(0);
  });

  it('only animates when it is allowed to', () => {
    expect(canAnimate({ tier: 'full', phone: false, reduced: false })).toBe(true);
    expect(canAnimate({ tier: 'solid', phone: false, reduced: false })).toBe(false);
    expect(canAnimate({ tier: 'full', phone: true, reduced: false })).toBe(false);
    expect(canAnimate({ tier: 'lite', phone: false, reduced: true })).toBe(false);
  });

  it('stops whenever the window cannot be seen or the user turned it off', () => {
    const ok = { enabled: true, reduced: false, visible: true, open: true, sized: true, covered: false, effect: { kind: 'rain' } };
    expect(shouldRun(ok)).toBe(true);
    ['enabled', 'visible', 'open', 'sized'].forEach((key) => expect(shouldRun({ ...ok, [key]: false })).toBe(false));
    expect(shouldRun({ ...ok, reduced: true })).toBe(false);
    expect(shouldRun({ ...ok, covered: true })).toBe(false);
    expect(shouldRun({ ...ok, effect: null })).toBe(false);
  });
});
