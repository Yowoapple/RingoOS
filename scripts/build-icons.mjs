import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { ICON_COLORS, iconSvg } from './icon-svg.mjs';

const out = resolve('public/icons');
mkdirSync(out, { recursive: true });

const color = ICON_COLORS.apple;
const png = (svg, file) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(resolve(out, file));

writeFileSync(resolve(out, 'favicon.svg'), iconSvg({ size: 64, color, solid: true }));
await png(iconSvg({ size: 32, color, solid: true }), 'favicon-32.png');
await png(iconSvg({ size: 192, color }), 'icon-192.png');
await png(iconSvg({ size: 512, color }), 'icon-512.png');
await png(iconSvg({ size: 512, color, maskable: true }), 'maskable-512.png');
await png(iconSvg({ size: 180, color, maskable: true }), 'apple-touch-icon.png');
console.log('icons written to public/icons');
