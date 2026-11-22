import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { randomBytes } from 'node:crypto';
import { createApp } from './app.ts';
import { getSetting, openDb } from './db.ts';
import { seedLibrary } from './library.ts';

const isProd = process.env.NODE_ENV === 'production';
const db = openDb(process.env.DB_PATH ?? 'data/app.db');
seedLibrary(db);

// The key that signs login sessions. APP_SECRET wins; otherwise one is made on first run and kept in the database,
// so you stay logged in after a restart.
let secret = process.env.APP_SECRET?.trim();
if (!secret) {
  secret = getSetting(db, 'app_secret');
  if (!secret) {
    secret = randomBytes(32).toString('hex');
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_secret', ?)").run(secret);
  }
}

// Secure cookies need https. Set SECURE_COOKIES=true when the app runs behind https (e.g. on a cloud host).
const app = createApp({ db, secret, secureCookies: process.env.SECURE_COOKIES === 'true' });

if (isProd) {
  app.use('/*', serveStatic({ root: './dist' }));
  app.get('*', serveStatic({ path: './dist/index.html' }));
}

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => console.log(`App on http://localhost:${port}`));
