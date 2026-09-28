import { Storage } from '../../core/storage/storage.js';
import { COUNTIES, findCounty } from './locations.js';

const AUTH_KEY_STORAGE = 'yoworingo.cwa-auth-key';
const CACHE_KEY = 'yoworingo.weather-cache';
const LOCATION_KEY = 'yoworingo.weather-location';
const CACHE_VERSION = 2;
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

const EXTREME_HEAT_THRESHOLD = 35;

const ALERT_DATASET_ID = 'W-C0033-001';

const ICON_BASE_PATH = 'weather-icons/';

const ICON_GROUPS = {
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

const WX_CODE_TO_ICON = Object.fromEntries(
  Object.entries(ICON_GROUPS).flatMap(([icon, codes]) => codes.map((code) => [code, icon]))
);

const NIGHT_VARIANTS = { sunny: 'clear-night', 'partly-cloudy': 'partly-cloudy-night' };

const MOOD_BY_ICON = {
  sunny: 'clear',
  'partly-cloudy': 'clear',
  thunderstorm: 'storm',
  'light-rain': 'rain',
  rain: 'rain',
  sleet: 'rain',
  snow: 'snow',
};

function isNightTime(date) {
  const hour = date.getHours();
  return hour >= 18 || hour < 6;
}

function resolveIconFile(weatherCode, temperature, referenceDate) {
  let icon = WX_CODE_TO_ICON[weatherCode] || 'cloudy';

  if (NIGHT_VARIANTS[icon] && isNightTime(referenceDate)) {
    icon = NIGHT_VARIANTS[icon];
  }

  if (temperature !== null && temperature >= EXTREME_HEAT_THRESHOLD) {
    icon = 'extreme-heat';
  }

  return `${ICON_BASE_PATH}${icon}.svg`;
}

function getLocation() {
  try {
    const raw = Storage.get(LOCATION_KEY, null);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || !findCounty(parsed.county) || !parsed.town) return null;
    return { county: parsed.county, town: parsed.town };
  } catch (err) {
    return null;
  }
}

function setLocation(county, town) {
  if (!findCounty(county) || !town) throw new Error('請選擇有效的縣市與鄉鎮');
  Storage.set(LOCATION_KEY, JSON.stringify({ county, town }));
  Storage.remove(CACHE_KEY);
}

function locationKey(location) {
  return location ? `${location.county}/${location.town}` : '';
}

function computeSunTimes(date, lat, lon) {
  const rad = Math.PI / 180;
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date - start) / 86400000);

  const zenith = 90.833;
  const lngHour = lon / 15;

  function calc(isSunrise) {
    const t = dayOfYear + ((isSunrise ? 6 : 18) - lngHour) / 24;
    const meanAnomaly = (0.9856 * t) - 3.289;
    let trueLongitude = meanAnomaly + (1.916 * Math.sin(meanAnomaly * rad))
      + (0.020 * Math.sin(2 * meanAnomaly * rad)) + 282.634;
    trueLongitude = ((trueLongitude % 360) + 360) % 360;

    let rightAscension = Math.atan(0.91764 * Math.tan(trueLongitude * rad)) / rad;
    rightAscension = ((rightAscension % 360) + 360) % 360;
    const longitudeQuadrant = Math.floor(trueLongitude / 90) * 90;
    const raQuadrant = Math.floor(rightAscension / 90) * 90;
    rightAscension = rightAscension + (longitudeQuadrant - raQuadrant);
    rightAscension /= 15;

    const sinDeclination = 0.39782 * Math.sin(trueLongitude * rad);
    const cosDeclination = Math.cos(Math.asin(sinDeclination));
    const cosHourAngle = (Math.cos(zenith * rad) - (sinDeclination * Math.sin(lat * rad)))
      / (cosDeclination * Math.cos(lat * rad));

    if (cosHourAngle > 1 || cosHourAngle < -1) return null;

    let hourAngle = isSunrise
      ? 360 - (Math.acos(cosHourAngle) / rad)
      : (Math.acos(cosHourAngle) / rad);
    hourAngle /= 15;

    const localMeanTime = hourAngle + rightAscension - (0.06571 * t) - 6.622;
    let utcTime = localMeanTime - lngHour;
    utcTime = ((utcTime % 24) + 24) % 24;

    const result = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    result.setUTCHours(0, 0, 0, 0);
    result.setUTCMilliseconds(utcTime * 3600000);
    return result;
  }

  const sunrise = calc(true);
  const sunset = calc(false);
  if (!sunrise || !sunset) return null;
  return { sunrise, sunset };
}

