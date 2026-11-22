import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const local = (f: string) => fileURLToPath(new URL(`./src/web/local/${f}`, import.meta.url));

export default defineConfig(({ mode }) => ({
  root: 'src/web',
  plugins: [react()],
  build: { outDir: '../../dist', emptyOutDir: true },
  // '^/api/', not '/api': that would also catch the module src/web/api.ts.
  server: { port: 5173, proxy: { '^/api/': 'http://localhost:3000' } },
  // `--mode device`: the version that runs entirely in the browser and keeps the data on the phone (GitHub Pages).
  // The server code is bundled into the page; the Node modules it imports are replaced by small browser versions.
  // (The aliases apply to every build: the normal one only references that code, it never loads it.)
  base: mode === 'device' ? (process.env.BASE_PATH ?? '/my-lifts/') : '/',
  resolve: {
    alias: {
      'node:crypto': local('node-crypto.ts'),
      'node:sqlite': local('node-stubs.ts'),
      'node:fs': local('node-stubs.ts'),
      'node:path': local('node-stubs.ts'),
      'node:module': local('node-stubs.ts'),
    },
  },
}));
