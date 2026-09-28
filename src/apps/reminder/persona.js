import { Storage } from '../../core/storage/storage.js';

const ENABLED_KEY = 'yoworingo.persona-enabled';
const TYPE_KEY = 'yoworingo.persona-type';
const VALID_TYPES = ['maid', 'wife', 'sister'];
const DEFAULT_TYPE = 'maid';

function isEnabled() {
  try {
    return Storage.get(ENABLED_KEY, null) === 'true';
  } catch (err) {
    return false;
  }
}

function getType() {
  try {
    const stored = Storage.get(TYPE_KEY, null);
    return VALID_TYPES.includes(stored) ? stored : DEFAULT_TYPE;
  } catch (err) {
    return DEFAULT_TYPE;
  }
}

function setEnabled(enabled) {
  try {
    Storage.set(ENABLED_KEY, enabled ? 'true' : 'false');
  } catch (err) {}
  notifyChange();
}

function setType(type) {
  if (!VALID_TYPES.includes(type)) return;
  try {
    Storage.set(TYPE_KEY, type);
  } catch (err) {}
  notifyChange();
}

function notifyChange() {
  window.dispatchEvent(new CustomEvent('yoworingo:persona-change'));
}

export const Persona = {
  isEnabled,
  getType,
  setEnabled,
  setType,
  VALID_TYPES,
};
