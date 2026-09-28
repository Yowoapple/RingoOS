import { Character } from '../apps/character/character.js';
import { Data } from '../core/data-model.js';
import { Dock } from './dock.js';
import { FontScale } from '../core/font-scale.js';
import { Fullscreen } from './fullscreen.js';
import { Persona } from '../apps/reminder/persona.js';
import { Theme } from '../core/theme.js';
import { TopbarWidgets } from './topbar-widgets.js';
import { Wallpaper } from './wallpaper.js';
import { WindowVisibility } from './window-visibility.js';

function bringToFront(windowEl) {
  const allWindows = document.querySelectorAll('.window');
  let maxZ = 10;
  allWindows.forEach((w) => {
    const z = parseInt(w.style.zIndex || '10', 10);
    if (z > maxZ) maxZ = z;
  });
  windowEl.style.zIndex = String(maxZ + 1);
}

function initSettingsPanel() {
  const windowEl = document.querySelector('[data-window-id="settings"]');
  const openBtn = document.querySelector('[data-settings-toggle]');
  if (!windowEl || !openBtn) return;

  function openPanel() {
    if (Dock && Dock.isDocked('settings')) {
      Dock.restoreWindow('settings');
    } else if (windowEl.style.display === 'none') {
      windowEl.style.display = '';
      bringToFront(windowEl);
    } else {
      bringToFront(windowEl);
    }
    syncAppearanceControls();
  }

  openBtn.addEventListener('click', openPanel);

  initTabSwitching();
  initAppearanceControls();
  initWallpaperControls();
  initFullscreenControls();
  initCategoryManagement();
  initPersonaControls();
  initCharacterToggle();
  initWindowsDockControls();
  initTopbarWidgetsControls();

  if (Dock) {
    Dock.minimizeInstant(windowEl);
  }
}

function initWindowsDockControls() {

  const legacyCheckbox = document.getElementById('legacy-reminder-visible-checkbox');
  if (legacyCheckbox && WindowVisibility) {
    legacyCheckbox.checked = WindowVisibility.isVisible('life-reminder');
    legacyCheckbox.addEventListener('change', () => {
      WindowVisibility.setVisible('life-reminder', legacyCheckbox.checked);
    });
  }

  const autoHideCheckbox = document.getElementById('dock-autohide-checkbox');
  if (autoHideCheckbox && Dock) {
    autoHideCheckbox.checked = Dock.isAutoHideEnabled();
    autoHideCheckbox.addEventListener('change', () => {
      Dock.setAutoHide(autoHideCheckbox.checked);
    });
  }

  const lookaheadInput = document.getElementById('task-reminder-lookahead-input');
  if (lookaheadInput && Data) {
    lookaheadInput.value = Data.getTaskReminderLookaheadDays();
    lookaheadInput.addEventListener('change', () => {
      Data.setTaskReminderLookaheadDays(lookaheadInput.value);
      lookaheadInput.value = Data.getTaskReminderLookaheadDays();
    });
  }
}

function initTopbarWidgetsControls() {
  if (!TopbarWidgets) return;

  TopbarWidgets.KEYS.forEach((key) => {
    const checkbox = document.getElementById(`topbar-widget-${key}-checkbox`);
    if (!checkbox) return;
    checkbox.checked = TopbarWidgets.isEnabled(key);
    checkbox.addEventListener('change', () => {
      TopbarWidgets.setEnabled(key, checkbox.checked);
    });
  });
}

function initTabSwitching() {
  const navItems = document.querySelectorAll('[data-settings-tab]');
  const sections = document.querySelectorAll('[data-settings-section]');

  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const target = item.dataset.settingsTab;

      navItems.forEach((n) => n.classList.toggle('is-active', n === item));
      sections.forEach((s) => s.classList.toggle('is-active', s.dataset.settingsSection === target));
    });
  });
}

