import { Persona } from '../../reminder/persona.js';
import { Data } from '../../../core/data-model.js';
import { createOdometer } from '../../../ui/odometer.js';
import { group, h, pulse, row, segmented, swapText } from '../kit.js';

const VOICES = ['neutral', 'maid', 'wife', 'sister'];
const SAMPLES = {
  neutral: '這個月花得比上個月同期少，照這樣下去月底會在預算內。',
  maid: '主人，這個月比上個月同期省了一些，奴家會好好看著預算的。',
  wife: '這個月比上個月省了一點，照這樣月底沒問題，晚餐想吃什麼？',
  sister: '欸這個月花得比上個月少耶 (｀・ω・´)，照這樣月底穩穩的啦！',
};

function currentVoice() {
  return Persona.isEnabled() ? Persona.getType() : 'neutral';
}

export function reminderPage() {
  const el = h('div', 'st-page__body');
  const sample = h('p', 'st-quote');
  sample.textContent = SAMPLES[currentVoice()];
  const voice = segmented(['一般', '女僕', '老婆', '妹妹'], VOICES.indexOf(currentVoice()), (i) => {
    const next = VOICES[i];
    if (next === 'neutral') Persona.setEnabled(false);
    else {
      Persona.setType(next);
      Persona.setEnabled(true);
    }
    swapText(sample, SAMPLES[next]);
  }, { label: '語氣' });

  const stepper = h('div', 'st-stepper');
  stepper.innerHTML = '<button type="button" class="st-stepper__btn" aria-label="少一天">−</button><span class="st-stepper__num mono"><span class="odo-host"></span><span class="st-stepper__unit">天</span></span><button type="button" class="st-stepper__btn" aria-label="多一天">＋</button>';
  const [minus, plus] = stepper.querySelectorAll('button');
  const days = createOdometer(stepper.querySelector('.odo-host'), { value: Data.getTaskReminderLookaheadDays(), format: (v) => String(Math.round(v)) });
  function setDays(next) {
    const value = Math.max(0, Math.min(7, next));
    minus.disabled = value <= 0;
    plus.disabled = value >= 7;
    if (value === Data.getTaskReminderLookaheadDays()) return;
    Data.setTaskReminderLookaheadDays(value);
    pulse(stepper);
  }
  minus.addEventListener('click', () => setDays(Data.getTaskReminderLookaheadDays() - 1));
  plus.addEventListener('click', () => setDays(Data.getTaskReminderLookaheadDays() + 1));

  el.append(
    group([
      row({ label: '提醒的語氣', hint: '生活提醒與天氣小語都會用這個語氣說話', control: voice.el, keywords: '角色 女僕 老婆 妹妹 persona 口吻' }),
      sample,
    ], { className: 'st-group--voice' }),
    group([
      row({ label: '提前幾天提醒代辦', hint: '0 天＝只看今天；Dock 上日曆的數字以這個為準', control: stepper, keywords: '代辦 日曆 提醒 天數' }),
    ]),
  );

  function sync() {
    voice.api.select(VOICES.indexOf(currentVoice()));
    swapText(sample, SAMPLES[currentVoice()]);
    const value = Data.getTaskReminderLookaheadDays();
    days.set(value);
    minus.disabled = value <= 0;
    plus.disabled = value >= 7;
  }

  window.addEventListener('yoworingo:persona-change', sync);
  Data.subscribe(() => days.set(Data.getTaskReminderLookaheadDays()));
  sync();

  return {
    id: 'reminder',
    title: '提醒與日曆',
    lede: '說話的語氣與代辦提醒',
    icon: 'reminder',
    el,
    show() {
      voice.api.measure();
      sync();
    },
    refreshGlass() {
      voice.api.refreshGlass();
    },
  };
}
