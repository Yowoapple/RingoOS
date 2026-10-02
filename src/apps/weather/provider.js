import { Storage } from '../../core/storage/storage.js';
import { COUNTIES, findCounty } from './locations.js';
import { STATION_DATASETS, nearestStation, nearestTown, normalizeCwa, observationFrom } from './cwa.js';

export const LOCATION_KEY = 'yoworingo.v2.weather-location';
export const CACHE_KEY = 'yoworingo.v2.weather-cache';
export const AUTH_KEY = 'yoworingo.cwa-auth-key';
export const REFRESH_MS = 30 * 60 * 1000;
const CACHE_VERSION = 1;
const HEAT = 35;
const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search';
const PHOTON = 'https://photon.komoot.io/api/';
const CWA = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/';
const ALERT_DATASET = 'W-C0033-001';

const WMO = {
  0: ['sunny', '晴朗'],
  1: ['partly-cloudy', '大致晴朗'],
  2: ['cloudy', '多雲'],
  3: ['overcast', '陰天'],
  45: ['fog', '有霧'],
  48: ['fog', '霧淞'],
  51: ['light-rain', '毛毛雨'],
  53: ['light-rain', '毛毛雨'],
  55: ['light-rain', '濃毛毛雨'],
  56: ['sleet', '凍毛毛雨'],
  57: ['sleet', '凍毛毛雨'],
  61: ['light-rain', '小雨'],
  63: ['rain', '中雨'],
  65: ['rain', '大雨'],
  66: ['sleet', '凍雨'],
  67: ['sleet', '強凍雨'],
  71: ['snow', '小雪'],
  73: ['snow', '中雪'],
  75: ['snow', '大雪'],
  77: ['snow', '米雪'],
  80: ['light-rain', '短暫陣雨'],
  81: ['rain', '陣雨'],
  82: ['rain', '強陣雨'],
  85: ['snow', '陣雪'],
  86: ['snow', '強陣雪'],
  95: ['thunderstorm', '雷雨'],
  96: ['thunderstorm', '雷雨夾冰雹'],
  99: ['thunderstorm', '強雷雨夾冰雹'],
};

const NIGHT = { sunny: 'clear-night', 'partly-cloudy': 'partly-cloudy-night' };

const MOOD = {
  sunny: 'clear',
  'partly-cloudy': 'clear',
  cloudy: 'cloudy',
  overcast: 'cloudy',
  fog: 'fog',
  'light-rain': 'rain',
  rain: 'rain',
  sleet: 'snow',
  snow: 'snow',
  thunderstorm: 'storm',
};

const PLACE_RANK = { city: 0, province: 0, state: 0, municipality: 1, town: 1, county: 2, borough: 2, city_district: 2, district: 2, suburb: 3, village: 4 };
const GEONAMES_RANK = { PPLC: 0, PPLA: 0, PPLA2: 1, PPLA3: 2, PPLA4: 3, PPL: 3, ADM1: 1, ADM2: 2, ADM3: 3 };

export function describe(code, { day = true, temperature = null } = {}) {
  const [base, text] = WMO[code] || ['cloudy', '多雲'];
  let glyph = day ? base : NIGHT[base] || base;
  if (temperature !== null && temperature >= HEAT && (base === 'sunny' || base === 'partly-cloudy') && day) glyph = 'extreme-heat';
  let mood = MOOD[base] || 'cloudy';
  if (!day && mood === 'clear') mood = 'night';
  return { glyph, text: glyph === 'extreme-heat' ? '炎熱' : text, mood };
}

export function uvLevel(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const v = Number(value);
  if (v < 3) return { text: '低', level: 'low' };
  if (v < 6) return { text: '中', level: 'moderate' };
  if (v < 8) return { text: '高', level: 'high' };
  if (v < 11) return { text: '過量', level: 'very-high' };
  return { text: '危險', level: 'extreme' };
}

export function forecastUrl(location) {
  const params = new URLSearchParams({
    latitude: location.lat.toFixed(4),
    longitude: location.lon.toFixed(4),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,is_day,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,weather_code,precipitation_probability,is_day,uv_index',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max',
    timezone: 'auto',
    timeformat: 'unixtime',
    forecast_days: '8',
    forecast_hours: '25',
  });
  return `${FORECAST}?${params}`;
}

