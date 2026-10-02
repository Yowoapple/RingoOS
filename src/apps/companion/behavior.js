export const IDLE = {
  empty: ['trashtuber_idle.webp'],
  positive: ['cheer_up.webp', 'cake.webp', 'pat_head.webp', 'nod_head_yes.webp', 'laughing.webp'],
  warning: ['dazed.webp', 'nervous_2.webp', 'craving.webp', 'licking_lips.webp'],
  danger: ['pngtuber_idle_2.webp'],
};

export const MUSIC_IDLE = 'popcat_frame.webp';
export const WEARY_IDLE = 'stopped_working.webp';

export const REACTIONS = {
  added: { file: 'nod_head_yes.webp', ms: 2000 },
  removed: { file: 'shake_head_no.webp', ms: 2000 },
  deposit: { file: 'notification_donation.webp', ms: 2600 },
  eat: { file: 'cake.webp', ms: 2400 },
  checkin: { file: 'arrive_with_spoon.webp', ms: 2400 },
  levelUp: { file: 'rose.webp', ms: 2800 },
  taskDone: { file: 'cheer_up.webp', ms: 2200 },
  over: { file: 'crying_1.webp', ms: 2800 },
  overAll: { file: 'crying_2.webp', ms: 3000 },
  nervous: { file: 'nervous_2.webp', ms: 2400 },
  notify: { file: 'pointing.webp', ms: 2000 },
  pat: { file: 'pat_head.webp', ms: 2200 },
  dizzy: { file: 'dizzy.webp', ms: 2200 },
  wake: { file: 'pngtuber_loading.webp', ms: 1400 },
};

export const EGGS = [
  { file: 'arrive_with_spoon.webp', ms: 2500 },
  { file: 'pointing.webp', ms: 2000 },
  { file: 'typing_normal.webp', ms: 2500 },
  { file: 'typing_angry.webp', ms: 2000 },
  { file: 'driving.webp', ms: 2000 },
  { file: 'knock_head.webp', ms: 1800 },
  { file: 'rose.webp', ms: 2500 },
  { file: 'popcat_frame.webp', ms: 1200 },
  { file: 'angry.webp', ms: 2200 },
  { file: 'jailed.webp', ms: 2500 },
  { file: 'knife.webp', ms: 2200 },
];

export const SIZES = { s: 160, m: 200, l: 250 };

function hash(text) {
  let value = 0;
  for (let i = 0; i < text.length; i += 1) value = (value * 31 + text.charCodeAt(i)) % 100000;
  return value;
}

export const PET_IDLE = {
  hungry: ['craving.webp', 'licking_lips.webp'],
  sad: ['nervous_2.webp', 'dazed.webp'],
  happy: ['laughing.webp', 'cheer_up.webp', 'pat_head.webp'],
};

export function pickIdle(status, dateKey, { music = false, weary = false, pet = 'calm' } = {}) {
  if (music) return MUSIC_IDLE;
  if (weary) return WEARY_IDLE;
  if (PET_IDLE[pet]) return PET_IDLE[pet][hash(`${dateKey}-${pet}`) % PET_IDLE[pet].length];
  const pool = IDLE[status] || IDLE.empty;
  return pool[hash(`${dateKey}-${status}`) % pool.length];
}

export function pickEgg(random, last) {
  const pool = EGGS.filter((egg) => egg.file !== last);
  return pool[Math.min(pool.length - 1, Math.floor(random * pool.length))];
}

export function reactionForNotice(item) {
  if (!item || !item.key) return null;
  if (item.key.startsWith('budget-100')) return REACTIONS.overAll;
  if (item.key.startsWith('budget-cat')) return REACTIONS.over;
  if (item.key.startsWith('budget-80') || item.key.startsWith('budget-proj')) return REACTIONS.nervous;
  return REACTIONS.notify;
}

export function project({ x, y, vx, vy }, factor = 0.16) {
  return { x: x + vx * factor, y: y + vy * factor };
}

export function clampInto(point, size, bounds) {
  return {
    x: Math.min(Math.max(point.x, bounds.left), bounds.right - size.w),
    y: Math.min(Math.max(point.y, bounds.top), bounds.bottom - size.h),
  };
}

export function stashSide({ x, vx }, size, bounds, { edge = 0.42, speed = 900 } = {}) {
  const leftOver = bounds.left - x;
  const rightOver = x + size.w - bounds.right;
  if (leftOver > size.w * edge || (vx < -speed && x - bounds.left < size.w * 0.6)) return 'left';
  if (rightOver > size.w * edge || (vx > speed && bounds.right - (x + size.w) < size.w * 0.6)) return 'right';
  return null;
}

export function findPerch(feet, windows, { reach = 60 } = {}) {
  let best = null;
  windows.forEach((win) => {
    if (feet.x < win.left || feet.x > win.right) return;
    const gap = Math.abs(feet.y - win.top);
    if (gap > reach) return;
    if (!best || win.z > best.z || (win.z === best.z && gap < best.gap)) best = { ...win, gap };
  });
  return best ? { id: best.id, offset: (feet.x - best.left) / Math.max(1, best.right - best.left) } : null;
}

export function restUntil(choice, now = new Date()) {
  if (choice === '30m') return now.getTime() + 30 * 60000;
  if (choice === '1h') return now.getTime() + 60 * 60000;
  if (choice === 'tomorrow') return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 6, 0).getTime();
  return 0;
}
