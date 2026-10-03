import { particleCount } from './plan.js';

const BUCKETS = 3;

export function createSnow(env) {
  let cfg = env;
  let flakes = [];
  let time = 0;

  function place(f, anywhere) {
    f.z = Math.random();
    f.x = Math.random() * cfg.w;
    f.y = anywhere ? Math.random() * cfg.h : -10 - Math.random() * 40;
    f.r = 0.9 + f.z * 2.6;
    f.vy = 20 + f.z * 52;
    f.phase = Math.random() * Math.PI * 2;
    f.sway = 6 + f.z * 16;
    f.freq = 0.5 + Math.random() * 0.9;
    f.ox = 0;
    f.vx = 0;
    f.bucket = Math.min(BUCKETS - 1, Math.floor(f.z * BUCKETS));
    return f;
  }

  function fill() {
    const want = particleCount('snow', cfg.intensity, cfg);
    while (flakes.length < want) flakes.push(place({}, true));
    if (flakes.length > want) flakes = flakes.slice(0, want);
  }

  fill();

  return {
    staticSkip: true,
    configure(next) {
      cfg = next;
      fill();
    },
    update(dt) {
      time += dt;
      const p = cfg.pointer;
      flakes.forEach((f) => {
        f.y += f.vy * dt;
        f.x += f.vy * cfg.slope * dt;
        if (p && p.active) {
          const sx = f.x + f.ox + Math.sin(time * f.freq + f.phase) * f.sway;
          const dx = sx - p.x;
          const dy = f.y - p.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 6400 && d2 > 1) {
            const push = (1 - Math.sqrt(d2) / 80) * 420;
            f.vx += (dx / Math.sqrt(d2)) * push * dt;
          }
        }
        f.ox += f.vx * dt;
        f.vx *= Math.exp(-dt * 3);
        f.ox *= Math.exp(-dt * 0.6);
        if (f.y - f.r > cfg.h) place(f, false);
        if (f.x > cfg.w + 30) f.x -= cfg.w + 60;
        if (f.x < -30) f.x += cfg.w + 60;
      });
    },
    draw(ctx, alpha) {
      const rgb = cfg.dark ? '255, 255, 255' : '138, 168, 206';
      for (let b = 0; b < BUCKETS; b += 1) {
        const z = (b + 0.5) / BUCKETS;
        ctx.fillStyle = `rgba(${rgb}, ${((0.32 + z * 0.5) * alpha).toFixed(3)})`;
        ctx.beginPath();
        flakes.forEach((f) => {
          if (f.bucket !== b) return;
          const x = f.x + f.ox + Math.sin(time * f.freq + f.phase) * f.sway;
          ctx.moveTo(x + f.r, f.y);
          ctx.arc(x, f.y, f.r, 0, Math.PI * 2);
        });
        ctx.fill();
      }
    },
  };
}