function initAppearanceControls() {
  const themeButtons = document.querySelectorAll('[data-theme-set]');
  const slider = document.getElementById('settings-font-scale-slider');

  themeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      Theme.setTheme(btn.dataset.themeSet);
      syncAppearanceControls();
    });
  });

  if (slider) {
    slider.addEventListener('input', () => {
      FontScale.setScale(Number(slider.value) / 100);
    });
  }
}

function syncAppearanceControls() {
  const currentMode = document.documentElement.dataset.themeMode || 'auto';
  document.querySelectorAll('[data-theme-set]').forEach((btn) => {
    btn.classList.toggle('btn--primary', btn.dataset.themeSet === currentMode);
    btn.classList.toggle('btn--secondary', btn.dataset.themeSet !== currentMode);
  });

  const slider = document.getElementById('settings-font-scale-slider');
  const valueLabel = document.getElementById('settings-font-scale-value');
  if (slider && FontScale) {
    const currentScale = FontScale.getScale();
    slider.value = Math.round(currentScale * 100);
    if (valueLabel) valueLabel.textContent = `${Math.round(currentScale * 100)}%`;
  }
}

function initWallpaperControls() {
  const uploadBtn = document.getElementById('wallpaper-upload-btn');
  const clearBtn = document.getElementById('wallpaper-clear-btn');
  const fileInput = document.getElementById('wallpaper-file-input');
  const preview = document.getElementById('wallpaper-preview');
  const opacitySlider = document.getElementById('wallpaper-opacity-slider');
  const opacityValue = document.getElementById('wallpaper-opacity-value');
  const blurSlider = document.getElementById('wallpaper-blur-slider');
  const blurValue = document.getElementById('wallpaper-blur-value');
  if (!uploadBtn || !Wallpaper) return;

  function sync() {
    const state = Wallpaper.getState();
    preview.style.backgroundImage = state.dataUrl ? `url("${state.dataUrl}")` : 'none';
    clearBtn.disabled = !state.dataUrl;
    opacitySlider.value = state.opacity;
    opacityValue.textContent = `${state.opacity}%`;
    blurSlider.value = state.blur;
    blurValue.textContent = `${state.blur}px`;
  }

  uploadBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const originalLabel = uploadBtn.textContent;
    uploadBtn.disabled = true;
    uploadBtn.textContent = '處理中…';
    try {
      await Wallpaper.setImageFile(file);
      sync();
    } catch (err) {
      window.alert(err.message || '無法套用這張圖片，請換一張試試');
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = originalLabel;
      fileInput.value = '';
    }
  });

  clearBtn.addEventListener('click', () => {
    Wallpaper.clearImage();
    sync();
  });

  opacitySlider.addEventListener('input', () => {
    Wallpaper.setOpacity(Number(opacitySlider.value));
    opacityValue.textContent = `${opacitySlider.value}%`;
  });

  blurSlider.addEventListener('input', () => {
    Wallpaper.setBlur(Number(blurSlider.value));
    blurValue.textContent = `${blurSlider.value}px`;
  });

  sync();
}

function initFullscreenControls() {
  const autoCheckbox = document.getElementById('fullscreen-auto-checkbox');
  const manualBtn = document.getElementById('fullscreen-manual-btn');
  const hint = document.getElementById('fullscreen-hint');
  if (!autoCheckbox || !Fullscreen) return;

  if (!Fullscreen.isSupported()) {
    autoCheckbox.disabled = true;
    if (manualBtn) manualBtn.disabled = true;
    if (hint) hint.textContent = '這個瀏覽器不支援全螢幕功能，這裡暫時沒辦法使用。';
    return;
  }

  autoCheckbox.checked = Fullscreen.isAutoEnabled();
  autoCheckbox.addEventListener('change', () => {
    Fullscreen.setAutoEnabled(autoCheckbox.checked);
  });

  if (manualBtn) {
    manualBtn.addEventListener('click', () => Fullscreen.toggleFullscreen());
  }
}

