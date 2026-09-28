export const ACTIONS = ['open', 'close', 'focus', 'snap', 'drag', 'dock'];

export const PRESETS = {
  ios: {
    label: 'iOS',
    springs: {
      open: { response: 0.42, damping: 0.86 },
      close: { response: 0.35, damping: 1 },
      focus: { response: 0.3, damping: 1 },
      snap: { response: 0.4, damping: 0.9 },
      drag: { response: 0.4, damping: 0.8 },
      dock: { response: 0.25, damping: 0.9 },
    },
    backdrop: false,
  },
  hyperos: {
    label: '澎湃 OS',
    springs: {
      open: { response: 0.5, damping: 0.72 },
      close: { response: 0.4, damping: 0.85 },
      focus: { response: 0.3, damping: 0.9 },
      snap: { response: 0.45, damping: 0.8 },
      drag: { response: 0.45, damping: 0.7 },
      dock: { response: 0.28, damping: 0.8 },
    },
    backdrop: true,
  },
};

const REDUCED_FADE = { response: 0.22, damping: 1 };

function clone(preset) {
  return { springs: JSON.parse(JSON.stringify(preset.springs)), backdrop: preset.backdrop };
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

let presetName = 'ios';
let current = clone(PRESETS.ios);
let reduced = prefersReducedMotion();
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener());
}

export const MotionSettings = {
  get presetName() { return presetName; },
  get reduced() { return reduced; },
  get backdrop() { return current.backdrop && !reduced; },
  spring(action) {
    return reduced ? REDUCED_FADE : current.springs[action];
  },
  raw(action) {
    return current.springs[action];
  },
  usePreset(name) {
    if (!PRESETS[name]) return;
    presetName = name;
    current = clone(PRESETS[name]);
    emit();
  },
  setSpring(action, values) {
    current.springs[action] = { ...current.springs[action], ...values };
    emit();
  },
  setBackdrop(value) {
    current.backdrop = !!value;
    emit();
  },
  setReduced(value) {
    reduced = !!value;
    emit();
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
