import { sunTimes, localParts } from './sun.js';

export const CWA_BASE = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/';
export const TAIPEI_OFFSET = 28800;
export const STATION_RANGE_KM = 15;
export const OBSERVATION_MAX_AGE = 3 * 3600000;
export const STATION_DATASETS = ['O-A0003-001', 'O-A0001-001'];

const GROUPS = {
  sunny: [1],
  'partly-cloudy': [2, 3],
  cloudy: [4],
  overcast: [5, 6, 7],
  'light-rain': [8, 9, 10, 19, 20, 29, 30],
  rain: [11, 12, 13, 14, 31, 32, 37, 38, 39],
  thunderstorm: [15, 16, 17, 18, 21, 22, 33, 34, 35, 36, 41],
  sleet: [23],
  fog: [24, 25, 26, 27, 28],
  snow: [42],
};

const BY_CODE = Object.fromEntries(Object.entries(GROUPS).flatMap(([glyph, codes]) => codes.map((code) => [code, glyph])));
const NIGHT = { sunny: 'clear-night', 'partly-cloudy': 'partly-cloudy-night' };
const MOOD = { sunny: 'clear', 'partly-cloudy': 'clear', cloudy: 'cloudy', overcast: 'cloudy', fog: 'fog', 'light-rain': 'rain', rain: 'rain', sleet: 'snow', snow: 'snow', thunderstorm: 'storm' };

export function cwaDescribe(code, text, { day = true, temperature = null } = {}) {
  const base = BY_CODE[Number(code)] || 'cloudy';
  let glyph = day ? base : NIGHT[base] || base;
  if (day && temperature !== null && temperature >= 35 && (base === 'sunny' || base === 'partly-cloudy')) glyph = 'extreme-heat';
  let mood = MOOD[base] || 'cloudy';
  if (!day && mood === 'clear') mood = 'night';
  return { glyph, text: text || '', mood };
}

function distanceKm(aLat, aLon, bLat, bLon) {
  const dLat = (bLat - aLat) * (Math.PI / 180);
  const dLon = (bLon - aLon) * (Math.PI / 180);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * (Math.PI / 180)) * Math.cos(bLat * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(s));
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > -90 ? n : null;
}

function locationsOf(json) {
  return json?.records?.Locations?.[0]?.Location || [];
}

export function nearestTown(json, lat, lon) {
  let best = null;
  locationsOf(json).forEach((loc) => {
    const tLat = Number(loc.Latitude);
    const tLon = Number(loc.Longitude);
    if (!Number.isFinite(tLat) || !Number.isFinite(tLon)) return;
    const km = distanceKm(lat, lon, tLat, tLon);
    if (!best || km < best.km) best = { name: loc.LocationName, lat: tLat, lon: tLon, km };
  });
  return best;
}

function stationCoords(station) {
  const list = station?.GeoInfo?.Coordinates || [];
  const wgs = list.find((c) => c.CoordinateName === 'WGS84') || list[0];
  return wgs ? { lat: Number(wgs.StationLatitude), lon: Number(wgs.StationLongitude) } : null;
}

export function readStation(station) {
  if (!station) return null;
  const el = station.WeatherElement || {};
  const coords = stationCoords(station);
  const temperature = num(el.AirTemperature);
  const time = Date.parse(station?.ObsTime?.DateTime || '');
  if (temperature === null || !Number.isFinite(time) || !coords) return null;
  return {
    id: station.StationId,
    name: station.StationName,
    lat: coords.lat,
    lon: coords.lon,
    time,
    temperature,
    humidity: num(el.RelativeHumidity),
  };
}

export function nearestStation(jsons, lat, lon, range = STATION_RANGE_KM) {
  let best = null;
  jsons.forEach(({ json, dataset }) => {
    (json?.records?.Station || []).forEach((station) => {
      const reading = readStation(station);
      if (!reading) return;
      const km = distanceKm(lat, lon, reading.lat, reading.lon);
      if (km > range) return;
      if (!best || km < best.km) best = { ...reading, km, dataset };
    });
  });
  return best;
}

