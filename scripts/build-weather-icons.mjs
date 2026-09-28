import fs from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.resolve('public/weather-icons');
const W = 152;
const H = 112;
const WHITE = '#ffffff';

const round = (n) => Math.round(n * 100) / 100;

function cloudShapes(cx, cy, s, fill, halo) {
  const c = (x, y, r) => `<circle cx="${round(cx + x * s)}" cy="${round(cy + y * s)}" r="${round(r * s)}"/>`;
  const shapes = [
    c(-16, 2, 14),
    c(4, -8, 19),
    c(22, 3, 13),
    `<rect x="${round(cx - 16 * s)}" y="${round(cy + 2 * s)}" width="${round(38 * s)}" height="${round(14 * s)}"/>`,
  ].join('');
  const haloGroup = halo ? `<g fill="${halo}" stroke="${halo}" stroke-width="${round(7 * s)}">${shapes}</g>` : '';
  return `${haloGroup}<g fill="${fill}">${shapes}</g>`;
}

function sun(cx, cy, r, rays, inner, outer, width, alternate = 0) {
  const lines = Array.from({ length: rays }, (_, i) => {
    const a = (i / rays) * Math.PI * 2 - Math.PI / 2;
    const out = alternate && i % 2 ? outer - alternate : outer;
    return `<line x1="${round(cx + Math.cos(a) * inner)}" y1="${round(cy + Math.sin(a) * inner)}" x2="${round(cx + Math.cos(a) * out)}" y2="${round(cy + Math.sin(a) * out)}"/>`;
  }).join('');
  return `<g stroke="${WHITE}" stroke-width="${width}" stroke-linecap="round">${lines}</g><circle cx="${cx}" cy="${cy}" r="${r}" fill="${WHITE}"/>`;
}

function moon(cx, cy, r, bg) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${WHITE}"/><circle cx="${round(cx + r * 0.46)}" cy="${round(cy - r * 0.36)}" r="${round(r * 0.84)}" fill="${bg}"/>`;
}

function sparkle(cx, cy, s) {
  return `<path fill="${WHITE}" d="M${cx} ${cy - s}Q${cx} ${cy} ${cx + s} ${cy}Q${cx} ${cy} ${cx} ${cy + s}Q${cx} ${cy} ${cx - s} ${cy}Q${cx} ${cy} ${cx} ${cy - s}Z"/>`;
}

function drops(points, length = 10) {
  const lines = points.map(([x, y]) => `<line x1="${x + 3}" y1="${y}" x2="${x - 3}" y2="${y + length}"/>`).join('');
  return `<g stroke="${WHITE}" stroke-width="5" stroke-linecap="round">${lines}</g>`;
}

function flake(cx, cy, r) {
  const lines = [0, 60, 120].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return `<line x1="${round(cx - Math.cos(a) * r)}" y1="${round(cy - Math.sin(a) * r)}" x2="${round(cx + Math.cos(a) * r)}" y2="${round(cy + Math.sin(a) * r)}"/>`;
  }).join('');
  return `<g stroke="${WHITE}" stroke-width="3.5" stroke-linecap="round">${lines}</g>`;
}

function bolt(x, y) {
  const p = [[2, -16], [-9, 2], [-1, 2], [-5, 17], [10, -3], [2, -3], [7, -16]].map(([dx, dy]) => `${x + dx} ${y + dy}`).join('L');
  return `<path fill="${WHITE}" stroke="${WHITE}" stroke-width="2" stroke-linejoin="round" d="M${p}Z"/>`;
}

function fogLines(rows) {
  const lines = rows.map(([x1, x2, y]) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/>`).join('');
  return `<g stroke="${WHITE}" stroke-width="5" stroke-linecap="round">${lines}</g>`;
}

const ICONS = {
  sunny: { bg: '#EE8A2A', body: () => sun(76, 56, 16, 8, 24, 32, 5.5) },
  'clear-night': { bg: '#3A4886', body: (bg) => moon(72, 57, 21, bg) + sparkle(106, 36, 6) + sparkle(100, 76, 4) },
  'partly-cloudy': { bg: '#EE952F', body: (bg) => sun(59, 42, 12, 8, 17, 23, 4.5) + cloudShapes(84, 64, 1, WHITE, bg) },
  'partly-cloudy-night': { bg: '#44528E', body: (bg) => moon(60, 42, 15, bg) + cloudShapes(86, 64, 1, WHITE, bg) },
  cloudy: { bg: '#8B95A3', body: () => cloudShapes(74, 60, 1.18, WHITE) },
  overcast: { bg: '#687180', body: (bg) => `<g opacity="0.55">${cloudShapes(60, 46, 0.82, WHITE)}</g>` + cloudShapes(84, 64, 1, WHITE, bg) },
  fog: { bg: '#96A0AB', body: () => cloudShapes(76, 42, 0.9, WHITE) + fogLines([[46, 102, 72], [56, 112, 84], [44, 92, 96]]) },
  'light-rain': { bg: '#3A89D8', body: () => cloudShapes(74, 44, 1, WHITE) + drops([[64, 70], [86, 70]]) },
  rain: { bg: '#1E6BCB', body: () => cloudShapes(74, 42, 1, WHITE) + drops([[58, 66], [76, 66], [94, 66], [67, 84], [85, 84]]) },
  thunderstorm: { bg: '#343F79', body: () => cloudShapes(74, 42, 1, WHITE) + bolt(76, 82) + drops([[56, 68], [98, 68]]) },
  sleet: { bg: '#6897CE', body: () => cloudShapes(74, 42, 1, WHITE) + drops([[60, 68], [96, 68]]) + flake(78, 80, 6.5) },
  snow: { bg: '#7DAEE4', body: () => cloudShapes(74, 42, 1, WHITE) + flake(58, 76, 6.5) + flake(78, 88, 6.5) + flake(98, 76, 6.5) },
  'extreme-heat': { bg: '#D6422F', body: () => sun(76, 56, 15, 12, 22, 32, 5, 5) },
};

await fs.mkdir(OUT_DIR, { recursive: true });
for (const [name, { bg, body }] of Object.entries(ICONS)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" rx="18" fill="${bg}"/>${body(bg)}</svg>\n`;
  await fs.writeFile(path.join(OUT_DIR, `${name}.svg`), svg);
}
console.log(`${Object.keys(ICONS).length} icons written to ${path.relative(process.cwd(), OUT_DIR)}`);
