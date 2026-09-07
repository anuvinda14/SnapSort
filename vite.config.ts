import { defineConfig } from 'vite';
import { existsSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const paddleInstalled = existsSync(fileURLToPath(new URL('./node_modules/@paddleocr/paddleocr-js/package.json', import.meta.url)));
const paddleAlias = fileURLToPath(new URL(`./src/lib/benchmark/paddle-${paddleInstalled ? 'installed' : 'missing'}.ts`, import.meta.url));

export default defineConfig({
  worker: { format: 'es' },
  plugins: [react()],
  resolve: {
    alias: {
      '@snapsort/paddle-engine': paddleAlias,
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['tesseract.js'],
  },
});