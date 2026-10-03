import { particleCount } from './plan.js';

function hexagon(ctx, x, y, r, turn) {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = turn + (i / 6) * Math.PI * 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

export function createSun(env) {
  let cfg = env;
  let time = Math.random() * 10;
  const rays = Array.from({ length: 12 }, (_, i) => ({
    angle: Math.PI * (0.5 + (i / 11) * 0.52) + (Math.random() - 0.5) * 0.06,
    length: 1.5 + Math.random() * 1.3,
    width: 0.035 + Math.random() * 0.055,
    speed: 0.4 + Math.random() * 0.9,
    phase: Math.random() * Math.PI * 2,
  }));
  const flares = [
    { at: 0.42, size: 0.05, hex: false, a: 0.1 },
    { at: 0.56, size: 0.11, hex: true, a: 0.06 },
    { at: 0.7, size: 0.035, hex: false, a: 0.12 },
    { at: 0.88, size: 0.16, hex: true, a: 0.045 },
    { at: 1.06, size: 0.07, hex: false, a: 0.08 },
  ];

  function geometry() {
    const heat = cfg.intensity;
    const R = Math.max(cfg.w, cfg.h) * (0.6 + heat * 0.09);
    return { R, cx: cfg.w + R * 0.14, cy: -R * 0.22, heat };
  }

  return {
    configure(next) {
      cfg = next;
    },
    update(dt) {
      time += dt;
    },
    draw(ctx, alpha) {
      const { R, cx, cy, heat } = geometry();
      const dark = cfg.dark;
      const k = alpha * (dark ? 1 : 0.78) * (1 + heat * 0.12);
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      core.addColorStop(0, `rgba(255, 252, 238, ${Math.min(1, 0.95 * k).toFixed(3)})`);
      core.addColorStop(0.14, `rgba(255, 236, 170, ${Math.min(1, 0.72 * k).toFixed(3)})`);
      core.addColorStop(0.3, `rgba(255, 190, 90, ${(0.24 * k).toFixed(3)})`);
      core.addColorStop(0.56, `rgba(255, 146, 50, ${(0.07 * k).toFixed(3)})`);
      core.addColorStop(1, 'rgba(255, 146, 50, 0)');
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, cfg.w, cfg.h);
      const animate = cfg.animate;
      const sway = animate ? Math.sin(time * 0.12) * 0.08 : 0;
      ctx.save();
      ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      rays.forEach((ray) => {
        const flick = animate ? 0.65 + 0.35 * Math.sin(time * ray.speed + ray.phase) : 0.85;
        const a = ray.angle + sway;
        const len = R * ray.length;
        const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        grad.addColorStop(0, 'rgba(255, 236, 186, 0)');
        grad.addColorStop(0.16, `rgba(255, 236, 186, ${(0.17 * flick * k).toFixed(3)})`);
        grad.addColorStop(0.5, `rgba(255, 214, 140, ${(0.06 * flick * k).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(255, 214, 140, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a - ray.width) * len, cy + Math.sin(a - ray.width) * len);
        ctx.lineTo(cx + Math.cos(a + ray.width) * len, cy + Math.sin(a + ray.width) * len);
        ctx.closePath();
        ctx.fill();
      });
      if (cfg.tier === 'full' && animate) {
        const tx = cfg.w * 0.32 - cx;
        const ty = cfg.h * 0.78 - cy;
        flares.forEach((f, i) => {
          const drift = Math.sin(time * 0.3 + i) * 0.015;
          const x = cx + tx * (f.at + drift);
          const y = cy + ty * (f.at + drift);
          const r = R * f.size;
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, `rgba(255, 226, 170, ${(f.a * 0.6 * k).toFixed(3)})`);
          g.addColorStop(0.8, `rgba(255, 206, 140, ${(f.a * k).toFixed(3)})`);
          g.addColorStop(1, 'rgba(255, 206, 140, 0)');
          ctx.fillStyle = g;
          if (f.hex) hexagon(ctx, x, y, r, time * 0.05);
          else {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
          }
          ctx.fill();
        });
      }
      ctx.restore();
      if (heat > 0 && cfg.tier === 'full' && animate) {
        const top = cfg.h * 0.6;
        const glow = ctx.createLinearGradient(0, top, 0, cfg.h);
        glow.addColorStop(0, 'rgba(255, 150, 60, 0)');
        glow.addColorStop(1, `rgba(255, 150, 60, ${(0.09 * heat * alpha).toFixed(3)})`);
        ctx.fillStyle = glow;
        ctx.fillRect(0, top, cfg.w, cfg.h - top);
        for (let band = 0; band < 5; band += 1) {
          const cycle = (time * 0.07 + band / 5) % 1;
          const base = cfg.h - cycle * cfg.h * 0.42;
          const fade = Math.sin(cycle * Math.PI);
          const amp = 3 + band;
          ctx.beginPath();
          for (let x = 0; x <= cfg.w + 12; x += 12) {
            const y = base + Math.sin(x * 0.018 + time * (1.4 + band * 0.3) + band) * amp;
            if (x) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          }
          for (let x = cfg.w + 12; x >= 0; x -= 12) {
            const y = base + 10 + Math.sin(x * 0.02 + time * (1.2 + band * 0.25) + band * 2) * amp;
            ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fillStyle = `rgba(255, ${dark ? 190 : 160}, 110, ${(0.045 * fade * heat * alpha).toFixed(3)})`;
          ctx.fill();
        }
      }
    },
  };
}

export function createNight(env) {
  let cfg = env;
  let time = 0;
  let stars = [];
  let meteor = null;
  let meteorTimer = 6 + Math.random() * 14;

  function fill() {
    const want = Math.max(cfg.animate ? 0 : 20, particleCount('night', 1, { ...cfg, tier: cfg.tier === 'solid' ? 'full' : cfg.tier }));
    while (stars.length < want) {
      stars.push({ x: Math.random(), y: Math.random() * 0.72, r: 0.4 + Math.random() * 1.1, speed: 0.6 + Math.random() * 2.2, phase: Math.random() * Math.PI * 2 });
    }
    if (stars.length > want) stars = stars.slice(0, want);
  }

  fill();

  return {
    configure(next) {
      cfg = next;
      fill();
    },
    update(dt) {
      time += dt;
      meteorTimer -= dt;
      if (meteorTimer <= 0 && !meteor) {
        meteorTimer = 18 + Math.random() * 18;
        meteor = { x: cfg.w * (0.45 + Math.random() * 0.5), y: cfg.h * (0.02 + Math.random() * 0.18), t: 0 };
      }
      if (meteor) {
        meteor.t += dt;
        if (meteor.t > 0.9) meteor = null;
      }
    },
    draw(ctx, alpha) {
      const rgb = cfg.dark ? '255, 255, 255' : '72, 84, 150';
      stars.forEach((s) => {
        const tw = cfg.animate ? 0.5 + 0.5 * Math.sin(time * s.speed + s.phase) : 0.7;
        ctx.fillStyle = `rgba(${rgb}, ${((0.18 + 0.6 * tw) * alpha * (cfg.dark ? 1 : 0.6)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x * cfg.w, s.y * cfg.h, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
      if (meteor) {
        const p = meteor.t / 0.9;
        const dist = p * 520;
        const hx = meteor.x - dist * 0.9;
        const hy = meteor.y + dist * 0.42;
        const tail = 130;
        const grad = ctx.createLinearGradient(hx, hy, hx + tail * 0.9, hy - tail * 0.42);
        const fade = Math.sin(p * Math.PI);
        grad.addColorStop(0, `rgba(${rgb}, ${(0.85 * fade * alpha).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + tail * 0.9, hy - tail * 0.42);
        ctx.stroke();
      }
    },
  };
}

function blobs(count, rows) {
  return Array.from({ length: count }, (_, i) => ({
    x: Math.random(),
    y: rows[i % rows.length] + (Math.random() - 0.5) * 0.08,
    rx: 0.32 + Math.random() * 0.28,
    ry: 0.1 + Math.random() * 0.08,
    speed: (6 + Math.random() * 9) * (i % 2 && rows.length > 1 ? -1 : 1),
    a: 0.07 + Math.random() * 0.06,
  }));
}

function drawBlobs(ctx, list, cfg, rgb, gain, alpha) {
  list.forEach((b) => {
    const span = cfg.w * (1 + b.rx * 2);
    const x = ((b.x * span) % span) - cfg.w * b.rx;
    const y = b.y * cfg.h;
    const rx = cfg.w * b.rx;
    const ry = cfg.h * b.ry;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(${rgb}, ${(b.a * gain * alpha).toFixed(3)})`);
    g.addColorStop(0.6, `rgba(${rgb}, ${(b.a * 0.55 * gain * alpha).toFixed(3)})`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

export function createCloud(env) {
  let cfg = env;
  const list = blobs(cfg.intensity > 1 ? 5 : 3, [0.16, 0.34, 0.52]);
  return {
    configure(next) {
      cfg = next;
    },
    update(dt) {
      const span = (b) => cfg.w * (1 + b.rx * 2);
      list.forEach((b) => { b.x += (b.speed * dt) / span(b); if (b.x < 0) b.x += 1; });
    },
    draw(ctx, alpha) {
      drawBlobs(ctx, list, cfg, cfg.dark ? '222, 228, 238' : '116, 126, 146', cfg.intensity > 1 ? 1.4 : 1, alpha);
    },
  };
}

export function createFog(env) {
  let cfg = env;
  const list = blobs(8, [0.56, 0.82]);
  list.forEach((b) => {
    b.rx = 0.4 + Math.random() * 0.3;
    b.ry = 0.12 + Math.random() * 0.06;
    b.a = 0.1 + Math.random() * 0.07;
  });
  return {
    configure(next) {
      cfg = next;
    },
    update(dt) {
      list.forEach((b) => {
        const span = cfg.w * (1 + b.rx * 2);
        b.x += (b.speed * 0.8 * dt) / span;
        if (b.x < 0) b.x += 1;
      });
    },
    draw(ctx, alpha) {
      const rgb = cfg.dark ? '230, 230, 236' : '146, 146, 156';
      const floor = ctx.createLinearGradient(0, cfg.h * 0.45, 0, cfg.h);
      floor.addColorStop(0, `rgba(${rgb}, 0)`);
      floor.addColorStop(1, `rgba(${rgb}, ${(0.12 * alpha).toFixed(3)})`);
      ctx.fillStyle = floor;
      ctx.fillRect(0, cfg.h * 0.45, cfg.w, cfg.h * 0.55);
      drawBlobs(ctx, list, cfg, rgb, 1, alpha);
    },
  };
}
