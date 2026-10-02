const RAD = Math.PI / 180;
const DAY = 86400000;

function dayOfYear(year, month, day) {
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / DAY);
}

function solve(year, month, day, lat, lon, rising) {
  const n = dayOfYear(year, month, day);
  const lngHour = lon / 15;
  const t = n + ((rising ? 6 : 18) - lngHour) / 24;
  const anomaly = 0.9856 * t - 3.289;
  let longitude = anomaly + 1.916 * Math.sin(anomaly * RAD) + 0.02 * Math.sin(2 * anomaly * RAD) + 282.634;
  longitude = ((longitude % 360) + 360) % 360;
  let ascension = Math.atan(0.91764 * Math.tan(longitude * RAD)) / RAD;
  ascension = ((ascension % 360) + 360) % 360;
  ascension += Math.floor(longitude / 90) * 90 - Math.floor(ascension / 90) * 90;
  ascension /= 15;
  const sinDec = 0.39782 * Math.sin(longitude * RAD);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosHour = (Math.cos(90.833 * RAD) - sinDec * Math.sin(lat * RAD)) / (cosDec * Math.cos(lat * RAD));
  if (cosHour > 1 || cosHour < -1) return null;
  const hour = (rising ? 360 - Math.acos(cosHour) / RAD : Math.acos(cosHour) / RAD) / 15;
  const local = hour + ascension - 0.06571 * t - 6.622;
  const utc = (((local - lngHour) % 24) + 24) % 24;
  return Date.UTC(year, month - 1, day) + utc * 3600000;
}

export function sunTimes(year, month, day, lat, lon, offsetSeconds) {
  const target = Date.UTC(year, month - 1, day) / DAY;
  const align = (value) => {
    if (value === null) return null;
    const localDay = Math.floor((value + offsetSeconds * 1000) / DAY);
    return value - (localDay - target) * DAY;
  };
  const sunrise = align(solve(year, month, day, lat, lon, true));
  const sunset = align(solve(year, month, day, lat, lon, false));
  return sunrise === null || sunset === null ? null : { sunrise, sunset };
}

export function localParts(time, offsetSeconds) {
  const d = new Date(time + offsetSeconds * 1000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours() };
}