function initPersonaControls() {
  const checkbox = document.getElementById('persona-enabled-checkbox');
  const typeChoices = document.getElementById('persona-type-choices');
  if (!checkbox || !Persona) return;

  const typeButtons = typeChoices.querySelectorAll('[data-persona-set]');

  function syncPersonaControls() {
    const enabled = Persona.isEnabled();
    checkbox.checked = enabled;
    typeChoices.style.opacity = enabled ? '1' : '0.4';
    typeChoices.style.pointerEvents = enabled ? 'auto' : 'none';

    const currentType = Persona.getType();
    typeButtons.forEach((btn) => {
      const isActive = btn.dataset.personaSet === currentType;
      btn.classList.toggle('btn--primary', isActive);
      btn.classList.toggle('btn--secondary', !isActive);
    });
  }

  checkbox.addEventListener('change', () => {
    Persona.setEnabled(checkbox.checked);
    syncPersonaControls();
  });

  typeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      Persona.setType(btn.dataset.personaSet);
      syncPersonaControls();
    });
  });

  window.addEventListener('yoworingo:persona-change', syncPersonaControls);

  syncPersonaControls();
}

function initCharacterToggle() {
  const checkbox = document.getElementById('character-enabled-checkbox');
  if (!checkbox || !Character) return;

  function sync() {
    checkbox.checked = Character.isEnabled();
  }

  checkbox.addEventListener('change', () => {
    Character.setEnabled(checkbox.checked);
  });

  window.addEventListener('yoworingo:character-toggle', sync);
  sync();
}

function initCategoryManagement() {
  const list = document.getElementById('settings-category-list');
  if (!list || !Data) return;

  const tabBtns = document.querySelectorAll('[data-settings-category-tab]');
  const newNameInput = document.getElementById('settings-new-category-name');
  const addBtn = document.getElementById('settings-add-category-btn');

  let activeType = 'expense';

  function setActiveType(type) {
    activeType = type;
    tabBtns.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.settingsCategoryTab === type));
    render();
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => setActiveType(btn.dataset.settingsCategoryTab));
  });

  addBtn.addEventListener('click', () => {
    const name = newNameInput.value.trim();
    if (!name) return;
    Data.addCategory(activeType, name);
    newNameInput.value = '';
  });

  function handleDelete(category) {
    const count = Data.countEntriesUsingCategory(activeType, category);
    if (count > 0) {
      const fallback = activeType === 'income' ? '其他收入' : '其他';
      const confirmed = window.confirm(
        `「${category}」還有 ${count} 筆記錄使用中，刪除後這些記錄會歸到「${fallback}」，確定要刪除嗎？`
      );
      if (!confirmed) return;
    }
    const result = Data.removeCategory(activeType, category);
    if (!result.ok && result.reason === 'fallback') {
      window.alert(`「${category}」是備援分類，其他分類刪除後的記錄都會歸到這裡，所以不能刪除它。`);
    }
  }

  function render() {
    const state = Data.getState();
    const categories = activeType === 'income'
      ? state.settings.incomeCategories
      : state.settings.expenseCategories;
    const fallback = activeType === 'income' ? '其他收入' : '其他';

    list.innerHTML = categories.map((cat) => {
      const isFallback = cat === fallback;
      const deleteBtn = isFallback
        ? '<span class="category-chip__fallback-hint" title="這是備援分類，不能刪除">備援</span>'
        : `<button type="button" class="category-chip__delete" data-delete-category="${escapeHtml(cat)}" aria-label="刪除「${escapeHtml(cat)}」分類">×</button>`;
      return `<span class="category-chip">${escapeHtml(cat)}${deleteBtn}</span>`;
    }).join('');

    list.querySelectorAll('[data-delete-category]').forEach((btn) => {
      btn.addEventListener('click', () => handleDelete(btn.dataset.deleteCategory));
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  render();
  Data.subscribe(render);
}

export function boot() {
  try {
    initSettingsPanel();
  } catch (err) {
    console.error('Life Ledger：設定面板初始化失敗', err);
  }
}
