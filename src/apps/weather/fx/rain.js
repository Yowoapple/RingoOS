import { hasDetail, levelAlpha, particleCount } from './plan.js';

const BUCKETS = 3;

function bolt(w, h, avoid) {
  const main = [];
  const branches = [];
  const from = avoid && avoid.width ? Math.min(w * 0.8, avoid.left + avoid.width + 30) : w * 0.6;
  let x = from + Math.random() * Math.max(12, w * 0.9 - from);
  let y = -12;
  const floor = h * (0.32 + Math.random() * 0.18);
  main.push([x, y]);
  while (y < floor) {
    x += (Math.random() - 0.5) * 26;
    y += 12 + Math.random() * 14;
    main.push([x, y]);
    if (Math.random() < 0.16 && main.length > 2) {
      const branch = [[x, y]];
      let bx = x;
      let by = y;
      const dir = Math.random() < 0.5 ? -1 : 1;
      for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i += 1) {
        bx += dir * (6 + Math.random() * 12);
        by += 8 + Math.random() * 10;
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
  let beadTimer = 2.4;
  let strikeTimer = 4 + Math.random() * 5;
  let flash = 0;
  let secondFlash = 0;
  let strike = null;
  let strikeLife = 0;

  function place(d, anywhere) {
    d.z = Math.random();
    const reach = cfg.h * cfg.slope;
    d.x = -reach + Math.random() * (cfg.w + reach);
    d.y = anywhere ? Math.random() * cfg.h : -Math.random() * cfg.h * 0.25 - 16;
    d.vy = 620 + d.z * 760;
    d.len = 7 + d.z * 15;
    d.bucket = Math.min(BUCKETS - 1, Math.floor(d.z * BUCKETS));
    return d;
  }

  function fill() {
    const want = particleCount(storm ? 'storm' : 'rain', cfg.intensity, cfg);
    while (drops.length < want) drops.push(place({}, true));
    if (drops.length > want) drops = drops.slice(0, want);
  }

  function surfaceHit(d, prevY) {
    const cards = cfg.regions ? cfg.regions.cards : [];
    for (let i = 0; i < cards.length; i += 1) {
      const c = cards[i];
      if (d.x < c.left + 6 || d.x > c.left + c.width - 6) continue;
      if (prevY < c.top && d.y >= c.top) return c.top;
    }
    return null;
  }

  fill();

  return {
    staticSkip: true,
    configure(next) {
      cfg = next;
      fill();
    },
    update(dt) {
      const { w, h, slope, level } = cfg;
      const splash = hasDetail(level, 'splash');
      drops.forEach((d) => {
        const prevY = d.y;
        d.y += d.vy * dt;
        d.x += d.vy * slope * dt;
        if (splash && d.z > 0.62) {
          const top = surfaceHit(d, prevY);
          if (top !== null) {
            splashes.push({ x: d.x, y: top - 1, t: 0, r: 1.6 + d.z * 3 });
            place(d, false);
            return;
          }
        }
        if (d.y - d.len > h) {
          if (splash && d.z > 0.62 && Math.random() < 0.4) splashes.push({ x: d.x, y: h - 2, t: 0, r: 1.6 + d.z * 3 });
          place(d, false);
        }
      });
      for (let i = splashes.length - 1; i >= 0; i -= 1) {
        splashes[i].t += dt;
        if (splashes[i].t > 0.3 || splashes.length > 40) splashes.splice(i, 1);
      }
      if (hasDetail(level, 'beads')) {
        beadTimer -= dt;
        if (beadTimer <= 0) {
          beadTimer = 3 + Math.random() * 3;
          const rect = cfg.tempRect ? cfg.tempRect() : null;
          if (rect && rect.width > 0 && rect.top > -20 && rect.top < h) {
            beads.push({ x: rect.left + rect.width * (0.15 + Math.random() * 0.7), y: rect.top + rect.height * 0.12, vy: 0, t: 0, r: 1.3 + Math.random() * 1.1, travel: 0 });
          }
        }
      }
      for (let i = beads.length - 1; i >= 0; i -= 1) {
        const b = beads[i];
        b.t += dt;
        if (b.t > 0.4 && b.travel < 26) {
          b.vy = Math.min(55, b.vy + 45 * dt);
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
        strikeTimer = 7 + Math.random() * 9;
        flash = level === 'soft' ? 0.5 : 1;
        secondFlash = level === 'soft' ? 0 : 0.13;
        strike = hasDetail(level, 'bolt') ? bolt(w, h, cfg.tempRect ? cfg.tempRect() : null) : null;
        strikeLife = 0.45;
      }
      if (secondFlash > 0) {
        secondFlash -= dt;
        if (secondFlash <= 0) flash = Math.max(flash, 0.55);
      }
      flash *= Math.exp(-dt * 10);
      if (strike) {
        strikeLife -= dt;
        if (strikeLife <= 0) strike = null;
      }
    },
    draw(ctx, alpha) {
      const { dark, slope, w, h, level } = cfg;
      const a = alpha * levelAlpha(level);
      const rgb = dark ? '206, 220, 255' : '64, 98, 150';
      ctx.lineCap = 'round';
      for (let b = 0; b < BUCKETS; b += 1) {
        const z = (b + 0.5) / BUCKETS;
        ctx.strokeStyle = `rgba(${rgb}, ${((0.08 + z * 0.24) * a * (dark ? 1 : 0.8)).toFixed(3)})`;
        ctx.lineWidth = 0.6 + z * 0.8;
        ctx.beginPath();
        drops.forEach((d) => {
          if (d.bucket !== b) return;
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - d.len * slope, d.y - d.len);
        });
        ctx.stroke();
      }
      ctx.lineWidth = 0.9;
      splashes.forEach((s) => {
        const p = s.t / 0.3;
        ctx.strokeStyle = `rgba(${rgb}, ${(0.32 * (1 - p) * a).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, s.r * (0.5 + p * 1.5), s.r * (0.25 + p * 0.45), 0, Math.PI, Math.PI * 2);
        ctx.stroke();
      });
      beads.forEach((b) => {
        const fade = Math.min(1, b.t / 0.3) * Math.min(1, (2.2 - b.t) / 0.5);
        ctx.fillStyle = `rgba(${dark ? '220, 234, 255' : '90, 128, 178'}, ${(0.4 * fade * alpha).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.r, b.r * (1 + Math.min(0.5, b.vy / 110)), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 255, 255, ${(0.55 * fade * alpha).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.3, 0, Math.PI * 2);
        ctx.fill();
      });
      if (strike) {
        const life = Math.max(0, strikeLife / 0.45);
        ctx.save();
        ctx.strokeStyle = `rgba(${dark ? '240, 244, 255' : '96, 106, 200'}, ${(0.85 * life * alpha).toFixed(3)})`;
        ctx.shadowColor = dark ? 'rgba(170, 182, 255, 0.8)' : 'rgba(120, 130, 220, 0.6)';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 1.6;
        ctx.lineJoin = 'round';
        stroke(ctx, strike.main);
        ctx.lineWidth = 0.8;
        strike.branches.forEach((branch) => stroke(ctx, branch));
        ctx.restore();
      }
      if (flash > 0.01) {
        const g = ctx.createRadialGradient(w * 0.75, 0, 0, w * 0.75, 0, Math.max(w, h));
        const peak = flash * (dark ? 0.2 : 0.22) * alpha;
        g.addColorStop(0, `rgba(${dark ? '228, 232, 255' : '190, 200, 255'}, ${peak.toFixed(3)})`);
        g.addColorStop(1, `rgba(${dark ? '228, 232, 255' : '190, 200, 255'}, ${(peak * 0.25).toFixed(3)})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
    },
  };
}