export function normalizeForecast(json) {
  const c = json.current;
  const h = json.hourly;
  const d = json.daily;
  const hourIndex = Math.max(0, h.time.findIndex((t, i) => t <= c.time && (h.time[i + 1] === undefined || h.time[i + 1] > c.time)));
  const current = {
    time: c.time * 1000,
    temperature: c.temperature_2m,
    apparent: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    wind: c.wind_speed_10m ?? null,
    day: c.is_day === 1,
    code: c.weather_code,
    pop: h.precipitation_probability ? h.precipitation_probability[hourIndex] ?? null : null,
    uv: h.uv_index ? h.uv_index[hourIndex] ?? null : null,
    ...describe(c.weather_code, { day: c.is_day === 1, temperature: c.temperature_2m }),
  };
  const hourly = h.time.slice(hourIndex, hourIndex + 24).map((t, k) => {
    const i = hourIndex + k;
    const day = h.is_day ? h.is_day[i] === 1 : true;
    return {
      time: t * 1000,
      temperature: h.temperature_2m[i],
      pop: h.precipitation_probability ? h.precipitation_probability[i] : null,
      code: h.weather_code[i],
      day,
      ...describe(h.weather_code[i], { day, temperature: h.temperature_2m[i] }),
    };
  });
  const daily = d.time.map((t, i) => ({
    time: t * 1000,
    max: d.temperature_2m_max[i],
    min: d.temperature_2m_min[i],
    pop: d.precipitation_probability_max ? d.precipitation_probability_max[i] : null,
    uv: d.uv_index_max ? d.uv_index_max[i] : null,
    sunrise: d.sunrise[i] * 1000,
    sunset: d.sunset[i] * 1000,
    code: d.weather_code[i],
    ...describe(d.weather_code[i], { day: true, temperature: d.temperature_2m_max[i] }),
  }));
  return { timezone: json.timezone, offset: json.utc_offset_seconds, current, hourly, daily };
}

function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(s));
}

export function fromPhoton(feature) {
  const p = feature.properties || {};
  const [lon, lat] = feature.geometry.coordinates;
  const rank = PLACE_RANK[p.osm_value];
  if (rank === undefined || !p.name) return null;
  const region = [p.county, p.city, p.state].filter((part) => part && part !== p.name)[0] || '';
  return {
    name: p.name,
    region,
    country: p.country || '',
    countryCode: (p.countrycode || '').toUpperCase(),
    lat,
    lon,
    county: p.countrycode && p.countrycode.toUpperCase() === 'TW' ? (p.county || p.city || (p.osm_value === 'city' ? p.name : '')) : '',
    rank,
    source: 'photon',
  };
}

export function fromGeonames(result) {
  const rank = GEONAMES_RANK[result.feature_code];
  if (rank === undefined) return null;
  const tw = result.country_code === 'TW';
  return {
    name: result.name,
    region: (tw ? result.admin2 : result.admin1) || result.admin1 || '',
    country: result.country || '',
    countryCode: result.country_code || '',
    lat: result.latitude,
    lon: result.longitude,
    county: tw ? result.admin2 || '' : '',
    rank: rank + (result.population ? 0 : 0.5),
    source: 'geonames',
  };
}

export function mergePlaces(lists, limit = 8) {
  const merged = [];
  lists.flat().filter(Boolean).forEach((place) => {
    const twin = merged.find((other) => {
      const nested = other.name.includes(place.name) || place.name.includes(other.name);
      return nested && distanceKm(other, place) < (other.name === place.name ? 6 : 40);
    });
    if (twin) {
      if (place.source === 'photon' && twin.source !== 'photon') Object.assign(twin, { ...place, rank: Math.min(twin.rank, place.rank) });
      else twin.rank = Math.min(twin.rank, place.rank);
      return;
    }
    merged.push({ ...place });
  });
  return merged
    .map((place, index) => ({ place, index }))
    .sort((a, b) => a.place.rank - b.place.rank || a.index - b.index)
    .slice(0, limit)
    .map(({ place }) => place);
}

