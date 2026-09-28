import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Weather } from '../src/apps/weather/weather.js';
import { COUNTIES, findCounty } from '../src/apps/weather/locations.js';

const NOON = new Date(2026, 8, 28, 12, 0, 0);
const NIGHT = new Date(2026, 8, 28, 22, 0, 0);
const CODES = Array.from({ length: 42 }, (_, i) => i + 1).filter((code) => code !== 40);

const LEGACY_MOOD = (code) => {
  if ([1, 2, 3].includes(code)) return 'clear';
  if ([15, 16, 17, 18, 21, 22, 33, 34, 35, 36, 41].includes(code)) return 'storm';
  if ([8, 9, 10, 11, 12, 13, 14, 19, 20, 23, 29, 30, 31, 32, 37, 38, 39].includes(code)) return 'rain';
  if (code === 42) return 'snow';
  return 'cloudy';
};

describe('weather icons', () => {
  it('maps every CWA weather code to an icon file that exists', () => {
    CODES.forEach((code) => {
      [NOON, NIGHT].forEach((when) => {
        const file = Weather.resolveIconFile(code, 25, when);
        expect(fs.existsSync(path.resolve('public', file)), `${code} -> ${file}`).toBe(true);
      });
    });
  });

  it('switches clear skies to night variants', () => {
    expect(Weather.resolveIconFile(1, 25, NOON)).toBe('weather-icons/sunny.svg');
    expect(Weather.resolveIconFile(1, 25, NIGHT)).toBe('weather-icons/clear-night.svg');
    expect(Weather.resolveIconFile(2, 25, NIGHT)).toBe('weather-icons/partly-cloudy-night.svg');
    expect(Weather.resolveIconFile(11, 25, NIGHT)).toBe('weather-icons/rain.svg');
  });

  it('shows dedicated icons for fog and thunderstorms', () => {
    expect(Weather.resolveIconFile(24, 25, NOON)).toBe('weather-icons/fog.svg');
    expect(Weather.resolveIconFile(15, 25, NOON)).toBe('weather-icons/thunderstorm.svg');
  });

  it('overrides everything with extreme heat at 35 degrees', () => {
    expect(Weather.resolveIconFile(11, 35, NOON)).toBe('weather-icons/extreme-heat.svg');
    expect(Weather.resolveIconFile(1, 34.9, NOON)).toBe('weather-icons/sunny.svg');
  });

  it('keeps background moods identical to the previous mapping', () => {
    CODES.forEach((code) => {
      expect(Weather.resolveMood(code, NOON), `code ${code}`).toBe(LEGACY_MOOD(code));
      expect(Weather.resolveMood(code, NIGHT), `code ${code}`).toBe(`${LEGACY_MOOD(code)}-night`);
    });
  });
});

describe('weather locations', () => {
  it('covers all 22 counties with paired dataset ids', () => {
    expect(COUNTIES).toHaveLength(22);
    COUNTIES.forEach((county) => {
      const shortTerm = Number(county.shortTermId.slice(-3));
      expect(Number(county.weeklyId.slice(-3))).toBe(shortTerm + 2);
      expect(shortTerm % 4).toBe(1);
    });
    expect(new Set(COUNTIES.map((c) => c.shortTermId)).size).toBe(22);
  });

  it('matches known dataset ids', () => {
    expect(findCounty('宜蘭縣').shortTermId).toBe('F-D0047-001');
    expect(findCounty('臺北市').shortTermId).toBe('F-D0047-061');
    expect(findCounty('臺中市').shortTermId).toBe('F-D0047-073');
    expect(findCounty('金門縣').weeklyId).toBe('F-D0047-087');
    expect(findCounty('不存在')).toBeNull();
  });
});
