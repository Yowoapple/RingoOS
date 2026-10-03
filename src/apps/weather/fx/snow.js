import { hasDetail, levelAlpha, particleCount } from './plan.js';

const BUCKETS = 3;

export function createSnow(env) {
  let cfg = env;
  let flakes = [];
  const resting = [];
  let time = 0;

  function place(f, anywhere) {
    f.z = Math.random();
    f.x = Math.random() * cfg.w;
    f.y = anywhere ? Math.random() * cfg.h : -10 - Math.random() * 40;
    f.r = 0.8 + f.z * 2.1;
    f.vy = 18 + f.z * 44;
    f.phase = Math.random() * Math.PI * 2;
    f.sway = 5 + f.z * 13;
    f.freq = 0.5 + Math.random() * 0.8;
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
      const settle = hasDetail(cfg.level, 'settle');
      const cards = cfg.regions ? cfg.regions.cards : [];
      flakes.forEach((f) => {
        const prevY = f.y;
        f.y += f.vy * dt;
        f.x += f.vy * cfg.slope * dt;
        const sx = f.x + f.ox + Math.sin(time * f.freq + f.phase) * f.sway;
        if (p && p.active) {
          const dx = sx - p.x;
          const dy = f.y - p.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 4900 && d2 > 1) {
            const d = Math.sqrt(d2);
            f.vx += (dx / d) * (1 - d / 70) * 380 * dt;
          }
        }
        f.ox += f.vx * dt;
        f.vx *= Math.exp(-dt * 3);
        f.ox *= Math.exp(-dt * 0.6);
        if (settle && f.z > 0.5 && resting.length < 70) {
          const card = cards.find((c) => sx > c.left + 8 && sx < c.left + c.width - 8 && prevY < c.top && f.y >= c.top);
          if (card) {
            resting.push({ x: sx, y: card.top - f.r * 0.6, r: f.r, t: 0, life: 5 + Math.random() * 5 });
            place(f, false);
            return;
          }
        }
        if (f.y - f.r > cfg.h) place(f, false);
        if (f.x > cfg.w + 30) f.x -= cfg.w + 60;
        if (f.x < -30) f.x += cfg.w + 60;
      });
      for (let i = resting.length - 1; i >= 0; i -= 1) {
        resting[i].t += dt;
        if (resting[i].t > resting[i].life) resting.splice(i, 1);
      }
    },
    draw(ctx, alpha) {
      const a = alpha * levelAlpha(cfg.level);
      const rgb = cfg.dark ? '255, 255, 255' : '140, 168, 204';
      for (let b = 0; b < BUCKETS; b += 1) {
        const z = (b + 0.5) / BUCKETS;
        ctx.fillStyle = `rgba(${rgb}, ${((0.22 + z * 0.42) * a).toFixed(3)})`;
        ctx.beginPath();
        flakes.forEach((f) => {
          if (f.bucket !== b) return;
          const x = f.x + f.ox + Math.sin(time * f.freq + f.phase) * f.sway;
          ctx.moveTo(x + f.r, f.y);
          ctx.arc(x, f.y, f.r, 0, Math.PI * 2);
        });
        ctx.fill();
      }
      resting.forEach((s) => {
        const fade = Math.min(1, s.t / 0.4) * Math.min(1, (s.life - s.t) / 1.2);
        ctx.fillStyle = `rgba(${rgb}, ${(0.7 * fade * alpha).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, s.r * 1.4, s.r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    },
  };
}