export function normalizeCounty(name) {
  if (!name) return null;
  const fixed = name.replace(/台/g, '臺').replace(/县/g, '縣').replace(/云/g, '雲').replace(/东/g, '東').replace(/兰/g, '蘭').replace(/莲/g, '蓮').replace(/门/g, '門').replace(/连/g, '連').replace(/义/g, '義').replace(/园/g, '園');
  const hit = COUNTIES.find((county) => county.name === fixed || fixed.startsWith(county.name));
  return hit ? hit.name : null;
}

export function nearestCounty(lat, lon) {
  let best = null;
  let bestDistance = Infinity;
  COUNTIES.forEach((county) => {
    const distance = distanceKm({ lat, lon }, county);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = county;
    }
  });
  return best ? best.name : null;
}

export function parseAlerts(json, countyName) {
  const locations = json?.records?.location || json?.records?.locations?.[0]?.location || [];
  const matched = locations.find((loc) => normalizeCounty(loc.locationName || '') === countyName);
  if (!matched) return [];
  const hazards = matched?.hazardConditions?.hazards || matched?.hazardConditions || [];
  if (!Array.isArray(hazards)) return [];
  return hazards.map((hazard) => {
    const info = hazard.info || hazard;
    const valid = hazard.validTime || info.validTime || {};
    return {
      phenomena: info.phenomena || '',
      significance: info.significance || '',
      until: valid.endTime || null,
    };
  }).filter((alert) => alert.phenomena);
}

const TIMEOUT_MS = 15000;

async function getJson(url, signal) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), TIMEOUT_MS);
  const forward = () => controller.abort(signal.reason);
  if (signal) {
    if (signal.aborted) forward();
    else signal.addEventListener('abort', forward, { once: true });
  }
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } catch (err) {
    if (signal && signal.aborted) {
      const aborted = new Error('aborted');
      aborted.name = 'AbortError';
      throw aborted;
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', forward);
  }
}

export async function searchPlaces(query, signal) {
  const text = query.trim();
  if (text.length < 2) return [];
  const photon = (q) => getJson(`${PHOTON}?${new URLSearchParams({ q, limit: '10', lang: 'default', osm_tag: 'place' })}`, signal)
    .then((json) => (json.features || []).map(fromPhoton))
    .catch((err) => { if (err.name === 'AbortError') throw err; return []; });
  const geonames = getJson(`${GEOCODE}?${new URLSearchParams({ name: text, count: '8', language: 'zh', format: 'json' })}`, signal)
    .then((json) => (json.results || []).map(fromGeonames))
    .catch((err) => { if (err.name === 'AbortError') throw err; return []; });
  const variants = [photon(text)];
  if (/台/.test(text)) variants.push(photon(text.replace(/台/g, '臺')));
  else if (/臺/.test(text)) variants.push(photon(text.replace(/臺/g, '台')));
  const lists = await Promise.all([...variants, geonames]);
  return mergePlaces(lists);
}

export function getLocation() {
  const value = Storage.get(LOCATION_KEY, null);
  return value && Number.isFinite(value.lat) && Number.isFinite(value.lon) ? value : null;
}

export function setLocation(place) {
  const county = place.countryCode === 'TW' ? normalizeCounty(place.county) || nearestCounty(place.lat, place.lon) : null;
  const value = { name: place.name, region: place.region, country: place.country, countryCode: place.countryCode, lat: place.lat, lon: place.lon, county };
  Storage.set(LOCATION_KEY, value);
  return value;
}

export function getAuthKey() {
  return String(Storage.get(AUTH_KEY, '') || '');
}

export function setAuthKey(key) {
  if (key) Storage.set(AUTH_KEY, key.trim());
  else Storage.remove(AUTH_KEY);
}

export async function testAuthKey(key) {
  const json = await getJson(`${CWA}${ALERT_DATASET}?Authorization=${encodeURIComponent(key.trim())}&format=JSON`);
  return json && json.success !== 'false';
}

function readCache(location) {
  const cache = Storage.get(CACHE_KEY, null);
  if (!cache || cache.version !== CACHE_VERSION || !location) return null;
  if (Math.abs(cache.lat - location.lat) > 0.0005 || Math.abs(cache.lon - location.lon) > 0.0005) return null;
  return cache;
}

function cwaUrl(dataset, key, params = {}) {
  return `${CWA}${dataset}?${new URLSearchParams({ ...params, Authorization: key, format: 'JSON' })}`;
}

