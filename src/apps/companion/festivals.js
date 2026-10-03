const FIXED = {
  '01-01': { id: 'newyear', name: '元旦' },
  '02-14': { id: 'valentine', name: '情人節' },
  '03-14': { id: 'white', name: '白色情人節' },
  '04-01': { id: 'fools', name: '愚人節' },
  '04-04': { id: 'children', name: '兒童節' },
  '08-08': { id: 'father', name: '父親節' },
  '10-31': { id: 'halloween', name: '萬聖節' },
  '12-24': { id: 'xmaseve', name: '平安夜' },
  '12-25': { id: 'xmas', name: '聖誕節' },
  '12-31': { id: 'nye', name: '跨年夜' },
};

export const SPRING = {
  2026: '02-17', 2027: '02-06', 2028: '01-26', 2029: '02-13', 2030: '02-03',
  2031: '01-23', 2032: '02-11', 2033: '01-31', 2034: '02-19', 2035: '02-08',
};

export const LUNAR = {
  2026: { duanwu: '06-19', qixi: '08-19', midautumn: '09-25' },
  2027: { duanwu: '06-09', qixi: '08-08', midautumn: '09-15' },
  2028: { duanwu: '05-28', qixi: '08-26', midautumn: '10-03' },
  2029: { duanwu: '06-16', qixi: '08-16', midautumn: '09-22' },
  2030: { duanwu: '06-05', qixi: '08-05', midautumn: '09-12' },
};

const LUNAR_NAMES = { duanwu: '端午節', qixi: '七夕', midautumn: '中秋節' };

function shift(year, md, days) {
  const [m, d] = md.split('-').map(Number);
  const date = new Date(year, m - 1, d + days);
  return { year: date.getFullYear(), md: `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` };
}

function motherDay(year) {
  const first = new Date(year, 4, 1).getDay();
  const day = 1 + ((7 - first) % 7) + 7;
  return `05-${String(day).padStart(2, '0')}`;
}

export function festivalOn(dateKey, birthday = null) {
  const year = Number(dateKey.slice(0, 4));
  const md = dateKey.slice(5);
  if (birthday && md === birthday) return { id: 'birthday', name: '生日' };
  const spring = SPRING[year];
  if (spring) {
    if (md === spring) return { id: 'spring', name: '春節' };
    if (md === shift(year, spring, -1).md) return { id: 'springeve', name: '除夕' };
    if (md === shift(year, spring, 14).md) return { id: 'lantern', name: '元宵節' };
  }
  const lunar = LUNAR[year];
  if (lunar) {
    const hit = Object.keys(lunar).find((key) => lunar[key] === md);
    if (hit) return { id: hit, name: LUNAR_NAMES[hit] };
  }
  if (md === motherDay(year)) return { id: 'mother', name: '母親節' };
  return FIXED[md] || null;
}

