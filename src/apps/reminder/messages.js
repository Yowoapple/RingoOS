const PERSONA_POOLS = {
  neutral: {
    month: {
      empty: [
        '這個月還沒有記錄，先從今天的一筆開始吧，之後回頭看會很有感覺。',
        '空白的一個月，代表一切都還沒開始，也代表什麼可能性都還在。',
        '還沒有資料可以分析，先記個幾筆，我們再一起看看這個月過得怎麼樣。',
      ],
      positive: [
        '這個月收支算下來是正的，過得挺穩的，這個步調可以繼續維持。',
        '整體來看這個月手頭是寬鬆的，辛苦了，也可以撥一點錢犒賞自己。',
        '這個月存下來的錢比花掉的多，是很扎實的一個月，繼續保持這個節奏就好。',
      ],
      warning: [
        '這個月花得比想像中多一點，還在可以接受的範圍，接下來幾天留意一下就好。',
        '收支有點吃緊，但還沒到緊張的程度，剩下的日子花錢前可以多想一秒。',
        '這個月的支出稍微追上收入了，不用緊張，但接下來可以減少一些非必要開銷。',
      ],
      danger: [
        '這個月支出超過收入不少，先別自責，看看是不是有一次性的大筆花費，下個月再抓回來。',
        '這個月手頭比較緊，接下來的日子盡量以必要開銷為主，非必要的可以先緩一緩。',
        '收支落差有點大，辛苦了，這種月份本來就會有，先照顧好自己，之後再慢慢調整。',
      ],
    },
    week: {
      empty: [
        '這禮拜還沒有記錄，先記今天的一筆，養成習慣後面會輕鬆很多。',
        '這週還是空白的，隨時開始都不嫌晚，先記一筆看看。',
      ],
      positive: [
        '這禮拜過得很穩，收支是正的，這樣的步調很好，繼續維持。',
        '這一週手頭寬鬆，辛苦一週了，週末可以稍微犒賞自己一下。',
        '這禮拜存得比花得多，是很扎實的一週，這個節奏可以延續下去。',
      ],
      warning: [
        '這禮拜花得比平常多一點，還在可以接受的範圍，剩下幾天留意一下就好。',
        '這週手頭有點緊，接下來幾天花錢前可以多想一下，先以必要的為主。',
        '這禮拜的支出稍微追上收入了，週末的開銷可以簡單一點會比較安心。',
      ],
      danger: [
        '這禮拜花得比賺得多不少，先別自責，看看是不是有臨時的大筆支出，接下來幾天以必要開銷為主。',
        '這週手頭比較緊，辛苦了，接下來幾天盡量把非必要的花費往後延。',
        '這禮拜的收支落差有點大，先照顧好自己，之後幾天量力而為就好。',
      ],
    },
  },

  maid: {
    month: {
      empty: [
        '主人，這個月還沒有任何記錄呢，從今天開始記一筆吧，奴家會幫您顧好每一筆帳的。',
        '這個月的帳本還是空的，主人請隨時開始，奴家已經準備好了。',
      ],
      positive: [
        '主人這個月的收支管理得很好，奴家看了也放心，這樣的步調請繼續保持下去。',
        '這個月手頭寬裕，辛苦主人了，偶爾犒賞自己一下也是應該的。',
        '主人這個月存下來的比花掉的多，做得非常好，奴家由衷地感到欣慰。',
      ],
      warning: [
        '主人，這個月花費稍微多了一些，還在能接受的範圍，接下來幾天奴家會多留意的。',
        '手頭有點緊了，主人，接下來的開銷麻煩多想一下下再決定，奴家會在旁邊提醒您。',
        '這個月的支出快要追上收入了，主人別太擔心，先把非必要的花費緩一緩就好。',
      ],
      danger: [
        '主人，這個月支出超過收入不少，請先別自責，奴家陪您一起看看是哪裡花多了。',
        '這個月手頭比較緊，主人，接下來請以必要的開銷為優先，其他的奴家會幫您記著、之後再說。',
        '辛苦主人了，這種月份難免會遇到，先照顧好自己，之後再慢慢調整回來就好。',
      ],
    },
    week: {
      empty: [
        '主人，這禮拜還沒有記錄，奴家在這裡等著呢，隨時開始都可以。',
        '這週的帳本是空白的，主人今天要不要先記一筆看看呢。',
      ],
      positive: [
        '主人這禮拜過得很穩，奴家看著也安心，請繼續保持這樣的節奏。',
        '這一週手頭寬鬆，辛苦主人了，週末不妨稍微犒賞自己一下。',
        '這禮拜存得比花得多，做得很好，主人辛苦了。',
      ],
      warning: [
        '主人，這禮拜花得比平常多了一點，還在可以接受的範圍，剩下幾天奴家會提醒您留意。',
        '這週手頭有點緊，主人，接下來幾天花錢前可以先想一下下。',
        '這禮拜的支出稍微追上收入了，週末的安排簡單一點會比較安心。',
      ],
      danger: [
        '主人，這禮拜花得比賺得多不少，請先別自責，接下來幾天以必要開銷為主就好。',
        '這週手頭比較緊，辛苦主人了，接下來幾天奴家會幫您多留意非必要的花費。',
        '這禮拜收支落差有點大，主人請先照顧好自己，之後幾天量力而為即可。',
      ],
    },
  },

  wife: {
    month: {
      empty: [
        '這個月還沒有記錄喔，從今天開始記一筆吧，我陪你一起看著這個月怎麼過。',
        '這個月的帳本還是空的，什麼時候想開始都可以，我在這裡等你。',
      ],
      positive: [
        '這個月收支算下來是正的，過得很穩，辛苦你了，這個步調很好，繼續保持。',
        '這個月手頭寬鬆，辛苦你在外面打拚了，偶爾也要對自己好一點。',
        '這個月存下來的比花掉的多，做得很好，我看了也替你開心。',
      ],
      warning: [
        '這個月花得比想像中多一點，還在能接受的範圍，接下來幾天我們一起留意一下。',
        '手頭有點緊了，接下來的開銷可以多想一下再決定，別太累著自己。',
        '這個月的支出快追上收入了，先把不急的花費往後挪一挪，我們一起把節奏抓回來。',
      ],
      danger: [
        '這個月花得比賺得多不少，先別太苛責自己，我們一起看看是哪裡花多了，好嗎。',
        '這個月手頭比較緊，接下來就先以必要的開銷為主，其他的等手頭鬆一點再說。',
        '辛苦你了，這種月份難免會遇到，先照顧好自己，之後我們再慢慢調整回來。',
      ],
    },
    week: {
      empty: [
        '這禮拜還沒有記錄呢，今天要不要先記一筆，我陪你一起養成習慣。',
        '這週的帳本是空白的，隨時想開始都可以喔。',
      ],
      positive: [
        '這禮拜過得很穩，收支是正的，辛苦你了，這樣的節奏很好。',
        '這一週手頭寬鬆，辛苦一週了，週末我們可以稍微犒賞自己一下。',
        '這禮拜存得比花得多，做得很好，我看了也很放心。',
      ],
      warning: [
        '這禮拜花得比平常多一點，還在可以接受的範圍，剩下幾天我們一起留意。',
        '這週手頭有點緊，接下來幾天花錢前可以多想一下，別太勉強自己。',
        '這禮拜的支出稍微追上收入了，週末的安排簡單一點會比較安心。',
      ],
      danger: [
        '這禮拜花得比賺得多不少，先別自責，接下來幾天我們以必要開銷為主就好。',
        '這週手頭比較緊，辛苦了，接下來幾天盡量把不急的花費往後延一延。',
        '這禮拜收支落差有點大，先照顧好自己，之後幾天量力而為就好，不用勉強。',
      ],
    },
  },

  sister: {
    month: {
      empty: [
        '欸這個月都還沒記帳誒(°ロ°) 快從今天開始啦，不然月底你會後悔的喔。',
        '這個月的帳本空空的耶，要不要現在就記一筆，我在旁邊看著你喔(・ω・)ノ',
      ],
      positive: [
        '這個月收支是正的耶,做得不錯嘛(๑˃ᴗ˂)ﻭ 這個節奏繼續保持下去就對了！',
        '這個月手頭寬鬆誒,辛苦你了~偶爾寵一下自己也沒關係啦(´▽`)',
        '這個月存得比花得多,超棒的好嗎,繼續加油喔！',
      ],
      warning: [
        '這個月花得比想像中多一點點喔(´・ω・`) 還好啦還在可以接受的範圍,接下來小心一點。',
        '手頭有點緊了誒,接下來花錢前記得多想一下下啦，不要衝動購物喔。',
        '這個月的支出快要追上收入了啦，非必要的先忍一下，我們一起撐過去。',
      ],
      danger: [
        '這個月花超多的耶(＞﹏＜) 先不要太自責啦，是不是有什麼臨時的大筆花費，下個月抓回來就好。',
        '這個月手頭真的有點緊誒，接下來先顧好必要的就好，其他的先忍一忍啦。',
        '辛苦你了啦，這種月份難免會遇到，先照顧好自己比較重要，之後再慢慢調整回來。',
      ],
    },
    week: {
      empty: [
        '這禮拜都還沒記帳耶，快來記一筆啦(・∀・)',
        '這週還是空白的喔，隨時要開始都可以，我等你！',
      ],
      positive: [
        '這禮拜過得很穩耶，收支是正的，繼續保持這個節奏就對啦(๑˃ᴗ˂)ﻭ',
        '這一週手頭寬鬆誒，辛苦一週了，週末可以稍微犒賞自己一下啦~',
        '這禮拜存得比花得多，超讚的，繼續加油！',
      ],
      warning: [
        '這禮拜花得比平常多一點點喔，還好啦，剩下幾天小心一點就好。',
        '這週手頭有點緊誒，接下來幾天花錢前多想一下啦，不要手滑。',
        '這禮拜的支出快追上收入了，週末簡單過一下比較安心啦。',
      ],
      danger: [
        '這禮拜花超多的耶(＞﹏＜) 先不要自責啦，接下來幾天先顧必要開銷就好。',
        '這週手頭比較緊誒，辛苦了，接下來幾天先把非必要的花費延一延吧。',
        '這禮拜收支落差有點大喔，先照顧好自己比較重要，之後量力而為就好啦。',
      ],
    },
  },
};

