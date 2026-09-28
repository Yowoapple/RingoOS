export const SESSION_VERSION = 1;

const STATES = new Set(['open', 'minimized', 'closed']);
const ZONES = new Set(['left', 'right', 'max']);

function isFrame(value) {
  return !!value
    && typeof value === 'object'
    && ['x', 'y', 'w', 'h'].every((key) => Number.isFinite(value[key]))
    && value.w > 0
    && value.h > 0;
}

function cleanFrame(value) {
  return isFrame(value) ? { x: value.x, y: value.y, w: value.w, h: value.h } : null;
}

export function serializeSession(store) {
  const windows = {};
  store.all().forEach((record) => {
    windows[record.id] = {
      state: record.state,
      frame: cleanFrame(record.frame),
      snap: record.snap,
      restore: cleanFrame(record.restore),
    };
  });
  return { version: SESSION_VERSION, order: store.order(), focused: store.focusedId, windows };
}

export function sanitizeSession(raw, knownIds) {
  if (!raw || typeof raw !== 'object' || raw.version !== SESSION_VERSION || !raw.windows || typeof raw.windows !== 'object') return null;
  const known = new Set(knownIds);
  const windows = {};
  Object.entries(raw.windows).forEach(([id, value]) => {
    if (!known.has(id) || !value || typeof value !== 'object') return;
    const state = STATES.has(value.state) ? value.state : 'closed';
    const frame = cleanFrame(value.frame);
    const snap = ZONES.has(value.snap) && state !== 'closed' ? value.snap : null;
    windows[id] = {
      state: frame || snap ? state : 'closed',
      frame,
      snap,
      restore: snap ? cleanFrame(value.restore) : null,
    };
  });
  const listed = Array.isArray(raw.order) ? raw.order.filter((id, index, all) => known.has(id) && all.indexOf(id) === index) : [];
  const order = listed.concat(knownIds.filter((id) => !listed.includes(id)));
  const focused = known.has(raw.focused) && windows[raw.focused] && windows[raw.focused].state === 'open' ? raw.focused : null;
  return { version: SESSION_VERSION, order, focused, windows };
}
