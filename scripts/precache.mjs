import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export function walk(dir, root = dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full, root) : [relative(root, full).split(sep).join('/')];
  });
}

export function precacheList(files) {
  return files
    .filter((file) => file !== 'sw.js' && !file.endsWith('.map') && !file.startsWith('characters/') && !file.startsWith('.'))
    .sort();
}

export function versionOf(dir, files) {
  const hash = createHash('sha256');
  files.forEach((file) => {
    hash.update(file);
    hash.update(readFileSync(join(dir, file)));
  });
  return hash.digest('hex').slice(0, 12);
}
