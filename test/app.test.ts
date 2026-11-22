import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/server/app.ts';
import { openDb, type DB } from '../src/server/db.ts';
import { seedLibrary } from '../src/server/library.ts';
import { setOwnerPassword } from '../src/server/auth.ts';
import { localDate } from '../src/server/workouts.ts';

/** A tiny client that keeps the session cookie, like a browser. */
function client(app: ReturnType<typeof createApp>) {
  let cookie = '';
  const call = async (path: string, body?: unknown) => {
    const res = await app.request(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, data: (await res.json().catch(() => ({}))) as any };
  };
  return { call, logoutLocally: () => (cookie = '') };
}

const ex = (db: DB, name: string) => (db.prepare('SELECT id FROM exercises WHERE name = ?').get(name) as { id: number }).id;

describe('single-user app', () => {
  let db: DB;
  let app: ReturnType<typeof createApp>;
  beforeEach(() => {
    db = openDb(':memory:');
    seedLibrary(db);
    app = createApp({ db, secret: 'test-secret', secureCookies: false });
  });

  it('asks to set up on first run, then logs in with the password only', async () => {
    const c = client(app);
    expect((await c.call('/api/auth/status')).data).toEqual({ setUp: false });
    expect((await c.call('/api/me')).status).toBe(401);
    expect((await c.call('/api/auth/setup', { name: 'נועה', password: '123' })).status).toBe(400);
    expect((await c.call('/api/auth/setup', { name: 'נועה', password: 'secret1' })).status).toBe(200);
    expect((await c.call('/api/me')).data.firstName).toBe('נועה');
    // A second setup is refused: only one user.
    expect((await c.call('/api/auth/setup', { name: 'x', password: 'another1' })).status).toBe(409);

    c.logoutLocally();
    expect((await c.call('/api/auth/status')).data).toEqual({ setUp: true });
    expect((await c.call('/api/auth/login', { password: 'wrong' })).status).toBe(400);
    expect((await c.call('/api/auth/login', { password: 'secret1' })).status).toBe(200);
    expect((await c.call('/api/me')).status).toBe(200);
  });

  it('locks the login after 5 wrong passwords', async () => {
    setOwnerPassword(db, 'secret1', 'נועה');
    const c = client(app);
    for (let i = 0; i < 4; i++) expect((await c.call('/api/auth/login', { password: 'nope' })).status).toBe(400);
    expect((await c.call('/api/auth/login', { password: 'nope' })).status).toBe(429);
    expect((await c.call('/api/auth/login', { password: 'secret1' })).status).toBe(429);
  });

  it('logout ends the session; a new password logs out every device', async () => {
    const a = client(app);
    await a.call('/api/auth/setup', { name: 'נועה', password: 'secret1' });
    const b = client(app);
    await b.call('/api/auth/login', { password: 'secret1' });
    expect((await a.call('/api/me/password', { password: 'secret2' })).status).toBe(200);
    expect((await a.call('/api/me')).status).toBe(200); // the device that changed it stays in
    expect((await b.call('/api/me')).status).toBe(401);
    await a.call('/api/auth/logout', {});
    expect((await a.call('/api/me')).status).toBe(401);
  });

  it('opens a workout, logs sets, finds a record next time, and counts it for badges', async () => {
    const c = client(app);
    await c.call('/api/auth/setup', { name: 'נועה', password: 'secret1' });
    const squat = ex(db, 'סקוואט עם מוט');
    const yesterday = localDate(new Date(Date.now() - 86_400_000).toISOString());
    const today = localDate(new Date().toISOString());

    const first = (await c.call('/api/solo', { date: yesterday })).data.id as number;
    let r = await c.call(`/api/classes/${first}/entries`, { exerciseId: squat, sets: [{ weight: 40, reps: 5 }, { weight: 40, reps: 5 }] });
    expect(r.status).toBe(200);

    const second = (await c.call('/api/solo', { date: today })).data.id as number;
    const added = (await c.call(`/api/classes/${second}/added/${squat}`)).data;
    expect(added.last.sets).toEqual([{ weight: 40, reps: 5 }, { weight: 40, reps: 5 }]);
    expect(added.target.weight).toBeGreaterThanOrEqual(40);
    r = await c.call(`/api/classes/${second}/entries`, { exerciseId: squat, sets: [{ weight: 45, reps: 5 }] });
    expect(r.data.prSets.length).toBeGreaterThan(0);

    expect((await c.call('/api/history')).data).toHaveLength(2);
    const badges = (await c.call('/api/badges')).data;
    expect(badges.earned.some((b: any) => b.id === 'workouts-1')).toBe(true);
    const month = (await c.call(`/api/me/month-summary?month=${today.slice(0, 7)}`)).data;
    expect(month.prs).toBeGreaterThan(0);
  });

  it('adds your own exercise, and warns when it may already be there', async () => {
    const c = client(app);
    await c.call('/api/auth/setup', { name: 'נועה', password: 'secret1' });
    const dup = await c.call('/api/exercises', { name: 'סקוואט עם מוט', bodyArea: 'legs', equipment: 'barbell', weightStep: 2.5, tracksWeight: true });
    expect(dup.status).toBe(409);
    expect(dup.data.exact.name).toBe('סקוואט עם מוט');
    const ok = await c.call('/api/exercises', { name: 'Zercher Carry', bodyArea: 'core', equipment: 'barbell', weightStep: 2.5, tracksWeight: true, confirmNew: true });
    expect(ok.status).toBe(200);
    const found = (await c.call('/api/exercises?q=zercher')).data.exercises;
    expect(found.map((e: any) => e.id)).toContain(ok.data.id);
  });

  it('keeps profile details', async () => {
    const c = client(app);
    await c.call('/api/auth/setup', { name: 'נועה', password: 'secret1' });
    await c.call('/api/me/profile', { gender: 'f', bodyweight: 60 });
    await c.call('/api/me/birthday', { birthday: '03-14' });
    await c.call('/api/me/injury', { text: 'כתף ימין' });
    const me = (await c.call('/api/me')).data;
    expect(me).toMatchObject({ gender: 'f', bodyweight: 60, birthday: '03-14' });
    expect(me.injury.text).toBe('כתף ימין');
  });
});
