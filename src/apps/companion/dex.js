export const DEX = [
  { file: 'arrive_with_spoon.webp', name: '拿著湯匙來了', hint: '每天第一筆記帳打卡時' },
  { file: 'nod_head_yes.webp', name: '點點頭', hint: '記下一筆帳' },
  { file: 'shake_head_no.webp', name: '搖搖頭', hint: '刪掉一筆紀錄' },
  { file: 'cake.webp', name: '吃蛋糕', hint: '餵她一份點心' },
  { file: 'pat_head.webp', name: '被摸頭', hint: '游標在她身上左右輕滑幾下' },
  { file: 'cheer_up.webp', name: '幫你加油', hint: '完成一件代辦' },
  { file: 'laughing.webp', name: '笑開懷', hint: '心情很好又吃飽的時候' },
  { file: 'notification_donation.webp', name: '收到存款', hint: '存一筆錢到存錢目標' },
  { file: 'rose.webp', name: '送你玫瑰', hint: '親密度升級的時候' },
  { file: 'craving.webp', name: '好想吃', hint: '肚子餓的時候' },
  { file: 'licking_lips.webp', name: '舔舔嘴', hint: '肚子餓的時候，另一種' },
  { file: 'dazed.webp', name: '發呆', hint: '心情低落的時候' },
  { file: 'nervous_2.webp', name: '緊張', hint: '預算快用完的時候' },
  { file: 'crying_1.webp', name: '掉眼淚', hint: '某個分類超出預算' },
  { file: 'crying_2.webp', name: '大哭', hint: '整個月的預算用完' },
  { file: 'pngtuber_idle_2.webp', name: '擔心', hint: '這個月的收支亮紅燈' },
  { file: 'trashtuber_idle.webp', name: '無所事事', hint: '這個月還沒有任何紀錄' },
  { file: 'popcat_frame.webp', name: '跟著節奏', hint: '放電台或 YouTube 給她聽' },
  { file: 'stopped_working.webp', name: '當機了', hint: '放著她 15 分鐘不理' },
  { file: 'pngtuber_loading.webp', name: '開機中', hint: '叫醒休息中的她' },
  { file: 'pointing.webp', name: '指給你看', hint: '收到一則通知' },
  { file: 'dizzy.webp', name: '頭暈', hint: '把她用力甩出去' },
  { file: 'typing_normal.webp', name: '認真打字', hint: '卡片開著時點她，隨機出現' },
  { file: 'typing_angry.webp', name: '氣到打字', hint: '卡片開著時點她，隨機出現' },
  { file: 'driving.webp', name: '開車兜風', hint: '卡片開著時點她，隨機出現' },
  { file: 'knock_head.webp', name: '敲敲頭', hint: '卡片開著時點她，隨機出現' },
  { file: 'angry.webp', name: '生氣', hint: '卡片開著時點她，隨機出現' },
  { file: 'jailed.webp', name: '被關起來', hint: '卡片開著時點她，隨機出現' },
  { file: 'knife.webp', name: '拿著刀', hint: '卡片開著時點她，隨機出現' },
];

export const DEX_FILES = DEX.map((item) => item.file);

export function dexEntry(file) {
  return DEX.find((item) => item.file === file) || null;
}

export function dexProgress(seen) {
  const set = new Set(seen);
  const found = DEX.filter((item) => set.has(item.file)).length;
  return { found, total: DEX.length };
}
