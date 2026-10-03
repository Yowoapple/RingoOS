import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { precacheList, versionOf, walk } from '../scripts/precache.mjs';

describe('service worker precache list', () => {
  it('keeps the app shell and leaves out the worker, maps and sprites', () => {
    const list = precacheList(['sw.js', 'index.html', 'assets/a.js', 'assets/a.js.map', 'characters/coffeebean/cake.webp', 'manifest.webmanifest', '.DS_Store']);
    expect(list).toEqual(['assets/a.js', 'index.html', 'manifest.webmanifest']);
  });

  it('walks folders with forward slashes and changes the version when content changes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ringo-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'index.html'), 'a');
    writeFileSync(join(dir, 'assets', 'x.js'), 'b');
    const files = precacheList(walk(dir));
    expect(files).toEqual(['assets/x.js', 'index.html']);
    const first = versionOf(dir, files);
    writeFileSync(join(dir, 'index.html'), 'c');
    expect(versionOf(dir, files)).not.toBe(first);
    expect(first).toMatch(/^[0-9a-f]{12}$/);
  });
});
