export const ICON_COLORS = { apple: '#C8F03C', ultra: '#4A57FF', signal: '#FF5A1F' };

export function iconSvg({ size = 512, color = ICON_COLORS.apple, solid = false, maskable = false } = {}) {
  const s = size;
  const radius = maskable ? 0 : s * 0.225;
  const w = s * (maskable ? 0.44 : 0.54);
  const h = w / 1.5;
  const x = (s - w) / 2;
  const y = (s - h) / 2;
  const stroke = h * 0.13;
  const capsule = solid
    ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${color}"/>`
    : `<rect x="${x + stroke / 2}" y="${y + stroke / 2}" width="${w - stroke}" height="${h - stroke}" rx="${(h - stroke) / 2}" fill="none" stroke="${color}" stroke-width="${stroke}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">`
    + '<defs><radialGradient id="g" cx="0.3" cy="0.2" r="1"><stop offset="0" stop-color="#26262b"/><stop offset="1" stop-color="#0e0e10"/></radialGradient></defs>'
    + `<rect width="${s}" height="${s}" rx="${radius}" fill="url(#g)"/>`
    + (maskable ? '' : `<rect x="${s * 0.004}" y="${s * 0.004}" width="${s * 0.992}" height="${s * 0.992}" rx="${radius}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="${s * 0.008}"/>`)
    + capsule
    + '</svg>';
}