export function observationFrom(json, now, lat, lon) {
  const reading = readStation((json?.records?.Station || [])[0]);
  if (!reading || now - reading.time > OBSERVATION_MAX_AGE) return null;
  return { ...reading, km: distanceKm(lat, lon, reading.lat, reading.lon) };
}

function element(loc, name) {
  return (loc.WeatherElement || []).find((el) => el.ElementName === name) || null;
}

function points(el, field) {
  if (!el) return [];
  return el.Time.map((t) => ({ time: Date.parse(t.DataTime), value: t.ElementValue[0][field] }));
}

function blocks(el) {
  if (!el) return [];
  return el.Time.map((t) => ({ start: Date.parse(t.StartTime), end: Date.parse(t.EndTime), value: t.ElementValue[0] }));
}

function at(list, time) {
  if (!list.length) return null;
  let found = list[0];
  list.forEach((p) => { if (p.time <= time) found = p; });
  return found;
}

function blockAt(list, time) {
  if (!list.length) return null;
  return list.find((b) => b.start <= time && time < b.end) || (time < list[0].start ? list[0] : list[list.length - 1]);
}

function sunFor(time, lat, lon) {
  const { year, month, day } = localParts(time, TAIPEI_OFFSET);
  return sunTimes(year, month, day, lat, lon, TAIPEI_OFFSET);
}

function isDay(time, lat, lon) {
  const sun = sunFor(time, lat, lon);
  return sun ? time >= sun.sunrise && time < sun.sunset : true;
}