function hashKey(key) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) % 100000;
  }
  return hash;
}

function pickMessage(pool, periodKey) {
  const index = hashKey(periodKey) % pool.length;
  return pool[index];
}

function resolveStatus(summary) {
  if (summary.income === 0 && summary.expense === 0) return 'empty';
  return summary.status;
}

function getPersonaPool(personaType) {
  return PERSONA_POOLS[personaType] || PERSONA_POOLS.neutral;
}

function formatAmount(n) {
  return Math.round(Math.abs(n)).toLocaleString('zh-Hant-TW');
}

function buildComparisonFragment(comparison, unitLabel) {
  if (!comparison || !comparison.hasPrevious || comparison.diff === 0) return null;
  const direction = comparison.diff > 0 ? '多花了' : '少花了';
  return `跟上${unitLabel}比，這${unitLabel}${direction}大概 ${formatAmount(comparison.diff)} 元。`;
}

function buildCategoryDriverFragment(driver, comparison) {
  if (!driver) return null;
  if (driver.mode === 'increase') {
    const prevAmount = comparison && comparison.previousByCategory
      ? comparison.previousByCategory[driver.category] || 0
      : null;
    const prevText = prevAmount !== null ? `，比上次多了 ${formatAmount(driver.diff)} 元` : '';
    return `主要差在${driver.category}——這次${driver.category}花了 ${formatAmount(driver.amount)} 元${prevText}，是漲最多的分類。`;
  }
  return `這次花最多的是${driver.category}，共 ${formatAmount(driver.amount)} 元。`;
}

