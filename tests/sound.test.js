import { describe, expect, it } from 'vitest';
import { KINDS, SOUNDS, canPlay, normalizeSound, outputGain, panFor } from '../src/audio/catalog.js';
import { VOICE_IDS } from '../src/audio/voices.js';

describe('sound catalog', () => {
  it('has a voice for every sound and every sound has a known kind', () => {
    const kinds = new Set(KINDS.map((k) => k.id));
    Object.entries(SOUNDS).forEach(([id, s]) => {
      expect(VOICE_IDS).toContain(id);
      expect(kinds.has(s.kind)).toBe(true);
    });
    expect(VOICE_IDS.length).toBe(Object.keys(SOUNDS).length);
  });

  it('starts muted and keeps unknown fields out', () => {
    const p = normalizeSound(null);
    expect(p.enabled).toBe(false);
    expect(p.asked).toBe(false);
    const q = normalizeSound({ enabled: true, volume: 7, kinds: { pet: false, bogus: false }, extra: 1 });
    expect(q).toEqual({ enabled: true, volume: 1, kinds: { ui: true, window: true, notify: true, pet: false }, asked: false });
  });

  it('decides what may play', () => {
    const on = normalizeSound({ enabled: true });
    expect(canPlay('tap', normalizeSound(null))).toBe(false);
    expect(canPlay('tap', normalizeSound(null), { force: true })).toBe(true);
    expect(canPlay('tap', on)).toBe(true);
    expect(canPlay('nope', on)).toBe(false);
    expect(canPlay('pat', normalizeSound({ enabled: true, kinds: { pet: false } }))).toBe(false);
    expect(canPlay('notify', on, { quiet: true })).toBe(false);
    expect(canPlay('tap', on, { quiet: true })).toBe(true);
    expect(canPlay('tap', normalizeSound({ enabled: true, volume: 0 }))).toBe(false);
  });

  it('ducks to about a third while music plays and pans by window position', () => {
    const p = normalizeSound({ enabled: true, volume: 1 });
    expect(outputGain(p, { ducked: true }) / outputGain(p)).toBeCloseTo(0.3);
    expect(panFor(0, 200, 1000)).toBeLessThan(0);
    expect(panFor(800, 200, 1000)).toBeGreaterThan(0);
    expect(panFor(400, 200, 1000)).toBeCloseTo(0);
    expect(Math.abs(panFor(-500, 10, 1000))).toBeLessThanOrEqual(0.6);
  });
});
