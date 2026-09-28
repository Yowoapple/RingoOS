const rows = (count, render) => Array.from({ length: count }, (_, i) => render(i)).join('');

export const APPS = [
  {
    id: 'ledger',
    title: '記帳',
    short: '記帳',
    tone: 1,
    frame: { w: 420, h: 540 },
    min: { w: 340, h: 380 },
    render: () => `
      <div class="app app-ledger">
        <div class="app-ledger__form">
          <div class="ph-label">日期</div>
          <div class="ph ph--field"></div>
          <div class="ph-seg"><span class="is-on">支出</span><span>收入</span></div>
          <div class="ph-row">
            <div><div class="ph-label">金額</div><div class="ph ph--field"></div></div>
            <div><div class="ph-label">分類</div><div class="ph ph--field"></div></div>
          </div>
          <div class="ph-label">備註</div>
          <div class="ph ph--field"></div>
          <div class="ph ph--button">新增這筆記錄</div>
        </div>
        <div class="app-ledger__list">
          <div class="ph-label">這一天的記錄</div>
          ${rows(5, () => '<div class="ph-item"><span class="ph ph--dot"></span><span class="ph ph--text"></span><span class="ph ph--amount"></span></div>')}
        </div>
      </div>`,
  },
  {
    id: 'overview',
    title: '收支總覽',
    short: '總覽',
    tone: 2,
    frame: { w: 460, h: 460 },
    min: { w: 320, h: 320 },
    render: () => `
      <div class="app app-overview">
        <div class="app-overview__main">
          <div class="ph-label">本月</div>
          <div class="ph-stats">
            ${['收入', '支出', '淨額'].map((label) => `<div class="ph-stat"><span>${label}</span><strong>--</strong></div>`).join('')}
          </div>
          <div class="ph ph--line"></div>
          <div class="ph-label">支出前五名分類</div>
          ${rows(5, (i) => `<div class="ph-bar ph-bar--${i + 1}"><span class="ph ph--text"></span><span class="ph-bar__track"><span class="ph-bar__fill"></span></span></div>`)}
        </div>
        <div class="app-overview__chart"><div class="ph ph--chart">圖表位置</div></div>
      </div>`,
  },
  {
    id: 'calendar',
    title: '日曆',
    short: '日曆',
    tone: 3,
    frame: { w: 540, h: 500 },
    min: { w: 360, h: 380 },
    render: () => `
      <div class="app app-calendar">
        <div class="app-calendar__month">
          <div class="app-calendar__head"><span class="ph ph--text"></span><span class="ph ph--chip"></span></div>
          <div class="app-calendar__week">${['日', '一', '二', '三', '四', '五', '六'].map((d) => `<span>${d}</span>`).join('')}</div>
          <div class="app-calendar__grid">${rows(35, () => '<span class="ph ph--cell"></span>')}</div>
        </div>
        <div class="app-calendar__side">
          <div class="ph-label">代辦</div>
          ${rows(4, () => '<div class="ph-item"><span class="ph ph--check"></span><span class="ph ph--text"></span></div>')}
        </div>
      </div>`,
  },
  {
    id: 'calculator',
    title: '計算機',
    short: '計算',
    tone: 4,
    frame: { w: 300, h: 440 },
    min: { w: 260, h: 380 },
    render: () => `
      <div class="app app-calc">
        <div class="app-calc__screen"><span>0</span></div>
        <div class="app-calc__keys">
          ${['C', '±', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '='].map((k) => `<span class="app-calc__key${k === '0' ? ' is-wide' : ''}">${k}</span>`).join('')}
        </div>
      </div>`,
  },
  {
    id: 'weather',
    title: '天氣',
    short: '天氣',
    tone: 5,
    frame: { w: 520, h: 380 },
    min: { w: 340, h: 300 },
    render: () => `
      <div class="app app-weather">
        <div class="app-weather__hero">
          <div class="ph ph--glyph">圖示</div>
          <div><strong class="app-weather__temp">--°</strong><div class="ph ph--text"></div></div>
          <div class="app-weather__details">${rows(4, () => '<div class="ph-stat"><span class="ph ph--text"></span><strong>--</strong></div>')}</div>
        </div>
        <div class="ph-label">接下來幾小時</div>
        <div class="app-weather__hours">${rows(8, () => '<div class="ph-hour"><span class="ph ph--text"></span><span class="ph ph--glyph-sm"></span><strong>--°</strong></div>')}</div>
      </div>`,
  },
];
