function initWindowDragging() {
  const desktop = document.querySelector('.desktop');
  if (!desktop) return;

  const windows = Array.from(document.querySelectorAll('.window'));

  windows.forEach((windowEl, index) => {
    windowEl.style.zIndex = String(10 + index);

    const titlebar = windowEl.querySelector('.window__titlebar');
    if (!titlebar) return;

    bringToFrontOnPointerDown(windowEl, titlebar);
    enableDrag(windowEl, titlebar, desktop);
  });
}

function bringToFrontOnPointerDown(windowEl, titlebar) {
  titlebar.addEventListener('pointerdown', () => {
    const allWindows = document.querySelectorAll('.window');
    let maxZ = 10;
    allWindows.forEach((w) => {
      const z = parseInt(w.style.zIndex || '10', 10);
      if (z > maxZ) maxZ = z;
    });
    windowEl.style.zIndex = String(maxZ + 1);
  });
}

function enableDrag(windowEl, titlebar, desktop) {
  const DRAG_THRESHOLD = 4;

  let pointerId = null;
  let isDragging = false;
  let pendingDrag = false;
  let startPointerX = 0;
  let startPointerY = 0;
  let startLeft = 0;
  let startTop = 0;

  titlebar.addEventListener('pointerdown', (event) => {
    if (event.target.closest('[data-no-drag]')) return;

    pendingDrag = true;
    isDragging = false;
    pointerId = event.pointerId;
    startPointerX = event.clientX;
    startPointerY = event.clientY;
    startLeft = parseFloat(windowEl.style.left) || 0;
    startTop = parseFloat(windowEl.style.top) || 0;

    titlebar.setPointerCapture(event.pointerId);
  });

  titlebar.addEventListener('pointermove', (event) => {
    if (!pendingDrag) return;

    const deltaX = event.clientX - startPointerX;
    const deltaY = event.clientY - startPointerY;

    if (!isDragging) {
      if (Math.abs(deltaX) < DRAG_THRESHOLD && Math.abs(deltaY) < DRAG_THRESHOLD) {
        return;
      }

      windowEl.dataset.userPositioned = 'true';
      isDragging = true;
      windowEl.classList.add('is-dragging');
      windowEl.classList.remove('is-settling');
    }

    let newLeft = startLeft + deltaX;
    let newTop = startTop + deltaY;

    const desktopRect = desktop.getBoundingClientRect();
    const windowRect = windowEl.getBoundingClientRect();
    const minVisible = 60;

    newLeft = Math.max(-windowRect.width + minVisible, Math.min(newLeft, desktopRect.width - minVisible));
    newTop = Math.max(0, Math.min(newTop, desktopRect.height - minVisible));

    windowEl.style.left = `${newLeft}px`;
    windowEl.style.top = `${newTop}px`;
  });

  function endDrag(event) {
    const wasDragging = isDragging;
    pendingDrag = false;
    isDragging = false;

    if (pointerId !== null) {
      try { titlebar.releasePointerCapture(pointerId); } catch (err) {}
    }
    pointerId = null;

    if (!wasDragging) return;

    windowEl.classList.remove('is-dragging');
    windowEl.classList.add('is-settling');

    window.setTimeout(() => {
      windowEl.classList.remove('is-settling');
    }, 320);
  }

  titlebar.addEventListener('pointerup', endDrag);
  titlebar.addEventListener('pointercancel', endDrag);
}

export function boot() {
    initWindowDragging();
  }

export const Windows = { initWindowDragging };
