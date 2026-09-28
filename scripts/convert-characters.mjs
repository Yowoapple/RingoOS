import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SOURCE_DIR = path.resolve('assets-src/characters/coffeebean');
const TARGET_DIR = path.resolve('public/characters/coffeebean');
const WEBP_OPTIONS = { quality: 85, alphaQuality: 100, effort: 6 };

async function isFresh(source, target) {
  try {
    const [s, t] = await Promise.all([fs.stat(source), fs.stat(target)]);
    return t.mtimeMs >= s.mtimeMs;
  } catch {
    return false;
  }
}

async function convert(name) {
  const source = path.join(SOURCE_DIR, name);
  const target = path.join(TARGET_DIR, name.replace(/\.gif$/i, '.webp'));
  if (await isFresh(source, target)) return { name, skipped: true };
  await sharp(source, { animated: true }).webp(WEBP_OPTIONS).toFile(target);
  const [input, output, meta] = await Promise.all([
    fs.stat(source),
    fs.stat(target),
    sharp(target, { animated: true }).metadata(),
  ]);
  return { name, fromKB: Math.round(input.size / 1024), toKB: Math.round(output.size / 1024), frames: meta.pages };
}

await fs.mkdir(TARGET_DIR, { recursive: true });
const files = (await fs.readdir(SOURCE_DIR)).filter((f) => /\.gif$/i.test(f)).sort();
const results = [];
for (const name of files) results.push(await convert(name));
console.table(results);
const done = results.filter((r) => !r.skipped);
if (done.length) {
  const from = done.reduce((s, r) => s + r.fromKB, 0);
  const to = done.reduce((s, r) => s + r.toKB, 0);
  console.log(`${done.length} converted: ${(from / 1024).toFixed(1)} MB -> ${(to / 1024).toFixed(1)} MB`);
}
