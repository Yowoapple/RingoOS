import { boot as bootTheme } from './core/theme.js';
import { boot as bootFontScale } from './core/font-scale.js';
import { boot as bootWallpaper, Wallpaper } from './system/wallpaper.js';
import { boot as bootFullscreen } from './system/fullscreen.js';
import { Storage } from './core/storage/storage.js';
import { Data } from './core/data-model.js';
import './core/data-io.js';
import './core/calculations.js';
import './apps/reminder/messages.js';
import './apps/reminder/persona.js';
import { boot as bootForms } from './apps/ledger/forms.js';
import { boot as bootOverview } from './apps/ledger/overview.js';
import { boot as bootRecommendations } from './apps/reminder/recommendations.js';
import { boot as bootSavings } from './apps/ledger/savings.js';
import { boot as bootCharacter } from './apps/character/character.js';
import { boot as bootCharacterBubble } from './apps/character/character-bubble.js';
import { Desktop } from './system/desktop.js';
import { Animator } from './motion/animator.js';
import { boot as bootSettingsPanel } from './system/settings-panel.js';
import './apps/weather/weather.js';
import { boot as bootWeatherPanel } from './apps/weather/weather-panel.js';
import { boot as bootCalculator } from './apps/calculator/calculator.js';
import { Radio } from './apps/radio/radio.js';
import { boot as bootRadioPanel } from './apps/radio/radio-panel.js';
import { boot as bootCalendar } from './apps/calendar/calendar.js';
import { boot as bootTopbarWidgets, TopbarWidgets } from './system/topbar-widgets.js';

const bootSequence = [
  ['bootTheme', bootTheme],
  ['bootFontScale', bootFontScale],
  ['bootWallpaper', bootWallpaper],
  ['bootFullscreen', bootFullscreen],
  ['bootDesktop', Desktop.boot],
  ['bootForms', bootForms],
  ['bootOverview', bootOverview],
  ['bootRecommendations', bootRecommendations],
  ['bootSavings', bootSavings],
  ['bootCharacter', bootCharacter],
  ['bootCharacterBubble', bootCharacterBubble],
  ['bootSettingsPanel', bootSettingsPanel],
  ['bootWeatherPanel', bootWeatherPanel],
  ['bootCalculator', bootCalculator],
  ['bootRadioPanel', bootRadioPanel],
  ['bootCalendar', bootCalendar],
  ['bootTopbarWidgets', bootTopbarWidgets],
];

async function hydrateFromStorage() {
  await Storage.init();
  Storage.importLegacyPrefs();
  Data.hydrate();
  Wallpaper.hydrate();
  TopbarWidgets.hydrate();
}

const preloadTasks = [
  ['storage', () => hydrateFromStorage().then(() => Radio.loadStations())],
];

function domReady() {
  if (document.readyState !== 'loading') return Promise.resolve();
  return new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
}

async function preload() {
  const results = await Promise.allSettled(preloadTasks.map(([, task]) => task()));
  results.forEach((result, index) => {
    if (result.status === 'rejected') console.error(`RingoOS: preload ${preloadTasks[index][0]} failed`, result.reason);
  });
}

function runBootSequence() {
  bootSequence.forEach(([name, boot]) => {
    try {
      boot();
    } catch (err) {
      console.error(`RingoOS: ${name} failed`, err);
    }
  });
}

function signature() {
  console.info('%cRingoOS%c by YoWoRingo', 'font-weight:700;font-size:14px', 'color:#8b8f9a');
  if (new URLSearchParams(window.location.search).has('debug')) {
    window.__ringo = { Animator, Desktop, Storage };
  }
}

Promise.all([preload(), domReady()]).then(runBootSequence).then(signature);
