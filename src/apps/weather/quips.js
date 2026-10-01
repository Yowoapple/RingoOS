const RULES = [
  {
    id: 'rain',
    test: (c) => c.mood === 'storm' || (c.pop ?? 0) >= 70,
    art: 'crying_2.webp',
    lines: {
      neutral: ['降雨機率 {pop}%，雨具記得準備好。', '{pop}% 會下雨，出門帶把傘比較安心。'],
      maid: ['主人，降雨機率 {pop}%，出門前奴家幫您把傘準備好了。'],
      wife: ['降雨機率 {pop}%，出門記得帶傘，別淋濕了。'],
      sister: ['降雨機率 {pop}% 耶 (´；ω；`)，傘記得帶啦，不然會濕透喔！'],
    },
  },
  {
    id: 'heat',
    test: (c) => c.temperature >= 35 || c.apparent >= 38,
    art: 'dizzy.webp',
    lines: {
      neutral: ['體感 {apparent}°，注意補水跟防曬。'],
      maid: ['主人，外面體感 {apparent}°，奴家提醒您多補水、做好防曬。'],
      wife: ['外面體感 {apparent}°，記得多喝水，別中暑了。'],
      sister: ['體感 {apparent}° 也太熱了吧 (＞﹏＜)，多喝水、防曬也要擦好啦！'],
    },
  },
  {
    id: 'cold',
    test: (c) => c.temperature <= 15,
    art: 'nervous_2.webp',
    lines: {
      neutral: ['現在 {temp}°，出門多添件外套。'],
      maid: ['主人，現在只有 {temp}°，記得多穿一件外套再出門。'],
      wife: ['現在 {temp}° 有點冷，外套記得帶著。'],
      sister: ['才 {temp}° 誒，冷死了 (´・ω・`)，外套穿好再出門啦！'],
    },
  },
  {
    id: 'uv',
    test: (c) => c.day && (c.uvMax ?? 0) >= 8,
    art: 'craving.webp',
    lines: {
      neutral: ['今天紫外線偏高，記得防曬。'],
      maid: ['主人，今天紫外線比較強，奴家提醒您防曬別忘了。'],
      wife: ['今天紫外線有點強，出門前記得擦防曬。'],
      sister: ['紫外線超強的耶，防曬不擦會曬傷喔 (°ロ°)！'],
    },
  },
  {
    id: 'clear',
    test: (c) => c.mood === 'clear',
    art: 'laughing.webp',
    lines: {
      neutral: ['天氣不錯，適合出門走走。'],
      maid: ['主人，今天天氣很好，很適合出門走走呢。'],
      wife: ['天氣不錯，要不要出去走走透透氣。'],
      sister: ['天氣好好耶 (๑˃ᴗ˂)ﻭ，出門走走心情也會變好喔！'],
    },
  },
  {
    id: 'night',
    test: (c) => c.mood === 'night',
    art: 'nod_head_yes.webp',
    lines: {
      neutral: ['夜晚很安靜，早點休息。'],
      maid: ['主人，夜深了，奴家幫您看好明天的天氣了，早點休息吧。'],
      wife: ['很晚了，明天的天氣我幫你看好了，早點睡。'],
      sister: ['都這麼晚了還不睡喔，明天天氣幫你看好了啦～'],
    },
  },
];

const FALLBACK = {
  id: 'default',
  art: 'nod_head_yes.webp',
  lines: {
    neutral: ['今天的天氣都在上面了。'],
    maid: ['主人，今天的天氣資訊奴家都幫您整理好了。'],
    wife: ['今天的天氣我幫你看好了，出門前再看一眼。'],
    sister: ['今天天氣都幫你放上面囉，出門前看一下啦～'],
  },
};

function hash(key) {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) % 100000;
  return h;
}

export function pickQuip(current, { persona = 'neutral', uvMax = null, seed = '' } = {}) {
  const context = { ...current, uvMax };
  const rule = RULES.find((item) => item.test(context)) || FALLBACK;
  const pool = rule.lines[persona] || rule.lines.neutral;
  const line = pool[hash(`${seed}-${rule.id}-${persona}`) % pool.length];
  const text = line
    .replace('{pop}', String(Math.round(current.pop ?? 0)))
    .replace('{apparent}', String(Math.round(current.apparent)))
    .replace('{temp}', String(Math.round(current.temperature)));
  return { id: rule.id, art: rule.art, text };
}
