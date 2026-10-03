const noiseCache = new WeakMap();

function noiseBuffer(ctx) {
  let buffer = noiseCache.get(ctx);
  if (buffer) return buffer;
  buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  noiseCache.set(ctx, buffer);
  return buffer;
}

function envelope(ctx, at, attack, decay, gain) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  return g;
}

function tone(ctx, out, { at, freq, to = freq, glide = 0.06, type = 'sine', attack = 0.004, decay = 0.12, gain = 0.3 }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (to !== freq) osc.frequency.exponentialRampToValueAtTime(to, at + glide);
  const g = envelope(ctx, at, attack, decay, gain);
  osc.connect(g);
  g.connect(out);
  osc.start(at);
  osc.stop(at + attack + decay + 0.05);
}

function noise(ctx, out, { at, duration, type = 'bandpass', from = 1200, to = from, q = 1, gain = 0.15, attack = 0.004 }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(from, at);
  if (to !== from) filter.frequency.exponentialRampToValueAtTime(to, at + duration);
  filter.Q.value = q;
  const g = envelope(ctx, at, attack, Math.max(0.01, duration - attack), gain);
  src.connect(filter);
  filter.connect(g);
  g.connect(out);
  src.start(at, Math.random() * 0.5);
  src.stop(at + duration + 0.05);
}

function bell(ctx, out, { at, freq, decay = 0.9, gain = 0.12 }) {
  tone(ctx, out, { at, freq, attack: 0.003, decay, gain });
  tone(ctx, out, { at, freq: freq * 2.01, attack: 0.002, decay: decay * 0.55, gain: gain * 0.28 });
  tone(ctx, out, { at, freq: freq * 3.98, attack: 0.002, decay: decay * 0.3, gain: gain * 0.09 });
}