function buildStreakFragment(count, unitLabel) {
  if (!count || count < 2) return null;
  return `已經連續 ${count} 個${unitLabel}收支都是正的了，這個節奏很不錯。`;
}

function buildGoalFragment(projection, goalTitle) {
  if (!projection) return null;
  if (!projection.hasHistory) {
    return `「${goalTitle}」這個目標剛起步，持續存入就會慢慢看到進度。`;
  }
  if (projection.monthsRemaining === null) {
    return `「${goalTitle}」目前還沒有穩定的存入節奏，找時間存一筆進去，會更快看到成果。`;
  }
  if (projection.monthsRemaining <= 0) {
    return `「${goalTitle}」照目前的存法，已經很接近達成了。`;
  }
  return `照這個存法，距離「${goalTitle}」大概還要 ${projection.monthsRemaining} 個月就能達成。`;
}

function selectFragments(context, unitLabel) {
  const { comparison, categoryDriver, streakCount, goalFragment } = context;

  if (streakCount && streakCount >= 3) {
    return [buildStreakFragment(streakCount, unitLabel)];
  }

  if (comparison && comparison.hasPrevious) {
    const threshold = Math.max(1000, comparison.previousExpense * 0.15);
    if (Math.abs(comparison.diff) >= threshold) {
      const fragments = [buildComparisonFragment(comparison, unitLabel)];
      const driverFragment = buildCategoryDriverFragment(categoryDriver, comparison);
      if (driverFragment) fragments.push(driverFragment);
      return fragments.filter(Boolean);
    }
  }

  if (goalFragment) return [goalFragment];

  return [];
}

