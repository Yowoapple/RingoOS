import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cwaDescribe, nearestStation, nearestTown, normalizeCwa, observationFrom } from '../src/apps/weather/cwa.js';
import { sunTimes } from '../src/apps/weather/sun.js';
import { parseAlerts } from '../src/apps/weather/provider.js';

const load = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const HUWEI = { lat: 23.708182, lon: 120.445339 };
const NOW = Date.parse('2026-10-02T10:30:00+08:00');

describe('sun', () => {
  it('lands sunrise on the local day even when it is still the previous day in UTC', () => {
    const sun = sunTimes(2026, 10, 2, 23.71, 120.44, 28800);
    expect(Math.abs(sun.sunrise - 1790891420000)).toBeLessThan(3 * 60000);
    expect(Math.abs(sun.sunset - 1790934293000)).toBeLessThan(3 * 60000);
  });
});

describe('cwa codes', () => {
  it('maps CWA weather codes to glyphs and keeps the official wording', () => {
    expect(cwaDescribe('01', '晴', { day: true })).toEqual({ glyph: 'sunny', text: '晴', mood: 'clear' });
    expect(cwaDescribe('01', '晴', { day: false }).glyph).toBe('clear-night');
    expect(cwaDescribe('19', '晴午後短暫雷陣雨').glyph).toBe('light-rain');
    expect(cwaDescribe('15', '雷陣雨').mood).toBe('storm');
    expect(cwaDescribe('99', '').glyph).toBe('cloudy');
  });
});

describe('cwa places', () => {
  it('finds the nearest township in the county forecast', () => {
    expect(nearestTown(load('cwa-county'), HUWEI.lat, HUWEI.lon).name).toBe('虎尾鎮');
    expect(nearestTown(load('cwa-county'), 23.70, 120.53).name).toBe('斗六市');
  });

  it('picks the closest working station within range and skips broken readings', () => {
    const near = nearestStation([{ json: load('cwa-stations-a3'), dataset: 'O-A0003-001' }, { json: load('cwa-stations-a1'), dataset: 'O-A0001-001' }], HUWEI.lat, HUWEI.lon);
    expect(near.km).toBeLessThan(15);
    expect(near.temperature).toBeGreaterThan(20);
    expect(nearestStation([{ json: load('cwa-stations-a1'), dataset: 'O-A0001-001' }], 25.03, 121.56)).toBe(null);
  });

  it('only trusts fresh observations', () => {
    const json = load('cwa-stations-a1');
    json.records.Station = [json.records.Station[0]];
    expect(observationFrom(json, NOW, HUWEI.lat, HUWEI.lon).temperature).toBe(30.2);
    expect(observationFrom(json, NOW + 4 * 3600000, HUWEI.lat, HUWEI.lon)).toBe(null);
  });
});

describe('cwa forecast', () => {
  const data = normalizeCwa(load('cwa-short'), load('cwa-week'), { now: NOW, ...HUWEI });

  it('builds the same shape as Open-Meteo with official text', () => {
    expect(data.timezone).toBe('Asia/Taipei');
    expect(typeof data.current.temperature).toBe('number');
    expect(data.current.text.length).toBeGreaterThan(0);
    expect(data.current.description).toContain('降雨機率');
    expect(data.current.comfort.length).toBeGreaterThan(0);
    expect(data.current.day).toBe(true);
  });

  it('fills 24 hourly slots starting at the current hour', () => {
    expect(data.hourly.length).toBe(24);
    expect(data.hourly[0].time).toBe(Date.parse('2026-10-02T10:00:00+08:00'));
    expect(data.hourly.every((hour) => typeof hour.temperature === 'number')).toBe(true);
  });

  it('folds day and night halves into one entry per day', () => {
    expect(data.daily.length).toBeGreaterThanOrEqual(6);
    const today = data.daily[0];
    expect(today.time).toBe(Date.parse('2026-10-02T00:00:00+08:00'));
    expect(today.max).toBeGreaterThanOrEqual(today.min);
    expect(today.sunrise).toBeLessThan(today.sunset);
    expect(new Set(data.daily.map((d) => d.time)).size).toBe(data.daily.length);
  });
});

describe('cwa alerts fixture', () => {
  it('reads real alert records', () => {
    const json = load('cwa-alert');
    const withHazard = json.records.location.find((loc) => loc.hazardConditions.hazards.length);
    if (!withHazard) return;
    const alerts = parseAlerts(json, withHazard.locationName.replace(/台/g, '臺'));
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].phenomena.length).toBeGreaterThan(0);
  });
});