const VOICES = {
  tap(ctx, out, at, r) {
    tone(ctx, out, { at, freq: 230 * r, to: 150 * r, glide: 0.03, decay: 0.05, gain: 0.32 });
    noise(ctx, out, { at, duration: 0.012, from: 2600, q: 1.4, gain: 0.05 });
  },
  toggleOn(ctx, out, at, r) {
    tone(ctx, out, { at, freq: 300 * r, to: 260 * r, decay: 0.06, gain: 0.26 });
    tone(ctx, out, { at: at + 0.045, freq: 450 * r, to: 420 * r, decay: 0.08, gain: 0.24 });
  },
  toggleOff(ctx, out, at, r) {
    tone(ctx, out, { at, freq: 450 * r, to: 420 * r, decay: 0.06, gain: 0.22 });
    tone(ctx, out, { at: at + 0.045, freq: 290 * r, to: 240 * r, decay: 0.08, gain: 0.24 });
  },
  switch(ctx, out, at, r) {
    tone(ctx, out, { at, freq: 170 * r, to: 120 * r, glide: 0.04, decay: 0.06, gain: 0.3 });
    tone(ctx, out, { at, freq: 620 * r, type: 'triangle', decay: 0.03, gain: 0.07 });
  },
  key(ctx, out, at, r) {
    tone(ctx, out, { at, freq: 320 * r, to: 230 * r, glide: 0.025, decay: 0.035, gain: 0.26 });
    noise(ctx, out, { at, duration: 0.01, from: 3200, q: 1.2, gain: 0.04 });
  },
  error(ctx, out, at, r) {
    tone(ctx, out, { at, freq: 150 * r, to: 95 * r, glide: 0.1, decay: 0.16, gain: 0.34 });
    tone(ctx, out, { at: at + 0.09, freq: 130 * r, to: 90 * r, glide: 0.08, decay: 0.14, gain: 0.26 });
  },
  open(ctx, out, at, r) {
    noise(ctx, out, { at, duration: 0.2, from: 420, to: 1700, q: 0.8, gain: 0.07, attack: 0.03 });
    tone(ctx, out, { at, freq: 240 * r, to: 360 * r, glide: 0.14, attack: 0.02, decay: 0.16, gain: 0.16 });
  },
  close(ctx, out, at, r) {
    noise(ctx, out, { at, duration: 0.18, from: 1500, to: 380, q: 0.8, gain: 0.06, attack: 0.012 });
    tone(ctx, out, { at, freq: 340 * r, to: 210 * r, glide: 0.12, attack: 0.008, decay: 0.14, gain: 0.15 });
  },
  minimize(ctx, out, at, r) {
    noise(ctx, out, { at, duration: 0.14, from: 1200, to: 300, q: 0.9, gain: 0.05 });
    tone(ctx, out, { at: at + 0.08, freq: 160 * r, to: 110 * r, glide: 0.05, decay: 0.08, gain: 0.24 });
  },
  success(ctx, out, at, r) {
    tone(ctx, out, { at, freq: 210 * r, to: 150 * r, glide: 0.04, decay: 0.06, gain: 0.2 });
    [1318.5, 1661.2, 1975.5].forEach((f, i) => bell(ctx, out, { at: at + 0.03 + i * 0.045, freq: f * r, decay: 0.85, gain: 0.07 }));
  },
  remove(ctx, out, at, r) {
    noise(ctx, out, { at, duration: 0.13, type: 'highpass', from: 1400, to: 3000, q: 0.7, gain: 0.07 });
    tone(ctx, out, { at, freq: 190 * r, to: 120 * r, glide: 0.08, decay: 0.09, gain: 0.2 });
  },
  undo(ctx, out, at, r) {
    tone(ctx, out, { at, freq: 280 * r, to: 470 * r, glide: 0.09, attack: 0.01, decay: 0.12, gain: 0.22 });
    bell(ctx, out, { at: at + 0.08, freq: 1175 * r, decay: 0.35, gain: 0.05 });
  },
  notify(ctx, out, at, r) {
    bell(ctx, out, { at, freq: 880 * r, decay: 0.5, gain: 0.08 });
    bell(ctx, out, { at: at + 0.11, freq: 1174.7 * r, decay: 0.6, gain: 0.08 });
  },
  achievement(ctx, out, at, r) {
    tone(ctx, out, { at, freq: 200 * r, to: 140 * r, glide: 0.05, decay: 0.08, gain: 0.2 });
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(ctx, out, { at: at + 0.04 + i * 0.06, freq: f * r, decay: 1.3, gain: 0.065 }));
    noise(ctx, out, { at: at + 0.22, duration: 0.5, type: 'highpass', from: 6000, q: 0.5, gain: 0.018, attack: 0.05 });
  },
  pat(ctx, out, at, r) {
    tone(ctx, out, { at, freq: 520 * r, to: 700 * r, glide: 0.05, decay: 0.07, gain: 0.14 });
    tone(ctx, out, { at: at + 0.07, freq: 600 * r, to: 820 * r, glide: 0.05, decay: 0.08, gain: 0.12 });
  },
  treat(ctx, out, at, r) {
    tone(ctx, out, { at, freq: 420 * r, to: 360 * r, glide: 0.04, decay: 0.06, gain: 0.18 });
    tone(ctx, out, { at: at + 0.11, freq: 380 * r, to: 300 * r, glide: 0.05, decay: 0.07, gain: 0.16 });
  },
  checkin(ctx, out, at, r) {
    [659.3, 880, 987.8].forEach((f, i) => tone(ctx, out, { at: at + i * 0.07, freq: f * r, to: f * r * 1.02, type: 'triangle', decay: 0.12, gain: 0.1 }));
  },
  chirp(ctx, out, at, r) {
    tone(ctx, out, { at, freq: 880 * r, to: 1320 * r, glide: 0.06, decay: 0.07, gain: 0.1 });
  },
};

export const VOICE_IDS = Object.keys(VOICES);

export function buildVoice(ctx, out, id, at, { variance = 0.03 } = {}) {
  const voice = VOICES[id];
  if (!voice) return false;
  const r = 1 + (Math.random() * 2 - 1) * variance;
  voice(ctx, out, at, r);
  return true;
}
