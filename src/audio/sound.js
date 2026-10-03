import { Storage } from '../core/storage/storage.js';
import { SOUNDS, SOUND_KEY, canPlay, normalizeSound, outputGain } from './catalog.js';
import { buildVoice } from './voices.js';

const IDLE_MS = 30000;
const TAP_DELAY = 34;

let ctx = null;
let master = null;
let prefs = normalizeSound(null);
let ducked = false;
let quiet = () => false;
let idleTimer = 0;
let tapTimer = 0;
let unlocked = false;
const listeners = new Set();

function AudioCtor() {
  return typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
}

function ensure() {
  if (ctx) return ctx;
  const Ctor = AudioCtor();
  if (!Ctor) return null;
  ctx = new Ctor({ latencyHint: 'interactive' });
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 10;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.18;
  master = ctx.createGain();
  master.gain.value = outputGain(prefs, { ducked });
  master.connect(comp);
  comp.connect(ctx.destination);
  return ctx;
}

function applyGain() {
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setTargetAtTime(outputGain(prefs, { ducked }), now, 0.08);
}

function rest() {
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
  }, IDLE_MS);
}

function emit() {
  listeners.forEach((fn) => fn(prefs));
}

function fire(id, pan) {
  const c = ensure();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  let out = master;
  if (pan && typeof c.createStereoPanner === 'function') {
    const p = c.createStereoPanner();
    p.pan.value = pan;
    p.connect(master);
    out = p;
  }
  buildVoice(c, out, id, c.currentTime + 0.006);
  rest();
}

function load() {
  prefs = normalizeSound(Storage.get(SOUND_KEY, null));
}

export const Sound = {
  init({ isQuiet } = {}) {
    load();
    if (isQuiet) quiet = isQuiet;
    const unlock = () => {
      if (unlocked || !prefs.enabled) return;
      unlocked = true;
      const c = ensure();
      if (c && c.state === 'suspended') c.resume().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
    window.addEventListener('keydown', unlock, { capture: true });
    if (typeof Storage.subscribe === 'function') {
      Storage.subscribe(({ keys }) => {
        if (!keys.includes(SOUND_KEY)) return;
        load();
        applyGain();
        emit();
      });
    }
  },
  get prefs() {
    return { ...prefs, kinds: { ...prefs.kinds } };
  },
  set(patch) {
    prefs = normalizeSound({ ...prefs, ...patch, kinds: { ...prefs.kinds, ...(patch.kinds || {}) } });
    Storage.set(SOUND_KEY, prefs);
    applyGain();
    emit();
    return Sound.prefs;
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  setDuck(on) {
    if (ducked === !!on) return;
    ducked = !!on;
    applyGain();
  },
  get ducked() {
    return ducked;
  },
  play(id, { pan = 0, force = false } = {}) {
    if (!canPlay(id, prefs, { quiet: quiet(), force })) return false;
    if (id === 'tap') {
      window.clearTimeout(tapTimer);
      tapTimer = window.setTimeout(() => {
        tapTimer = 0;
        fire('tap', pan);
      }, TAP_DELAY);
      return true;
    }
    if (tapTimer) {
      window.clearTimeout(tapTimer);
      tapTimer = 0;
    }
    fire(id, pan);
    return true;
  },
  async render(id) {
    const Offline = typeof window !== 'undefined' ? window.OfflineAudioContext || window.webkitOfflineAudioContext : null;
    if (!Offline || !SOUNDS[id]) return null;
    const rate = 44100;
    const off = new Offline(2, rate * 2, rate);
    const gain = off.createGain();
    gain.gain.value = outputGain({ ...prefs, volume: 1 });
    gain.connect(off.destination);
    buildVoice(off, gain, id, 0.01, { variance: 0 });
    const buffer = await off.startRendering();
    const data = buffer.getChannelData(0);
    let peak = 0;
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      const v = Math.abs(data[i]);
      if (v > peak) peak = v;
      if (v > 0.001) last = i;
    }
    return { id, peak: Number(peak.toFixed(3)), length: Number((last / rate).toFixed(3)) };
  },
};