function resolveMood(weatherCode, referenceDate) {
  const icon = WX_CODE_TO_ICON[weatherCode] || 'cloudy';
  const mood = MOOD_BY_ICON[icon] || 'cloudy';
  return isNightTime(referenceDate) ? `${mood}-night` : mood;
}

function uviLevelInfo(uvi) {
  const value = Number(uvi);
  if (uvi === null || uvi === undefined || Number.isNaN(value)) return null;
  if (value < 3) return { text: '低量級', level: 'low' };
  if (value < 6) return { text: '中量級', level: 'moderate' };
  if (value < 8) return { text: '高量級', level: 'high' };
  if (value < 11) return { text: '過量級', level: 'very-high' };
  return { text: '危險級', level: 'extreme' };
}

function getAuthKey() {
  try { return Storage.get(AUTH_KEY_STORAGE, null) || ''; } catch (err) { return ''; }
}
function setAuthKey(key) {
  try { Storage.set(AUTH_KEY_STORAGE, key.trim()); } catch (err) {}
}

function getCache() {
  try {
    const raw = Storage.get(CACHE_KEY, null);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}
function setCacheFor(location, data) {
  try {
    Storage.set(CACHE_KEY, JSON.stringify({ version: CACHE_VERSION, location: locationKey(location), fetchedAt: Date.now(), data }));
  } catch (err) {}
}
function isCacheFresh(cache, location) {
  return !!cache
    && cache.version === CACHE_VERSION
    && cache.location === locationKey(location)
    && (Date.now() - cache.fetchedAt) < REFRESH_INTERVAL_MS;
}

async function fetchDataset(datasetId, authKey) {
  const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/${datasetId}?Authorization=${encodeURIComponent(authKey)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`氣象署 API 回應錯誤（${response.status}）`);
  }
  return response.json();
}

function findTownRecord(json, townName) {
  const locations = json.records.Locations[0].Location;
  return locations.find((loc) => loc.LocationName === townName) || null;
}

function findElement(townRecord, elementName) {
  return townRecord.WeatherElement.find((e) => e.ElementName === elementName) || null;
}

function parseShortTerm(json, location, county) {
  const town = findTownRecord(json, location.town);
  if (!town) return null;

  const wxElement = findElement(town, '天氣現象');
  const tempElement = findElement(town, '溫度');
  const apparentElement = findElement(town, '體感溫度');
  const comfortElement = findElement(town, '舒適度指數');
  const popElement = findElement(town, '3小時降雨機率');
  const descElement = findElement(town, '天氣預報綜合描述');
  const uviElement = findElement(town, '紫外線指數');

  const now = new Date();

  const currentWxBlock = wxElement.Time.find((t) => {
    return new Date(t.StartTime) <= now && now < new Date(t.EndTime);
  }) || wxElement.Time[0];

  const currentTemp = tempElement.Time.find((t) => new Date(t.DataTime) >= now) || tempElement.Time[0];
  const currentApparent = apparentElement.Time.find((t) => new Date(t.DataTime) >= now) || apparentElement.Time[0];
  const currentComfort = comfortElement.Time.find((t) => new Date(t.DataTime) >= now) || comfortElement.Time[0];
  const currentPop = popElement.Time.find((t) => new Date(t.StartTime) <= now && now < new Date(t.EndTime)) || popElement.Time[0];
  const currentDesc = descElement.Time.find((t) => new Date(t.StartTime) <= now && now < new Date(t.EndTime)) || descElement.Time[0];

  const weatherCode = parseInt(currentWxBlock.ElementValue[0].WeatherCode, 10);
  const temperature = parseFloat(currentTemp.ElementValue[0].Temperature);

  const currentUvi = uviElement
    ? (uviElement.Time.find((t) => new Date(t.StartTime) <= now && now < new Date(t.EndTime)) || uviElement.Time[0])
    : null;

  return {
    townName: location.town,
    weatherText: currentWxBlock.ElementValue[0].Weather,
    weatherCode,
    temperature,
    apparentTemperature: parseFloat(currentApparent.ElementValue[0].ApparentTemperature),
    comfortText: currentComfort.ElementValue[0].ComfortIndexDescription,
    pop: currentPop.ElementValue[0].ProbabilityOfPrecipitation,
    description: currentDesc.ElementValue[0].WeatherDescription,
    iconFile: resolveIconFile(weatherCode, temperature, now),
    uvi: currentUvi ? currentUvi.ElementValue[0].UVIndex : null,
    sunTimes: computeSunTimes(now, county.lat, county.lon),
    mood: resolveMood(weatherCode, now),
    upcoming: wxElement.Time.slice(0, 6).map((t) => {
      const matchedTemp = tempElement.Time.find((tt) => tt.DataTime === t.StartTime);
      return {
        startTime: t.StartTime,
        weatherCode: parseInt(t.ElementValue[0].WeatherCode, 10),
        temperature: matchedTemp ? parseFloat(matchedTemp.ElementValue[0].Temperature) : null,
      };
    }),
  };
}