export function normalizeCwa(shortJson, weekJson, { now = Date.now(), lat, lon }) {
  const town = locationsOf(shortJson)[0];
  const week = locationsOf(weekJson)[0];
  if (!town || !week) return null;
  const temps = points(element(town, '溫度'), 'Temperature');
  const apparent = points(element(town, '體感溫度'), 'ApparentTemperature');
  const humidity = points(element(town, '相對濕度'), 'RelativeHumidity');
  const comfortEl = element(town, '舒適度指數');
  const comfort = comfortEl ? comfortEl.Time.map((t) => ({ time: Date.parse(t.DataTime), value: t.ElementValue[0].ComfortIndexDescription })) : [];
  const wind = points(element(town, '風速'), 'WindSpeed');
  const wx = blocks(element(town, '天氣現象'));
  const pop = blocks(element(town, '3小時降雨機率'));
  const desc = blocks(element(town, '天氣預報綜合描述'));
  if (!temps.length || !wx.length) return null;

  const hourStart = Math.floor(now / 3600000) * 3600000;
  const day = isDay(now, lat, lon);
  const nowWx = blockAt(wx, now);
  const temperature = num(at(temps, now).value);
  const current = {
    time: now,
    temperature,
    apparent: num(at(apparent, now)?.value),
    humidity: num(at(humidity, now)?.value),
    wind: num(at(wind, now)?.value),
    day,
    code: Number(nowWx.value.WeatherCode),
    pop: num(blockAt(pop, now)?.value.ProbabilityOfPrecipitation),
    uv: null,
    comfort: at(comfort, now)?.value || '',
    description: blockAt(desc, now)?.value.WeatherDescription || '',
    ...cwaDescribe(nowWx.value.WeatherCode, nowWx.value.Weather, { day, temperature }),
  };

  const hourly = [];
  for (let i = 0; i < 24; i += 1) {
    const time = hourStart + i * 3600000;
    const point = at(temps, time);
    if (!point || time > temps[temps.length - 1].time + 3600000) break;
    const block = blockAt(wx, time);
    const hourDay = isDay(time, lat, lon);
    const t = num(point.value);
    hourly.push({
      time,
      temperature: t,
      pop: num(blockAt(pop, time)?.value.ProbabilityOfPrecipitation),
      code: Number(block.value.WeatherCode),
      day: hourDay,
      ...cwaDescribe(block.value.WeatherCode, block.value.Weather, { day: hourDay, temperature: t }),
    });
  }

  const maxT = blocks(element(week, '最高溫度'));
  const minT = blocks(element(week, '最低溫度'));
  const weekPop = blocks(element(week, '12小時降雨機率'));
  const weekWx = blocks(element(week, '天氣現象'));
  const weekUv = blocks(element(week, '紫外線指數'));
  const days = new Map();
  weekWx.forEach((block, i) => {
    const parts = localParts(block.start, TAIPEI_OFFSET);
    const key = `${parts.year}-${parts.month}-${parts.day}`;
    const daytime = parts.hour >= 6 && parts.hour < 18;
    const entry = days.get(key) || { parts, max: null, min: null, pop: null, uv: null, code: null, text: '', daytime: false };
    const hi = num(maxT[i]?.value.MaxTemperature);
    const lo = num(minT[i]?.value.MinTemperature);
    const p = num(weekPop[i]?.value.ProbabilityOfPrecipitation);
    if (hi !== null) entry.max = entry.max === null ? hi : Math.max(entry.max, hi);
    if (lo !== null) entry.min = entry.min === null ? lo : Math.min(entry.min, lo);
    if (p !== null) entry.pop = entry.pop === null ? p : Math.max(entry.pop, p);
    if (daytime || entry.code === null) {
      if (daytime || !entry.daytime) {
        entry.code = Number(block.value.WeatherCode);
        entry.text = block.value.Weather;
        entry.daytime = entry.daytime || daytime;
      }
    }
    const uv = weekUv.find((u) => u.start === block.start);
    if (uv) entry.uv = num(uv.value.UVIndex);
    days.set(key, entry);
  });
  const daily = Array.from(days.values()).map((entry) => {
    const midnight = Date.UTC(entry.parts.year, entry.parts.month - 1, entry.parts.day) - TAIPEI_OFFSET * 1000;
    const sun = sunTimes(entry.parts.year, entry.parts.month, entry.parts.day, lat, lon, TAIPEI_OFFSET) || { sunrise: midnight + 6 * 3600000, sunset: midnight + 18 * 3600000 };
    return {
      time: midnight,
      max: entry.max,
      min: entry.min,
      pop: entry.pop,
      uv: entry.uv,
      sunrise: sun.sunrise,
      sunset: sun.sunset,
      code: entry.code,
      ...cwaDescribe(entry.code, entry.text, { day: true, temperature: entry.max }),
    };
  }).filter((d) => d.max !== null && d.min !== null);

  const todayParts = localParts(now, TAIPEI_OFFSET);
  const todayMidnight = Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day) - TAIPEI_OFFSET * 1000;
  if (!daily.length || daily[0].time > todayMidnight) {
    const sun = sunTimes(todayParts.year, todayParts.month, todayParts.day, lat, lon, TAIPEI_OFFSET);
    const todayTemps = temps.filter((p) => p.time >= todayMidnight && p.time < todayMidnight + 86400000).map((p) => num(p.value)).filter((v) => v !== null);
    if (sun && todayTemps.length) {
      daily.unshift({
        time: todayMidnight,
        max: Math.max(...todayTemps),
        min: Math.min(...todayTemps),
        pop: current.pop,
        uv: null,
        sunrise: sun.sunrise,
        sunset: sun.sunset,
        code: current.code,
        ...cwaDescribe(current.code, current.text, { day: true, temperature: Math.max(...todayTemps) }),
      });
    }
  }
  if (daily[0] && daily[0].uv !== null && current.day) current.uv = daily[0].uv;
  if (!current.day) current.uv = 0;

  return { timezone: 'Asia/Taipei', offset: TAIPEI_OFFSET, current, hourly, daily: daily.slice(0, 8) };
}
