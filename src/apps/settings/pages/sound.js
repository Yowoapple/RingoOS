import { Sound } from '../../../audio/sound.js';
import { KINDS, SOUNDS } from '../../../audio/catalog.js';
import { group, h, row, slider, swapText, toggle } from '../kit.js';

export function soundPage() {
  const el = h('div', 'st-page__body');
  let prefs = Sound.prefs;

  const master = toggle(prefs.enabled, (on) => {
    Sound.set({ enabled: on, asked: true });
    if (on) Sound.play('success', { force: true });
  }, '系統音效');
  const masterRow = row({ label: '系統音效', hint: '', control: master.el, keywords: '聲音 音效 靜音 sound mute' });

  let previewTimer = 0;
  const volume = slider({
    min: 0,
    max: 100,
    step: 5,
    value: Math.round(prefs.volume * 100),
    format: (v) => `${Math.round(v)}%`,
    label: '音量',
    onInput(v) {
      Sound.set({ volume: v / 100 });
      window.clearTimeout(previewTimer);
      previewTimer = window.setTimeout(() => Sound.play('switch', { force: true }), 160);
    },
  });
  const volumeRow = row({ label: '音量', control: volume.el, stack: true, keywords: '聲音 音量 大小聲 volume' });

  const kindToggles = KINDS.map((kind) => {
    const t = toggle(prefs.kinds[kind.id], (on) => Sound.set({ kinds: { [kind.id]: on } }), kind.label);
    const hints = {
      ui: '點擊、開關、切換選項、計算機按鍵',
      window: '打開、關閉、縮到 Dock',
      notify: '記一筆完成、刪除與復原、通知、成就；勿擾時這類會安靜',
      pet: '摸頭、吃點心、打卡、逗她',
    };
    return { kind, t, row: row({ label: kind.label, hint: hints[kind.id], control: t.el, keywords: `聲音 ${kind.label}` }) };
  });

  const tryWrap = h('div', 'st-sound-try');
  KINDS.forEach((kind) => {
    const line = h('div', 'st-sound-try__line');
    line.append(h('span', 'st-sound-try__kind', kind.label));
    const chips = h('div', 'st-chips');
    Object.entries(SOUNDS).filter(([, s]) => s.kind === kind.id).forEach(([id, s]) => {
      const chip = h('button', 'chip chip--sm');
      chip.type = 'button';
      chip.textContent = s.label;
      chip.addEventListener('click', () => Sound.play(id, { force: true }));
      chips.append(chip);
    });
    line.append(chips);
    tryWrap.append(line);
  });
  const tryRow = row({ label: '試聽', hint: '按一下聽聽看；就算音效關著也會播', control: tryWrap, stack: true, keywords: '試聽 聲音 預覽' });

  function sync(next = Sound.prefs) {
    prefs = next;
    master.api.set(prefs.enabled);
    if (typeof volume.api.set === 'function' && document.activeElement !== volume.el) volume.api.set(Math.round(prefs.volume * 100));
    kindToggles.forEach(({ kind, t, row: r }) => {
      t.api.set(prefs.kinds[kind.id]);
      r.el.classList.toggle('is-off', !prefs.enabled);
    });
    volumeRow.el.classList.toggle('is-off', !prefs.enabled);
    swapText(masterRow.hintEl, prefs.enabled
      ? '用合成的聲音，不下載音檔；電台或 YouTube 播放時會自動壓低'
      : '目前靜音；打開後介面、視窗、通知和桌寵都會有聲音');
  }

  Sound.subscribe(sync);

  el.append(
    group([masterRow, volumeRow]),
    group(kindToggles.map((k) => k.row), { title: '分類' }),
    group([tryRow]),
  );

  return {
    id: 'sound',
    title: '聲音',
    lede: '系統音效、音量與試聽',
    icon: 'sound',
    el,
    show: () => sync(),
    sync: () => sync(),
  };
}
