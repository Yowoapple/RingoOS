import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const VERSION = '26.0.0';
const CODENAME = 'Fuji';

function gitCommit(root) {
  try {
    const gitDir = resolve(root, '.git');
    const head = readFileSync(resolve(gitDir, 'HEAD'), 'utf8').trim();
    if (!head.startsWith('ref:')) return head.slice(0, 7);
    const ref = head.slice(4).trim();
    const loose = resolve(gitDir, ref);
    if (existsSync(loose)) return readFileSync(loose, 'utf8').trim().slice(0, 7);
    const packed = readFileSync(resolve(gitDir, 'packed-refs'), 'utf8');
    const line = packed.split('\n').find((row) => row.endsWith(` ${ref}`));
    return line ? line.slice(0, 7) : '';
  } catch (err) {
    return '';
  }
}

function buildDate() {
  const now = new Date();
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
}

export default defineConfig({
  base: './',
  define: {
    __RINGO_BUILD__: JSON.stringify({ version: VERSION, codename: CODENAME, commit: gitCommit(import.meta.dirname), date: buildDate() }),
  },
  server: {
    port: 5178,
    strictPort: true,
  },
  preview: {
    port: 5179,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        next: resolve(import.meta.dirname, 'next/index.html'),
        logo: resolve(import.meta.dirname, 'prototype/logo/index.html'),
      },
    },
  },
});
