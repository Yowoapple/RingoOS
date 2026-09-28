import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
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
        wm: resolve(import.meta.dirname, 'prototype/wm/index.html'),
      },
    },
  },
});
