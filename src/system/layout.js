import { Data } from '../core/data-model.js';

const GAP = 24;

let relayoutScheduled = false;

function getColumnCount(containerWidth) {
  if (containerWidth >= 1400) return 3;
  if (containerWidth >= 820) return 2;
  return 1;
}

function computeLayout() {
  const container = document.querySelector('.window-flow');
  if (!container) return;

  if (container.querySelector('.window[data-dock-animating="true"]')) return;

  const windows = Array.from(container.querySelectorAll('.window'))
    .filter((el) => !el.classList.contains('window--hidden') && el.style.display !== 'none');
  if (windows.length === 0) return;

  const containerWidth = container.clientWidth || window.innerWidth;
  const columnCount = getColumnCount(containerWidth);

  const columnWidth = (containerWidth - GAP * (columnCount - 1)) / columnCount;
  const columnHeights = new Array(columnCount).fill(0);

  windows.forEach((windowEl) => {
    const isUserPositioned = windowEl.dataset.userPositioned === 'true';

    if (isUserPositioned) {
      windowEl.dataset.positioned = 'true';
      return;
    }

    let shortestCol = 0;
    for (let i = 1; i < columnHeights.length; i++) {
      if (columnHeights[i] < columnHeights[shortestCol]) shortestCol = i;
    }

    const left = shortestCol * (columnWidth + GAP);
    const top = columnHeights[shortestCol];

    windowEl.style.left = `${left}px`;
    windowEl.style.top = `${top}px`;

    const height = windowEl.offsetHeight;
    columnHeights[shortestCol] += height + GAP;

    windowEl.dataset.positioned = 'true';
  });

  const maxColumnHeight = Math.max(...columnHeights, 0);
  container.style.height = `${maxColumnHeight}px`;
}

function scheduleRelayout() {
  if (relayoutScheduled) return;
  relayoutScheduled = true;
  window.requestAnimationFrame(() => {
    relayoutScheduled = false;
    computeLayout();
  });
}

function debounce(fn, wait) {
  let timer = null;
  return function debounced(...args) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn.apply(this, args), wait);
  };
}

export function boot() {
  computeLayout();

  window.addEventListener('resize', debounce(scheduleRelayout, 200));
  window.addEventListener('yoworingo:rescale', scheduleRelayout);
  window.addEventListener('yoworingo:layout-changed', scheduleRelayout);

  if (Data) {
    Data.subscribe(debounce(scheduleRelayout, 150));
  }
}

export const Layout = { computeLayout, scheduleRelayout };
