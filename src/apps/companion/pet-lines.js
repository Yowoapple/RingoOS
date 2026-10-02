const LINES = {
  hungry: {
    neutral: ['{n} 肚子有點餓了，今天記一筆帳就算餵她了。', '還沒記帳的話，{n} 會一直盯著你看喔。', '{n} 在等今天的第一筆紀錄。'],
    maid: ['主人，{n} 的肚子在叫了……今天還沒記帳呢。', '主人記一筆帳，{n} 就能吃飽了。', '奴家提醒主人，{n} 今天還沒吃東西。'],
    wife: ['{n} 餓了，記一筆帳餵她一下嘛。', '今天的帳還沒記喔，{n} 在等你。', '先記一筆，{n} 才吃得到飯。'],
    sister: ['{n} 餓扁了啦 (´；ω；`)，快記一筆！', '欸你今天還沒記帳耶，{n} 在哭了。', '記一筆帳就是餵 {n}，很簡單的啦！'],
  },
  sad: {
    neutral: ['{n} 有點悶悶的，陪她一下吧。', '最近好像不太順，{n} 有點擔心你。', '{n} 想要被摸摸頭。'],
    maid: ['主人，{n} 看起來有點寂寞。', '主人最近辛苦了，{n} 也跟著擔心。', '主人摸摸 {n} 的頭吧，她會開心一點。'],
    wife: ['{n} 好像不太開心，抱一下她吧。', '最近有點累吧？{n} 也感覺到了。', '摸摸 {n} 的頭，她就會好起來的。'],
    sister: ['{n} 在鬧脾氣了啦 (｡•́︿•̀｡)', '你最近都不理 {n}，她會難過的耶！', '快來摸摸 {n} 嘛～'],
  },
  happy: {
    neutral: ['{n} 今天心情很好。', '照顧得很好，{n} 很開心。', '{n} 想跟你說聲謝謝。'],
    maid: ['主人，{n} 今天好開心！', '多虧主人細心照顧，{n} 精神很好。', '主人做得真好，{n} 也很驕傲。'],
    wife: ['{n} 今天心情超好的。', '你把一切都照顧得很好呢，{n} 也很開心。', '有你在，{n} 很安心。'],
    sister: ['{n} 超開心的啦 ٩(｡•̀ᴗ•́｡)۶', '欸你今天好棒喔，{n} 都在轉圈圈了！', '{n} 說最喜歡你了！'],
  },
  calm: {
    neutral: ['{n} 在旁邊陪著你。', '今天也一起加油吧。', '{n} 在這裡，有需要就點她。'],
    maid: ['主人，{n} 一直都在這裡。', '主人今天也辛苦了。', '有什麼吩咐，{n} 隨時都在。'],
    wife: ['{n} 在這裡陪你喔。', '今天也辛苦了。', '累了就休息一下吧，{n} 會等你。'],
    sister: ['{n} 在這裡喔～', '今天也要加油啦！', '無聊的話可以戳戳 {n}！'],
  },
};

const EVENTS = {
  checkin: {
    neutral: ['今天的帳記好了，{n} 吃飽了。連續 {s} 天。', '打卡成功，連續第 {s} 天。'],
    maid: ['主人記帳了！{n} 吃得好飽，連續第 {s} 天呢。'],
    wife: ['記好了，{n} 吃飽了。已經連續 {s} 天了喔。'],
    sister: ['打卡成功！連續 {s} 天了耶 (๑•̀ㅂ•́)و'],
  },
  streak7: { neutral: ['連續記帳一週了，{n} 很佩服你。'], maid: ['主人連續一週了！奴家要為主人鼓掌。'], wife: ['一整週都沒斷，真的很棒。'], sister: ['一週耶！超強的啦！'] },
  streak30: { neutral: ['整整三十天，記帳已經是你的習慣了。'], maid: ['三十天了，主人的毅力讓 {n} 好感動。'], wife: ['一個月都沒斷，我好以你為榮。'], sister: ['三十天！？你是怪物吧，好厲害喔！'] },
  streak100: { neutral: ['一百天。{n} 會一直記得這一天。'], maid: ['一百天了，主人。{n} 會一直陪著您。'], wife: ['一百天了，謝謝你一直這麼認真。'], sister: ['一百天耶！！{n} 要哭了啦！'] },
  level: { neutral: ['{n} 和你更親近了：{t}。'], maid: ['主人，{n} 和您的關係變成「{t}」了。'], wife: ['我們現在是「{t}」了呢。'], sister: ['升級了！現在是「{t}」喔！'] },
  treat: { neutral: ['{n} 吃得很開心。', '謝謝你的點心。'], maid: ['謝謝主人的點心！'], wife: ['好好吃，謝謝你。'], sister: ['好吃！還要還要！'] },
  goal: { neutral: ['完成一個小目標，拿到一份點心。'], maid: ['主人完成目標了，這是給 {n} 的點心嗎？'], wife: ['又完成一個了，點心先收著喔。'], sister: ['目標完成！點心 get！'] },
  noTreat: { neutral: ['點心吃完了，完成今天的小目標可以再拿。'], maid: ['主人，點心沒有了……完成目標就能再拿到。'], wife: ['點心吃完了，做完小目標再給她吧。'], sister: ['沒點心了啦，去完成目標！'] },
  tooFull: { neutral: ['{n} 今天吃夠了，明天再餵吧。'], maid: ['主人，{n} 今天已經吃很多了。'], wife: ['今天夠了，再吃會撐壞的。'], sister: ['{n} 說她吃不下了啦！'] },
};

function pick(list, seed) {
  if (!list || !list.length) return '';
  return list[Math.abs(seed) % list.length];
}

function fill(text, { name, streak = 0, title = '' }) {
  return text.replaceAll('{n}', name).replaceAll('{s}', String(streak)).replaceAll('{t}', title);
}

export function stateLine(state, voice, vars, seed = 0) {
  const pool = (LINES[state] || LINES.calm)[voice] || LINES[state].neutral;
  return fill(pick(pool, seed), vars);
}

export function eventLine(type, voice, vars, seed = 0) {
  const group = EVENTS[type];
  if (!group) return '';
  return fill(pick(group[voice] || group.neutral, seed), vars);
}
