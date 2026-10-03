import { particleCount } from './plan.js';

const BUCKETS = 3;

function bolt(w, h) {
  const main = [];
  const branches = [];
  let x = w * (0.22 + Math.random() * 0.56);
  let y = -12;
  const floor = h * (0.5 + Math.random() * 0.28);
  main.push([x, y]);
  while (y < floor) {
    x += (Math.random() - 0.5) * 36;
    y += 14 + Math.random() * 16;
    main.push([x, y]);
    if (Math.random() < 0.2 && main.length > 2) {
      const branch = [[x, y]];
      let bx = x;
      let by = y;
      const dir = Math.random() < 0.5 ? -1 : 1;
      const steps = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < steps; i += 1) {
        bx += dir * (8 + Math.random() * 16);
        by += 10 + Math.random() * 14;
        branch.push([bx, by]);
      }
      branches.push(branch);
    }
  }
  return { main, branches };
}

function stroke(ctx, points) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}

export function createRain(env, { storm = false } = {}) {
  let cfg = env;
  let drops = [];
  const splashes = [];
  const beads = [];
  let beadTimer = 1.6;
  let strikeTimer = 3 + Math.random() * 5;
  let flash = 0;
  let secondFlash = 0;
  let strike = null;
  let strikeLife = 0;

  function place(d, anywhere) {
    d.z = Math.random();
    const reach = cfg.h * cfg.slope;
    d.x = -reach + Math.random() * (cfg.w + reach);
    d.y = anywhere ? Math.random() * cfg.h : -Math.random() * cfg.h * 0.3 - 20;
    d.vy = 720 + d.z * 920;
    d.len = 9 + d.z * 20;
    d.bucket = Math.min(BUCKETS - 1, Math.floor(d.z * BUCKETS));
    return d;
  }

  function fill() {
    const want = particleCount(storm ? 'storm' : 'rain', cfg.intensity, cfg);
    while (drops.length < want) drops.push(place({}, true));
    if (drops.length > want) drops = drops.slice(0, want);
  }

  fill();

  return {
    staticSkip: true,
    configure(next) {
      cfg = next;
      fill();
    },
    update(dt) {
      const { w, h, slope } = cfg;
      drops.forEach((d) => {
        d.y += d.vy * dt;
        d.x += d.vy * slope * dt;
        if (d.y - d.len > h) {
          if (d.z > 0.55 && Math.random() < 0.55) splashes.push({ x: d.x, y: h - 2, t: 0, r: 2 + d.z * 4 });
          place(d, false);
        }
      });
      for (let i = splashes.length - 1; i >= 0; i -= 1) {
        splashes[i].t += dt;
        if (splashes[i].t > 0.34) splashes.splice(i, 1);
      }
      beadTimer -= dt;
      if (beadTimer <= 0) {
        beadTimer = 2 + Math.random() * 2.6;
        const rect = cfg.tempRect ? cfg.tempRect() : null;
        if (rect && rect.width > 0 && rect.top > -20 && rect.top < h) {
          beads.push({ x: rect.left + rect.width * (0.1 + Math.random() * 0.8), y: rect.top + rect.height * (0.08 + Math.random() * 0.12), vy: 0, t: 0, r: 1.5 + Math.random() * 1.6, travel: 0 });
        }
      }
      for (let i = beads.length - 1; i >= 0; i -= 1) {
        const b = beads[i];
        b.t += dt;
        if (b.t > 0.35 && b.travel < 34) {
          b.vy = Math.min(70, b.vy + 60 * dt);
          b.y += b.vy * dt;
          b.travel += b.vy * dt;
        }
        if (b.t > 2.2) beads.splice(i, 1);
      }
      if (!storm || !cfg.lightning) {
        flash = 0;
        strike = null;
        return;
      }
      strikeTimer -= dt;
      if (strikeTimer <= 0) {
        strikeTimer = 6 + Math.random() * 8;
        flash = 1;
        secondFlash = 0.13;
        strike = bolt(w, h);
        strikeLife = 0.5;
      }
      if (secondFlash > 0) {
        secondFlash -= dt;
        if (secondFlash <= 0) flash = Math.max(flash, 0.62);
      }
      flash *= Math.exp(-dt * 9);
      if (strike) {
        strikeLife -= dt;
        if (strikeLife <= 0) strike = null;
      }
    },
    draw(ctx, alpha) {
      const { dark, slope, w, h } = cfg;
      const rgb = dark ? '206, 220, 255' : '58, 92, 146';
      ctx.lineCap = 'round';
      for (let b = 0; b < BUCKETS; b += 1) {
        const z = (b + 0.5) / BUCKETS;
        ctx.strokeStyle = `rgba(${rgb}, ${((0.14 + z * 0.36) * alpha * (dark ? 1 : 0.85)).toFixed(3)})`;
        ctx.lineWidth = 0.7 + z * 1.1;
        ctx.beginPath();
        drops.forEach((d) => {
          if (d.bucket !== b) return;
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - d.len * slope, d.y - d.len);
        });
        ctx.stroke();
      }
      ctx.lineWidth = 1;
      splashes.forEach((s) => {
        const p = s.t / 0.34;
        ctx.strokeStyle = `rgba(${rgb}, ${(0.4 * (1 - p) * alpha).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, s.r * (0.4 + p * 1.6), s.r * (0.2 + p * 0.5), 0, Math.PI, Math.PI * 2);
        ctx.stroke();
      });
      beads.forEach((b) => {
        const fade = Math.min(1, b.t / 0.3) * Math.min(1, (2.2 - b.t) / 0.5);
        ctx.fillStyle = `rgba(${dark ? '220, 234, 255' : '90, 128, 178'}, ${(0.5 * fade * alpha).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.r, b.r * (1 + Math.min(0.5, b.vy / 120)), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 255, 255, ${(0.7 * fade * alpha).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.32, 0, Math.PI * 2);
        ctx.fill();
      });
      if (strike) {
        const life = Math.max(0, strikeLife / 0.5);
        ctx.save();
        ctx.strokeStyle = `rgba(${dark ? '255, 255, 255' : '82, 92, 200'}, ${(0.95 * life * alpha).toFixed(3)})`;
        ctx.shadowColor = dark ? 'rgba(190, 200, 255, 0.95)' : 'rgba(120, 130, 220, 0.8)';
        ctx.shadowBlur = 14;
        ctx.lineWidth = 2.2;
        ctx.lineJoin = 'round';
        stroke(ctx, strike.main);
        ctx.lineWidth = 1.1;
        strike.branches.forEach((branch) => stroke(ctx, branch));
        ctx.restore();
      }
      if (flash > 0.01) {
        ctx.fillStyle = `rgba(${dark ? '235, 238, 255' : '196, 206, 255'}, ${(flash * (dark ? 0.26 : 0.3) * alpha).toFixed(3)})`;
        ctx.fillRect(0, 0, w, h);
      }
    },
  };
}
