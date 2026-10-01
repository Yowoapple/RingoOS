const CLOCK = /(?:^|\s)([01]?\d|2[0-3])[:：]([0-5]\d)(?=\s|$)/;
const SPOKEN = /(凌晨|早上|上午|中午|下午|傍晚|晚上)?\s*(\d{1,2})\s*點\s*(半|(\d{1,2})\s*分?)?/;
const AFTERNOON = new Set(['下午', '傍晚', '晚上']);

function pad(n) {
  return String(n).padStart(2, '0');
}

function tidy(text) {
  return text.replace(/\s{2,}/g, ' ').trim();
}

export function parseTask(input) {
  const raw = String(input || '');
  const clock = raw.match(CLOCK);
  if (clock) {
    return { time: `${pad(Number(clock[1]))}:${clock[2]}`, text: tidy(raw.replace(clock[0], ' ')) };
  }
  const spoken = raw.match(SPOKEN);
  if (spoken) {
    let hour = Number(spoken[2]);
    const minute = spoken[3] === '半' ? 30 : Number(spoken[4] || 0);
    if (hour > 23 || minute > 59) return { time: null, text: tidy(raw) };
    const part = spoken[1];
    if (part && AFTERNOON.has(part) && hour < 12) hour += 12;
    if (part === '中午' && hour < 11) hour += 12;
    if ((part === '凌晨' || part === '早上' || part === '上午') && hour === 12) hour = 0;
    return { time: `${pad(hour)}:${pad(minute)}`, text: tidy(raw.replace(spoken[0], ' ')) };
  }
  return { time: null, text: tidy(raw) };
}
