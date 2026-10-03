import fs from 'node:fs/promises';
import path from 'node:path';
import wawoff2 from 'wawoff2';

const SOURCE_DIR = path.resolve('assets-src/fonts');
const TARGET_DIR = path.resolve('src/assets/fonts');

await fs.mkdir(TARGET_DIR, { recursive: true });
const files = (await fs.readdir(SOURCE_DIR)).filter((f) => /\.(ttf|otf)$/i.test(f)).sort();
const results = [];
for (const name of files) {
  const input = await fs.readFile(path.join(SOURCE_DIR, name));
  const output = Buffer.from(await wawoff2.compress(input));
  const target = path.join(TARGET_DIR, name.replace(/\.(ttf|otf)$/i, '.woff2'));
  await fs.writeFile(target, output);
  results.push({ name, fromKB: Math.round(input.length / 1024), toKB: Math.round(output.length / 1024) });
}
console.table(results);
