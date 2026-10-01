import { describe, expect, it } from 'vitest';
import { describe as describeCode, forecastUrl, fromGeonames, fromPhoton, mergePlaces, nearestCounty, normalizeCounty, normalizeForecast, parseAlerts, uvLevel } from '../src/apps/weather/provider.js';

const NOW = 1790876700;
const HOUR = 1790874000;

function fixture() {
  const hours = Array.from({ length: 25 }, (_, i) => HOUR + i * 3600);
  return {
    timezone: 'Asia/Taipei',
    utc_offset_seconds: 28800,
    current: { time: NOW, interval: 900, temperature_2m: 24.9, apparent_temperature: 30.5, relative_humidity_2m: 93, is_day: 0, weather_code: 0, wind_speed_10m: 4.2 },
    hourly: {
      time: hours,
      temperature_2m: hours.map((_, i) => 25 + i * 0.1),
      weather_code: hours.map((_, i) => (i < 10 ? 0 : 61)),
      precipitation_probability: hours.map((_, i) => i * 2),
      is_day: hours.map((_, i) => (i > 4 && i < 17 ? 1 : 0)),
      uv_index: hours.map(() => 0),
    },
    daily: {
      time: [1790870400, 1790956800],
      weather_code: [51, 3],
      temperature_2m_max: [31.2, 30],
      temperature_2m_min: [24.1, 23.8],
      sunrise: [1790891420, 1790977840],
      sunset: [1790934293, 1791020640],
      uv_index_max: [7.8, 6],
      precipitation_probability_max: [87, 20],
    },
  };
}

describe('weather codes', () => {
  it('maps WMO codes to glyphs, text and moods with night variants', () => {
    expect(describeCode(0, { day: true })).toEqual({ glyph: 'sunny', text: '晴朗', mood: 'clear' });
    expect(describeCode(0, { day: false })).toEqual({ glyph: 'clear-night', text: '晴朗', mood: 'night' });
    expect(describeCode(2, { day: false }).glyph).toBe('cloudy');
    expect(describeCode(65).mood).toBe('rain');
    expect(describeCode(95).glyph).toBe('thunderstorm');
    expect(describeCode(1234).glyph).toBe('cloudy');
  });

  it('flags extreme heat only on clear days', () => {
    expect(describeCode(0, { day: true, temperature: 36 }).glyph).toBe('extreme-heat');
    expect(describeCode(63, { day: true, temperature: 36 }).glyph).toBe('rain');
  });

  it('grades the UV index', () => {
    expect(uvLevel(2.9).level).toBe('low');
    expect(uvLevel(7.8).level).toBe('high');
    expect(uvLevel(11).level).toBe('extreme');
    expect(uvLevel(null)).toBe(null);
  });
});

describe('forecast', () => {
  it('asks Open-Meteo for local time and unix timestamps', () => {
    const url = forecastUrl({ lat: 23.70123, lon: 120.43 });
    expect(url).toContain('timezone=auto');
    expect(url).toContain('timeformat=unixtime');
    expect(url).toContain('latitude=23.7012');
  });

  it('normalizes current, the next 24 hours and the days ahead', () => {
    const data = normalizeForecast(fixture());
    expect(data.timezone).toBe('Asia/Taipei');
    expect(data.current).toMatchObject({ temperature: 24.9, apparent: 30.5, humidity: 93, day: false, glyph: 'clear-night', pop: 0, uv: 0 });
    expect(data.hourly).toHaveLength(24);
    expect(data.hourly[0].time).toBe(HOUR * 1000);
    expect(data.hourly[12].glyph).toBe('light-rain');
    expect(data.daily[0]).toMatchObject({ max: 31.2, min: 24.1, pop: 87, uv: 7.8, sunrise: 1790891420000, glyph: 'light-rain' });
  });
});

describe('places', () => {
  const photon = (name, osm, extra = {}) => ({ geometry: { coordinates: [extra.lon ?? 120.43, extra.lat ?? 23.7] }, properties: { name, osm_value: osm, countrycode: extra.cc ?? 'TW', country: '臺灣', county: extra.county, city: extra.city } });

  it('keeps real places and drops points of interest', () => {
    expect(fromPhoton(photon('虎尾鎮', 'town', { county: '雲林縣' }))).toMatchObject({ name: '虎尾鎮', region: '雲林縣', county: '雲林縣', rank: 1 });
    expect(fromPhoton(photon('臺中市', 'city'))).toMatchObject({ county: '臺中市', rank: 0 });
    expect(fromPhoton(photon('台中之鑽', 'construction'))).toBe(null);
    expect(fromPhoton(photon('虎尾寮', 'hamlet'))).toBe(null);
  });

  it('merges both geocoders, prefers OpenStreetMap names and ranks cities first', () => {
    const a = fromPhoton(photon('虎尾鎮', 'town', { county: '雲林縣' }));
    const b = fromGeonames({ name: '虎尾', admin1: '臺灣省 or 台灣省', admin2: '雲林縣', country: '台湾', country_code: 'TW', feature_code: 'PPL', latitude: 23.708, longitude: 120.432 });
    const c = fromGeonames({ name: '倫敦', admin1: '英格兰', country: '英国', country_code: 'GB', feature_code: 'PPLC', latitude: 51.5, longitude: -0.12, population: 8961989 });
    const merged = mergePlaces([[a], [b, c]]);
    expect(merged.map((place) => place.name)).toEqual(['倫敦', '虎尾鎮']);
    expect(merged[1].source).toBe('photon');
  });

  it('matches Taiwan counties across character variants and by distance', () => {
    expect(normalizeCounty('台中市')).toBe('臺中市');
    expect(normalizeCounty('云林县')).toBe('雲林縣');
    expect(normalizeCounty('Tokyo')).toBe(null);
    expect(nearestCounty(23.708, 120.432)).toBe('雲林縣');
  });
});

describe('cwa alerts', () => {
  it('reads hazards for the county and ignores others', () => {
    const json = { records: { location: [
      { locationName: '雲林縣', hazardConditions: { hazards: [{ info: { phenomena: '大雨', significance: '特報' }, validTime: { endTime: '2026-10-02 23:00:00' } }] } },
      { locationName: '臺北市', hazardConditions: { hazards: [{ info: { phenomena: '強風' } }] } },
    ] } };
    expect(parseAlerts(json, '雲林縣')).toEqual([{ phenomena: '大雨', significance: '特報', until: '2026-10-02 23:00:00' }]);
    expect(parseAlerts(json, '嘉義縣')).toEqual([]);
    expect(parseAlerts({}, '雲林縣')).toEqual([]);
  });
});
