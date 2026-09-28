import { Animator } from '../../src/motion/animator.js';
import { ACTIONS, MotionSettings, PRESETS } from '../../src/motion/presets.js';

const ACTION_LABELS = {
  open: '開啟',
  close: '關閉、縮小',
  focus: '聚焦',
  snap: '最大化、吸附',
  drag: '拖曳放開',
  dock: 'Dock',
};

const SPEEDS = [1, 0.5, 0.25, 0.1];

function segmented(name, options, current) {
  return `<div class="tweaks__seg" data-seg="${name}">${options
    .map(([value, label]) => `<button type="button" data-value="${value}" aria-pressed="${String(value) === String(current)}">${label}</button>`)
    .join('')}</div>`;
}

export function createTweaks({ panel, toggle, dock, root, hud }) {
  const state = { speed: 1, dockMode: 'launcher', debug: false, hud: false, theme: 'system' };

  function springRows() {
    return ACTIONS.map((action) => {
      const spring = MotionSettings.raw(action);
      return `
        <div class="tweaks__spring" data-action="${action}">
          <div class="tweaks__spring-head"><span>${ACTION_LABELS[action]}</span><span data-readout>${spring.response.toFixed(2)}s · ${spring.damping.toFixed(2)}</span></div>
          <input type="range" min="0.1" max="1" step="0.01" value="${spring.response}" data-param="response" aria-label="${ACTION_LABELS[action]} response">
          <input type="range" min="0.1" max="1.2" step="0.01" value="${spring.damping}" data-param="damping" aria-label="${ACTION_LABELS[action]} damping">
        </div>`;
    }).join('');
  }

  function render() {
    panel.innerHTML = `
      <div class="tweaks__title"><span>Tweaks</span></div>
      <section class="tweaks__section">
        <h3>動畫預設</h3>
        ${segmented('preset', Object.entries(PRESETS).map(([key, preset]) => [key, preset.label]), MotionSettings.presetName)}
        <label class="tweaks__row"><span>開啟時背景縮小模糊</span><input type="checkbox" data-toggle="backdrop" ${MotionSettings.backdrop ? 'checked' : ''}></label>
      </section>
      <section class="tweaks__section">
        <h3>彈簧（上：response 秒數，下：damping）</h3>
        ${springRows()}
      </section>
      <section class="tweaks__section">
        <h3>播放速度</h3>
        ${segmented('speed', SPEEDS.map((s) => [s, `${s}×`]), state.speed)}
        <label class="tweaks__row"><span>減少動態效果</span><input type="checkbox" data-toggle="reduced" ${MotionSettings.reduced ? 'checked' : ''}></label>
      </section>
      <section class="tweaks__section">
        <h3>Dock</h3>
        ${segmented('dock', [['launcher', '常駐啟動器'], ['minimized', '只放縮小的視窗']], state.dockMode)}
      </section>
      <section class="tweaks__section">
        <h3>外觀與除錯</h3>
        ${segmented('theme', [['system', '跟隨系統'], ['light', '淺色'], ['dark', '深色']], state.theme)}
        <label class="tweaks__row"><span>除錯框線</span><input type="checkbox" data-toggle="debug" ${state.debug ? 'checked' : ''}></label>
        <label class="tweaks__row"><span>效能 HUD</span><input type="checkbox" data-toggle="hud" ${state.hud ? 'checked' : ''}></label>
      </section>
      <button type="button" class="tweaks__reset" data-reset>重設為目前預設的參數</button>
    `;
  }

  function applyTheme() {
    if (state.theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.dataset.theme = state.theme;
  }

  panel.addEventListener('input', (event) => {
    const input = event.target;
    const row = input.closest('[data-action]');
    if (!row || input.type !== 'range') return;
    MotionSettings.setSpring(row.dataset.action, { [input.dataset.param]: Number(input.value) });
    const spring = MotionSettings.raw(row.dataset.action);
    row.querySelector('[data-readout]').textContent = `${spring.response.toFixed(2)}s · ${spring.damping.toFixed(2)}`;
  });

  panel.addEventListener('change', (event) => {
    const input = event.target;
    const key = input.dataset.toggle;
    if (!key) return;
    if (key === 'backdrop') MotionSettings.setBackdrop(input.checked);
    if (key === 'reduced') MotionSettings.setReduced(input.checked);
    if (key === 'debug') {
      state.debug = input.checked;
      root.classList.toggle('is-debug', state.debug);
    }
    if (key === 'hud') {
      state.hud = input.checked;
      hud.setEnabled(state.hud);
    }
  });

  panel.addEventListener('click', (event) => {
    if (event.target.closest('[data-reset]')) {
      MotionSettings.usePreset(MotionSettings.presetName);
      render();
      return;
    }
    const button = event.target.closest('[data-seg] button');
    if (!button) return;
    const seg = button.closest('[data-seg]').dataset.seg;
    const value = button.dataset.value;
    if (seg === 'preset') MotionSettings.usePreset(value);
    if (seg === 'speed') {
      state.speed = Number(value);
      Animator.setTimeScale(state.speed);
    }
    if (seg === 'dock') {
      state.dockMode = value;
      dock.setMode(value);
    }
    if (seg === 'theme') {
      state.theme = value;
      applyTheme();
    }
    render();
  });

  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  }

  toggle.addEventListener('click', () => setOpen(panel.hidden));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) setOpen(false);
    if (event.key === 'T' && event.shiftKey && !event.target.closest('input, textarea')) setOpen(panel.hidden);
  });

  render();
  return { setOpen };
}
