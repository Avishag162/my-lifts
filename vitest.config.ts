import { defineConfig } from 'vitest/config';
// The app reasons in its TIME_ZONE (src/server/time.ts). Running the tests in the same zone keeps "today" right.
process.env.TZ = 'Asia/Jerusalem';
export default defineConfig({ test: { root: '.', include: ['test/**/*.test.ts'], env: { TZ: 'Asia/Jerusalem' } } });
