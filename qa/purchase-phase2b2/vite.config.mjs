import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: false,
  plugins: [react()],
  resolve: { alias: [{ find: /^.*\/purchasePreviewRepository$/, replacement: fileURLToPath(new URL('./native-denied.ts', import.meta.url)) }, { find: /(?:\.\.\/)+purchase\/purchaseRepository$/, replacement: fileURLToPath(new URL('./mapping-transport.ts', import.meta.url)) }] },
  server: { host: '127.0.0.1', port: 1420, strictPort: true, fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] } },
});
