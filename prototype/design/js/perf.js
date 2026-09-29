const WINDOW = 90;

export function startPerfMeter(element) {
  const [left, right] = element.children;
  const samples = [];
  let last = null;
  let frames = 0;

  function frame(now) {
    if (last !== null) {
      samples.push(now - last);
      if (samples.length > WINDOW) samples.shift();
    }
    last = now;
    frames += 1;
    if (frames % 15 === 0 && samples.length > 10) {
      const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
      const worst = Math.max(...samples);
      left.textContent = `${Math.round(1000 / average)} fps · ${average.toFixed(1)} ms`;
      right.textContent = `最長 ${worst.toFixed(1)} ms`;
    }
    requestAnimationFrame(frame);
  }

  document.addEventListener('visibilitychange', () => {
    last = null;
    samples.length = 0;
    if (document.visibilityState === 'hidden') {
      left.textContent = '分頁在背景';
      right.textContent = '暫停量測';
    }
  });

  requestAnimationFrame(frame);
}