function getMonthMessage(monthSummary, extras) {
  extras = extras || {};
  const status = resolveStatus(monthSummary);
  const pool = getPersonaPool(extras.personaType).month[status];
  let text = pickMessage(pool, monthSummary.monthKey + '-' + status + '-' + (extras.personaType || 'neutral'));

  if (status !== 'empty' && monthSummary.overBudgetCount > 0) {
    const overCategories = monthSummary.budgetBreakdown
      .filter((b) => b.status === 'danger')
      .map((b) => b.category);
    const label = overCategories.length > 1 ? '這幾個分類' : '這個分類';
    text += ` 目前「${overCategories.join('、')}」${label}已經超過預算了。`;
  }

  if (extras.projection && extras.projection.applicable && extras.projection.overProjected) {
    text += ` 照這 ${extras.projection.dayOfMonth} 天的花錢速度推算，這個月月底可能會花到大約 `
      + `${formatAmount(extras.projection.projectedExpense)} 元，比預算多，接下來可以放慢一點。`;
  }

  if (status !== 'empty') {
    const fragments = selectFragments({
      comparison: extras.comparison,
      categoryDriver: extras.categoryDriver,
      streakCount: extras.streakCount,
      goalFragment: extras.goalFragment,
    }, '個月');
    fragments.forEach((f) => { text += ` ${f}`; });
  }

  return { status, text };
}

function getWeekMessage(weekSummary, extras) {
  extras = extras || {};
  const status = resolveStatus(weekSummary);
  const pool = getPersonaPool(extras.personaType).week[status];
  let text = pickMessage(pool, weekSummary.weekStart + '-' + status + '-' + (extras.personaType || 'neutral'));

  if (status !== 'empty') {
    const fragments = selectFragments({
      comparison: extras.comparison,
      categoryDriver: extras.categoryDriver,
      streakCount: extras.streakCount,
      goalFragment: null,
    }, '禮拜');
    fragments.forEach((f) => { text += ` ${f}`; });
  }

  return { status, text };
}

export const Messages = {
  getMonthMessage,
  getWeekMessage,
  buildGoalFragment,
};