async function resolveCwa(location, key) {
  if (location.cwa && location.cwa.version === 1) return location.cwa;
  const county = findCounty(location.county);
  if (!county) throw new Error('county');
  const [countyJson, ...stationJsons] = await Promise.all([
    getJson(cwaUrl(county.shortTermId, key, { ElementName: '溫度' })),
    ...STATION_DATASETS.map((dataset) => getJson(cwaUrl(dataset, key)).then((json) => ({ json, dataset })).catch(() => null)),
  ]);
  const town = nearestTown(countyJson, location.lat, location.lon);
  if (!town) throw new Error('town');
  const station = nearestStation(stationJsons.filter(Boolean), location.lat, location.lon);
  const cwa = {
    version: 1,
    town: town.name,
    station: station ? { id: station.id, name: station.name, dataset: station.dataset } : null,
  };
  const stored = getLocation();
  if (stored && stored.lat === location.lat && stored.lon === location.lon) Storage.set(LOCATION_KEY, { ...stored, cwa });
  return cwa;
}

async function loadCwa(location, key) {
  const county = findCounty(location.county);
  const cwa = await resolveCwa(location, key);
  const [shortJson, weekJson, observation, alerts] = await Promise.all([
    getJson(cwaUrl(county.shortTermId, key, { LocationName: cwa.town })),
    getJson(cwaUrl(county.weeklyId, key, { LocationName: cwa.town })),
    cwa.station ? getJson(cwaUrl(cwa.station.dataset, key, { StationId: cwa.station.id })).catch(() => null) : Promise.resolve(null),
    getJson(cwaUrl(ALERT_DATASET, key)).then((raw) => parseAlerts(raw, location.county)).catch(() => null),
  ]);
  const now = Date.now();
  const data = normalizeCwa(shortJson, weekJson, { now, lat: location.lat, lon: location.lon });
  if (!data) throw new Error('parse');
  data.source = 'cwa';
  data.town = cwa.town;
  data.observed = observation ? observationFrom(observation, now, location.lat, location.lon) : null;
  return { data, alerts };
}

async function loadOpenMeteo(location, key) {
  const wantsAlerts = location.countryCode === 'TW' && key && location.county;
  const [json, alerts] = await Promise.all([
    getJson(forecastUrl(location)),
    wantsAlerts ? getJson(cwaUrl(ALERT_DATASET, key)).then((raw) => parseAlerts(raw, location.county)).catch(() => null) : Promise.resolve([]),
  ]);
  const data = normalizeForecast(json);
  data.source = 'open-meteo';
  return { data, alerts };
}

export async function loadWeather({ force = false } = {}) {
  const location = getLocation();
  if (!location) return { status: 'setup' };
  const cache = readCache(location);
  const key = getAuthKey();
  const wantsCwa = location.countryCode === 'TW' && !!key && !!findCounty(location.county);
  const cacheMatches = cache && (cache.data.source === 'cwa') === wantsCwa;
  if (!force && cacheMatches && Date.now() - cache.fetchedAt < REFRESH_MS) {
    return { status: 'ok', location, data: cache.data, alerts: cache.alerts || [], fetchedAt: cache.fetchedAt, offline: false, fallback: !!cache.fallback };
  }
  let fallback = false;
  try {
    let loaded = null;
    if (wantsCwa) {
      try {
        loaded = await loadCwa(location, key);
      } catch (err) {
        fallback = true;
      }
    }
    if (!loaded) loaded = await loadOpenMeteo(location, key);
    const fetchedAt = Date.now();
    Storage.set(CACHE_KEY, { version: CACHE_VERSION, lat: location.lat, lon: location.lon, fetchedAt, data: loaded.data, alerts: loaded.alerts || [], fallback });
    return { status: 'ok', location: getLocation() || location, data: loaded.data, alerts: loaded.alerts || [], alertsFailed: loaded.alerts === null, fetchedAt, offline: false, fallback };
  } catch (err) {
    if (cache) return { status: 'ok', location, data: cache.data, alerts: cache.alerts || [], fetchedAt: cache.fetchedAt, offline: true, fallback: !!cache.fallback };
    return { status: 'error', location, error: err };
  }
}
