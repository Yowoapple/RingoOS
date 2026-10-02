import { describe, expect, it } from 'vitest';
import { COUNTIES, findCounty } from '../src/apps/weather/locations.js';

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
