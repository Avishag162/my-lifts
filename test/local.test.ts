import { createHash, createHmac as nodeHmac } from 'node:crypto';
import initSqlJs from 'sql.js';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/server/app.ts';
import { initDb } from '../src/server/db.ts';
import { seedLibrary } from '../src/server/library.ts';
import { localDate } from '../src/server/workouts.ts';
import { createHmac, scryptSync, sha256 } from '../src/web/local/node-crypto.ts';
import { wrapSqlJs } from '../src/web/local/sqljs-db.ts';

describe('on-device version', () => {
  it('needs no login, and the data survives saving and reopening the database file', async () => {
    const SQL = await initSqlJs();
    const raw = new SQL.Database();
    const db = initDb(wrapSqlJs(raw));
    seedLibrary(db);
    const app = createApp({ db, secret: 's', secureCookies: false, local: true });
    const call = async (path: string, body?: unknown) => {
      const res = await app.request(path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: res.status, data: (await res.json()) as any };
    };

    expect((await call('/api/me')).status).toBe(401);
    expect((await call('/api/auth/setup', { name: 'נועה', password: crypto.randomUUID() })).status).toBe(200);
    // No cookie is sent: whoever opens the app on this phone is its owner.
    expect((await call('/api/me')).data.firstName).toBe('נועה');

    const squat = (db.prepare('SELECT id FROM exercises WHERE name = ?').get('סקוואט עם מוט') as { id: number }).id;
    const id = (await call('/api/solo', { date: localDate(new Date().toISOString()) })).data.id;
    expect((await call(`/api/classes/${id}/entries`, { exerciseId: squat, sets: [{ weight: 50, reps: 5 }] })).status).toBe(200);

    const bytes = raw.export();
    const reopened = initDb(wrapSqlJs(new SQL.Database(bytes)));
    seedLibrary(reopened);
    const again = createApp({ db: reopened, secret: 's', secureCookies: false, local: true });
    const history = (await (await again.request('/api/history')).json()) as any[];
    expect(history).toHaveLength(1);
  });

  it('browser crypto matches Node', () => {
    for (const m of ['', 'abc', 'x'.repeat(55), 'y'.repeat(64), 'שלום'.repeat(40)]) {
      expect(Buffer.from(sha256(new TextEncoder().encode(m))).toString('hex')).toBe(createHash('sha256').update(m).digest('hex'));
    }
    expect(createHmac('sha256', 'k'.repeat(90)).update('hello').digest('hex')).toBe(nodeHmac('sha256', 'k'.repeat(90)).update('hello').digest('hex'));
    expect(scryptSync('pw', 'salt', 32).toString('hex')).toHaveLength(64);
  });
});
