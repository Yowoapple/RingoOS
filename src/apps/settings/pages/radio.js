import { Radio } from '../../radio/radio.js';
import { button, group, h, row, swapText, text } from '../kit.js';

export function radioPage(ctx) {
  const { radio, island, dialogs, frame } = ctx;
  const { lists } = radio;
  const el = h('div', 'st-page__body');

  const fileInput = h('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json,.json';
  fileInput.hidden = true;
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    await radio.importFile(file);
    sync();
  });

  const importButton = button('匯入清單', 'btn--secondary st-mini', () => fileInput.click());
  const clearButton = button('清除', 'btn--ghost st-mini', async () => {
    const ok = await dialogs.confirm({
      source: clearButton,
      frame: frame(),
      title: '清除所有電台？',
      text: '收藏與最近播放也會一起清掉。之後可以再匯入清單。',
      confirmLabel: '清除',
    });
    if (!ok) return;
    radio.clearStations();
    island.toast({ text: '已清除電台', duration: 2200 });
    sync();
  });
  const stationControls = h('div', 'st-inline');
  stationControls.append(importButton, clearButton, fileInput);
  const stationRow = row({ label: '網路電台', control: stationControls, keywords: '電台 匯入 json station radio' });

  const ytList = h('div', 'st-lists');
  const ytEmpty = text('p', 'st-note', '還沒有 YouTube 清單。在電台 App 切到 YouTube，貼上網址就會建立。');

  function listRow(list) {
    const item = h('div', 'st-listrow');
    item.dataset.id = list.id;
    item.dataset.search = `${list.name} youtube 清單`.toLowerCase();
    item.dataset.label = list.name;
    const name = h('button', 'st-listrow__name');
    name.type = 'button';
    name.textContent = list.name;
    name.setAttribute('aria-label', `${list.name}，點一下改名`);
    const count = text('span', 'st-listrow__count mono', `${list.items.length} 首`);
    const remove = button('刪除', 'btn--ghost st-mini', () => {
      const removed = lists.removeList(list.id);
      if (!removed) return;
      island.toast({ text: `已刪除「${removed.list.name.length > 8 ? `${removed.list.name.slice(0, 8)}…` : removed.list.name}」`, action: '復原', duration: 5000, onAction: () => lists.restoreList(removed.list, removed.index) });
    });
    name.addEventListener('click', () => {
      const input = h('input', 'st-listrow__input');
      input.value = list.name;
      input.maxLength = 24;
      input.setAttribute('aria-label', '清單名稱');
      name.hidden = true;
      name.after(input);
      input.focus();
      input.select();
      let done = false;
      const finish = (commit) => {
        if (done) return;
        done = true;
        if (commit && input.value.trim()) lists.renameList(list.id, input.value);
        input.remove();
        name.hidden = false;
      };
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') finish(true);
        else if (event.key === 'Escape') finish(false);
      });
      input.addEventListener('blur', () => finish(true));
    });
    item.append(name, count, remove);
    return item;
  }

  function renderLists() {
    ytList.textContent = '';
    lists.lists.forEach((list) => ytList.append(listRow(list)));
    ytEmpty.hidden = lists.lists.length > 0;
  }

  el.append(
    group([stationRow]),
    group([ytList, ytEmpty], { title: 'YouTube 清單', className: 'st-group--pad' }),
  );

  function sync() {
    const count = Radio.getStations().length;
    swapText(stationRow.hintEl, count ? `目前有 ${count} 台` : '匯入電台清單的 JSON 檔就能收聽');
    clearButton.hidden = !count;
    importButton.textContent = count ? '重新匯入' : '匯入清單';
    renderLists();
  }

  lists.subscribe(() => {
    if (el.isConnected) renderLists();
  });
  Radio.subscribe(() => {
    if (el.isConnected) {
      const count = Radio.getStations().length;
      clearButton.hidden = !count;
    }
  });
  sync();

  return {
    id: 'radio',
    title: '電台',
    lede: '電台清單與 YouTube 清單',
    icon: 'radio',
    el,
    show: sync,
  };
}