function parseWeekly(json, location) {
  const town = findTownRecord(json, location.town);
  if (!town) return null;

  const wxElement = findElement(town, '天氣現象');
  const maxTempElement = findElement(town, '最高溫度');
  const minTempElement = findElement(town, '最低溫度');
  const popElement = findElement(town, '12小時降雨機率');
  const uviElement = findElement(town, '紫外線指數');

  return wxElement.Time.slice(0, 10).map((t, index) => {
    const maxT = maxTempElement.Time[index];
    const minT = minTempElement.Time[index];
    const pop = popElement.Time[index];
    const uvi = uviElement ? uviElement.Time[index] : null;
    const weatherCode = parseInt(t.ElementValue[0].WeatherCode, 10);
    const startDate = new Date(t.StartTime);

    return {
      startTime: t.StartTime,
      weatherText: t.ElementValue[0].Weather,
      weatherCode,
      maxTemp: maxT ? parseFloat(maxT.ElementValue[0].MaxTemperature) : null,
      minTemp: minT ? parseFloat(minT.ElementValue[0].MinTemperature) : null,
      pop: pop ? pop.ElementValue[0].ProbabilityOfPrecipitation : null,
      uvi: uvi ? uvi.ElementValue[0].UVIndex : null,
      iconFile: resolveIconFile(weatherCode, maxT ? parseFloat(maxT.ElementValue[0].MaxTemperature) : null, startDate),
    };
  });
}

async function fetchAlerts(authKey, countyName) {
  try {
    const json = await fetchDataset(ALERT_DATASET_ID, authKey);
    const locations = json?.records?.location || json?.records?.locations?.[0]?.location || [];
    const matched = locations.find((loc) => (loc.locationName || '').includes(countyName));
    if (!matched) return [];

    const hazards = matched?.hazardConditions?.hazards || matched?.hazardConditions || [];
    if (!Array.isArray(hazards)) return [];

    return hazards.map((hazard) => {
      const info = hazard.info || hazard;
      const validTime = hazard.validTime || info.validTime || {};
      return {
        phenomena: info.phenomena || info.significance || '天氣特報',
        significance: info.significance || '',
        until: validTime.endTime || null,
      };
    }).filter((h) => h.phenomena);
  } catch (err) {
    console.warn('Life Ledger：天氣特報抓取失敗（不影響其他天氣資訊）', err);
    return [];
  }
}

async function listTowns(countyName) {
  const county = findCounty(countyName);
  if (!county) throw new Error('請先選擇縣市');
  const authKey = getAuthKey();
  if (!authKey) throw new Error('尚未設定氣象署授權碼');
  const json = await fetchDataset(county.shortTermId, authKey);
  const locations = json?.records?.Locations?.[0]?.Location || [];
  return locations.map((loc) => loc.LocationName).filter(Boolean);
}

async function getWeather(forceRefresh) {
  const location = getLocation();
  if (!location) {
    throw new Error('尚未選擇天氣地點，請到設定的「天氣」選擇縣市與鄉鎮');
  }
  const county = findCounty(location.county);

  const cache = getCache();
  if (!forceRefresh && isCacheFresh(cache, location)) {
    return { ...cache.data, fromCache: true };
  }

  const authKey = getAuthKey();
  if (!authKey) {
    throw new Error('尚未設定氣象署授權碼');
  }

  const [shortTermJson, weeklyJson, alerts] = await Promise.all([
    fetchDataset(county.shortTermId, authKey),
    fetchDataset(county.weeklyId, authKey),
    fetchAlerts(authKey, county.name),
  ]);

  const data = {
    current: parseShortTerm(shortTermJson, location, county),
    weekly: parseWeekly(weeklyJson, location),
    alerts,
  };

  if (!data.current) {
    throw new Error(`氣象署資料裡找不到「${location.town}」，請到設定重新選擇鄉鎮`);
  }

  setCacheFor(location, data);
  return { ...data, fromCache: false };
}

export const Weather = {
  COUNTIES,
  getAuthKey, setAuthKey, getLocation, setLocation, listTowns, getWeather,
  resolveIconFile, uviLevelInfo, computeSunTimes, resolveMood,
  REFRESH_INTERVAL_MS,
};