const LINES = {
  birthday: {
    neutral: '生日快樂。今年也讓 {n} 陪你一起過。',
    maid: '主人，生日快樂！{n} 準備了好多祝福要送給您。',
    wife: '生日快樂，今天什麼都不用想，好好被寵吧。',
    sister: '生日快樂！！{n} 要第一個說 ٩(◕‿◕)۶',
  },
  newyear: {
    neutral: '新年快樂，新的一年也一起好好過。',
    maid: '主人新年快樂！今年也請多多指教。',
    wife: '新年快樂，今年也要一直在一起喔。',
    sister: '新年快樂！今年也要罩我喔～',
  },
  springeve: {
    neutral: '今天是除夕，記得好好吃頓年夜飯。',
    maid: '主人，除夕快樂！年夜飯要吃飽喔。',
    wife: '除夕了，今天早點回家吃飯吧。',
    sister: '除夕耶！紅包準備好了嗎 (≧▽≦)',
  },
  spring: {
    neutral: '新春快樂，祝你今年順順利利。',
    maid: '主人新年好！祝主人今年財源滾滾。',
    wife: '新年好，今年也要平平安安的。',
    sister: '恭喜發財！紅包拿來～',
  },
  lantern: {
    neutral: '元宵節快樂，今天吃湯圓了嗎？',
    maid: '主人，元宵節要吃湯圓喔。',
    wife: '元宵快樂，一起去看燈吧。',
    sister: '湯圓！我要芝麻的！',
  },
  valentine: {
    neutral: '情人節快樂，今天也要對自己好一點。',
    maid: '主人，情人節快樂……{n} 有準備巧克力喔。',
    wife: '情人節快樂，今天只想跟你在一起。',
    sister: '情人節快樂～沒人送巧克力的話 {n} 給你一個！',
  },
  white: {
    neutral: '今天是白色情人節。',
    maid: '主人，今天是回禮的日子呢。',
    wife: '白色情人節，有沒有要送我的東西呀？',
    sister: '白色情人節！回禮呢回禮呢？',
  },
  fools: {
    neutral: '今天是愚人節，看到奇怪的消息先別急著相信。',
    maid: '主人，今天聽到什麼都要先想一想喔。',
    wife: '愚人節快樂，我說的話今天都是真的喔。',
    sister: '你的帳本……騙你的啦，愚人節快樂！',
  },
  children: {
    neutral: '兒童節快樂，今天可以任性一點。',
    maid: '主人，今天也是大小孩的節日喔。',
    wife: '兒童節快樂，今天我來照顧你。',
    sister: '兒童節！那 {n} 今天可以多吃一份點心吧？',
  },
  mother: {
    neutral: '今天是母親節，記得打通電話回家。',
    maid: '主人，今天別忘了跟媽媽說聲謝謝。',
    wife: '母親節，記得問候媽媽喔。',
    sister: '母親節！快去跟媽媽撒嬌！',
  },
  duanwu: {
    neutral: '端午節快樂，今天吃粽子了嗎？',
    maid: '主人，端午安康。',
    wife: '端午快樂，粽子別吃太多喔。',
    sister: '粽子！北部粽還是南部粽！',
  },
  qixi: {
    neutral: '今天是七夕。',
    maid: '主人，今晚的星星很漂亮呢。',
    wife: '七夕快樂，今晚一起看星星吧。',
    sister: '七夕耶，你有約嗎？沒有的話 {n} 陪你～',
  },
  father: {
    neutral: '今天是父親節，記得跟爸爸說聲謝謝。',
    maid: '主人，今天別忘了問候爸爸。',
    wife: '父親節快樂，記得打給爸爸。',
    sister: '父親節！快去跟爸爸說愛他！',
  },
  midautumn: {
    neutral: '中秋節快樂，今晚的月亮很圓。',
    maid: '主人中秋快樂，月餅要配茶喔。',
    wife: '中秋快樂，一起賞月吧。',
    sister: '烤肉！月餅！柚子！中秋快樂～',
  },
  halloween: {
    neutral: '萬聖節快樂，不給糖就搗蛋。',
    maid: '主人，不給 {n} 糖的話……就要搗蛋了喔。',
    wife: '萬聖節快樂，今天想扮成什麼？',
    sister: 'Trick or treat！糖果交出來 (｀・ω・´)',
  },
  xmaseve: {
    neutral: '平安夜，祝你今晚好夢。',
    maid: '主人，平安夜快樂，記得把襪子掛好。',
    wife: '平安夜快樂，今晚想和你待在一起。',
    sister: '平安夜！聖誕老人會來嗎？',
  },
  xmas: {
    neutral: '聖誕快樂。',
    maid: '主人，聖誕快樂！{n} 是今天的禮物喔。',
    wife: '聖誕快樂，謝謝你這一年的陪伴。',
    sister: 'Merry Christmas！禮物呢！',
  },
  nye: {
    neutral: '今年的最後一天，辛苦了。',
    maid: '主人，這一年辛苦了，明年也請多多指教。',
    wife: '今年最後一天了，謝謝你一直都在。',
    sister: '要跨年了！一起倒數吧！',
  },
};

export function festivalLine(id, voice, vars = {}) {
  const group = LINES[id];
  if (!group) return '';
  return (group[voice] || group.neutral).replaceAll('{n}', vars.name || '');
}

export const FESTIVAL_IDS = Object.keys(LINES);
