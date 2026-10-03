import { hasDetail, inside, levelAlpha, particleCount } from './plan.js';

export function createSun() {
  return {
    configure() {},
    update() {},
    draw() {},
  };
}

export function createNight(env) {
  let cfg = env;
  let time = 0;
  let stars = [];
  let meteor = null;
  let meteorTimer = 8 + Math.random() * 12;

  function seed() {
    const want = Math.max(cfg.animate ? 0 : 14, particleCount('night', 1, { ...cfg, tier: cfg.tier === 'solid' ? 'full' : cfg.tier }));
    const avoid = cfg.regions ? [...cfg.regions.text, ...cfg.regions.cards] : [];
    stars = [];
    let tries = 0;
    while (stars.length < want && tries < want * 12) {
      tries += 1;
      const s = { x: Math.random(), y: Math.random() * 0.8, r: 0.4 + Math.random() * 1, speed: 0.5 + Math.random() * 1.8, phase: Math.random() * Math.PI * 2 };
      if (inside(s.x * cfg.w, s.y * cfg.h, avoid, 10)) continue;
      stars.push(s);
    }
  }

  seed();

  return {
    configure(next) {
      const moved = next.w !== cfg.w || next.h !== cfg.h || next.level !== cfg.level;
      cfg = next;
      if (moved) seed();
    },
    update(dt) {
      time += dt;
      if (!hasDetail(cfg.level, 'meteor')) return;
      meteorTimer -= dt;
      if (meteorTimer <= 0 && !meteor) {
        meteorTimer = (cfg.level === 'rich' ? 12 : 24) + Math.random() * 14;
        meteor = { x: cfg.w * (0.55 + Math.random() * 0.4), y: cfg.h * (0.02 + Math.random() * 0.12), t: 0 };
      }
      if (meteor) {
        meteor.t += dt;
        if (meteor.t > 0.8) meteor = null;
      }
    },
    draw(ctx, alpha) {
      const a = alpha * levelAlpha(cfg.level);
      const rgb = cfg.dark ? '255, 255, 255' : '72, 84, 150';
      stars.forEach((s) => {
        const tw = cfg.animate ? 0.5 + 0.5 * Math.sin(time * s.speed + s.phase) : 0.7;
        ctx.fillStyle = `rgba(${rgb}, ${((0.16 + 0.5 * tw) * a * (cfg.dark ? 1 : 0.55)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x * cfg.w, s.y * cfg.h, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
      if (meteor) {
        const p = meteor.t / 0.8;
        const dist = p * 300;
        const hx = meteor.x - dist * 0.9;
        const hy = meteor.y + dist * 0.42;
        const tail = 90;
        const grad = ctx.createLinearGradient(hx, hy, hx + tail * 0.9, hy - tail * 0.42);
        const fade = Math.sin(p * Math.PI);
        grad.addColorStop(0, `rgba(${rgb}, ${(0.7 * fade * alpha).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.1;
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
    y: rows[i % rows.length] + (Math.random() - 0.5) * 0.06,
    rx: 0.3 + Math.random() * 0.22,
    ry: 0.08 + Math.random() * 0.06,
    speed: (5 + Math.random() * 7) * (i % 2 && rows.length > 1 ? -1 : 1),
    a: 0.05 + Math.random() * 0.04,
  }));
}

function drawBlobs(ctx, list, cfg, rgb, gain, alpha) {
  list.forEach((b) => {
    const span = cfg.w * (1 + b.rx * 2);
    const x = (((b.x % 1) + 1) % 1) * span - cfg.w * b.rx;
    const y = b.y * cfg.h;
    const rx = cfg.w * b.rx;
    const ry = cfg.h * b.ry;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(${rgb}, ${(b.a * gain * alpha).toFixed(3)})`);
    g.addColorStop(0.6, `rgba(${rgb}, ${(b.a * 0.5 * gain * alpha).toFixed(3)})`);
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
  const all = blobs(6, [0.08, 0.2, 0.32]);
  return {
    configure(next) {
      cfg = next;
    },
    update(dt) {
      all.forEach((b) => { b.x += (b.speed * dt) / (cfg.w * (1 + b.rx * 2)); });
    },
    draw(ctx, alpha) {
      const count = cfg.level === 'soft' ? 2 : cfg.level === 'rich' ? 6 : 4;
      const gain = (cfg.intensity > 1 ? 1.3 : 1) * levelAlpha(cfg.level);
      drawBlobs(ctx, all.slice(0, count), cfg, cfg.dark ? '222, 228, 238' : '116, 126, 146', gain, alpha);
    },
  };
}

export function createFog(env) {
  let cfg = env;
  const all = blobs(8, [0.7, 0.9]);
  all.forEach((b) => {
    b.rx = 0.38 + Math.random() * 0.26;
    b.ry = 0.1 + Math.random() * 0.05;
    b.a = 0.07 + Math.random() * 0.05;
  });
  return {
    configure(next) {
      cfg = next;
    },
    update(dt) {
      all.forEach((b) => { b.x += (b.speed * 0.7 * dt) / (cfg.w * (1 + b.rx * 2)); });
    },
    draw(ctx, alpha) {
      const gain = levelAlpha(cfg.level);
      const count = cfg.level === 'soft' ? 3 : cfg.level === 'rich' ? 8 : 5;
      const rgb = cfg.dark ? '230, 230, 236' : '146, 146, 156';
      const top = cfg.h * 0.55;
      const floor = ctx.createLinearGradient(0, top, 0, cfg.h);
      floor.addColorStop(0, `rgba(${rgb}, 0)`);
      floor.addColorStop(1, `rgba(${rgb}, ${(0.08 * gain * alpha).toFixed(3)})`);
      ctx.fillStyle = floor;
      ctx.fillRect(0, top, cfg.w, cfg.h - top);
      drawBlobs(ctx, all.slice(0, count), cfg, rgb, gain, alpha);
    },
  };
}
