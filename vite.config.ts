import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'src/web',
  plugins: [react()],
  build: { outDir: '../../dist', emptyOutDir: true },
  // '^/api/', not '/api': that would also catch the module src/web/api.ts.
  server: { port: 5173, proxy: { '^/api/': 'http://localhost:3000' } },
});
