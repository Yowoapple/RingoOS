import { qrcode } from '../../utils/qr.js';

export const DURATION_OPTIONS = [
  { value: '15', label: '15 分鐘' },
  { value: '30', label: '30 分鐘' },
  { value: '45', label: '45 分鐘' },
  { value: '60', label: '1 小時' },
  { value: '90', label: '1.5 小時' },
  { value: '120', label: '2 小時' },
  { value: '180', label: '3 小時' },
  { value: '240', label: '半天' },
  { value: 'allday', label: '整天' },
];

export const REMINDER_OPTIONS = [
  { value: 'none', label: '不提醒' },
  { value: '5M', label: '提前 5 分鐘' },
  { value: '10M', label: '提前 10 分鐘' },
  { value: '15M', label: '提前 15 分鐘' },
  { value: '30M', label: '提前 30 分鐘' },
  { value: '1H', label: '提前 1 小時' },
  { value: '2H', label: '提前 2 小時' },
  { value: '1D', label: '提前 1 天' },
  { value: '2D', label: '提前 2 天' },
  { value: '3D', label: '提前 3 天' },
  { value: '1W', label: '提前 1 週' },
  { value: '2W', label: '提前 2 週' },
];

const DEFAULT_DURATION = '30';
const DEFAULT_REMINDER = '15M';

function pad(n) {
  return String(n).padStart(2, '0');
}

export function effectiveDetail(task) {
  let durationChoice = task.durationChoice;
  if (durationChoice === undefined) {
    durationChoice = task.durationMinutes ? String(task.durationMinutes) : DEFAULT_DURATION;
  }
  let reminderLead = task.reminderLead;
  if (reminderLead === undefined) {
    if (task.reminderMinutes !== undefined) {
      reminderLead = task.reminderMinutes === null ? 'none' : `${task.reminderMinutes}M`;
    } else if (!task.time) {
      reminderLead = 'none';
    } else {
      reminderLead = DEFAULT_REMINDER;
    }
  }
  return {
    location: task.location || '',
    description: task.description || '',
    durationChoice,
    reminderLead,
  };
}

export function escapeText(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function triggerOf(lead) {
  if (!lead || lead === 'none') return null;
  const unit = lead.slice(-1);
  const amount = lead.slice(0, -1);
  if (unit === 'M' || unit === 'H') return `-PT${amount}${unit}`;
  return `-P${amount}${unit}`;
}

function stamp(date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

export function eventLines(dateKey, task, { now = new Date(), uid } = {}) {
  const detail = effectiveDetail(task);
  const [y, m, d] = dateKey.split('-').map(Number);
  const allDay = !task.time || detail.durationChoice === 'allday';
  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid || `ringoos-${task.id || Math.random().toString(36).slice(2, 10)}-${dateKey.replace(/-/g, '')}@yoworingo`}`,
    `DTSTAMP:${stamp(now)}`,
  ];
  if (allDay) {
    const end = new Date(y, m - 1, d + 1);
    lines.push(`DTSTART;VALUE=DATE:${y}${pad(m)}${pad(d)}`);
    lines.push(`DTEND;VALUE=DATE:${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}`);
  } else {
    const [hh, mm] = task.time.split(':').map(Number);
    const end = new Date(y, m - 1, d, hh, mm + Number(detail.durationChoice));
    lines.push(`DTSTART:${y}${pad(m)}${pad(d)}T${pad(hh)}${pad(mm)}00`);
    lines.push(`DTEND:${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}T${pad(end.getHours())}${pad(end.getMinutes())}00`);
  }
  lines.push(`SUMMARY:${escapeText(task.text)}`);
  if (detail.location.trim()) lines.push(`LOCATION:${escapeText(detail.location.trim())}`);
  if (detail.description.trim()) lines.push(`DESCRIPTION:${escapeText(detail.description.trim())}`);
  const trigger = triggerOf(detail.reminderLead);
  if (trigger) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:提醒', `TRIGGER:${trigger}`, 'END:VALARM');
  lines.push('END:VEVENT');
  return lines;
}

export function calendarText(items, options) {
  const body = items.flatMap(({ dateKey, task }) => eventLines(dateKey, task, options));
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//YoWoRingo//RingoOS Calendar//ZH', ...body, 'END:VCALENDAR'].join('\r\n');
}

export function fileName(text, dateKey) {
  const safe = String(text).replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 20) || '代辦事項';
  return `${safe}-${dateKey}.ics`;
}

export function download(text, name) {
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function qrSvg(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const margin = 2;
  const size = count + margin * 2;
  let path = '';
  for (let r = 0; r < count; r += 1) {
    for (let c = 0; c < count; c += 1) {
      if (qr.isDark(r, c)) path += `M${c + margin} ${r + margin}h1v1h-1z`;
    }
  }
  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true"><rect width="${size}" height="${size}" fill="#fff"/><path fill="#0e0e10" d="${path}"/></svg>`;
}
