import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { Auth, MIN_PASSWORD, owner, setOwnerPassword, type SessionMember } from './auth.ts';
import { type DB, nowIso } from './db.ts';
import { AREA_LABELS, DuplicateExerciseError, LibraryError, createExercise } from './library.ts';
import { injuryOf, setInjury } from './injuries.ts';
import { badges } from './analytics.ts';
import { monthSummary, sinceStart } from './achievements.ts';
import { PERIODS, type Period, groupProgress, progressOverview } from './progress.ts';
import {
  ValidationError,
  addedExerciseItem,
  createSoloWorkout,
  deleteEntry,
  exerciseProgress,
  getClassWorkout,
  history,
  localDate,
  myExercises,
  recentClasses,
  saveEntry,
  searchLibrary,
} from './workouts.ts';

export interface AppDeps {
  db: DB;
  secret: string;
  secureCookies: boolean;
}

type Env = { Variables: { member: SessionMember; token: string } };

const COOKIE = 'gw_session';

/** "MM-DD" from "YYYY-MM-DD", "DD/MM", "DD.MM.YYYY" or "MM-DD". */
export function birthdayFrom(v: unknown): string | null {
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  let month: number;
  let day: number;
  if (m) (month = Number(m[2])), (day = Number(m[3]));
  else if ((m = s.match(/^(\d{1,2})[./](\d{1,2})(?:[./]\d{2,4})?$/))) (day = Number(m[1])), (month = Number(m[2]));
  else if ((m = s.match(/^(\d{1,2})-(\d{1,2})$/))) (month = Number(m[1])), (day = Number(m[2]));
  else return null;
  const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1])) return null;
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function createApp(deps: AppDeps) {
  const { db } = deps;
  const auth = new Auth(db, { secret: deps.secret });
  const app = new Hono<Env>();

  app.onError((err, c) => {
    if (err instanceof DuplicateExerciseError) return c.json({ error: err.message, exact: err.exact, similar: err.similar }, 409);
    if (err instanceof ValidationError || err instanceof LibraryError) return c.json({ error: err.message }, 400);
    console.error(err);
    return c.json({ error: 'שגיאה בשרת' }, 500);
  });

  const startSession = (c: any, r: { token: string; expiresAt: number }) =>
    setCookie(c, COOKIE, r.token, { httpOnly: true, sameSite: 'Lax', secure: deps.secureCookies, path: '/', expires: new Date(r.expiresAt) });

  // ---- Auth: one user, one password ----
  /** Whether the app was set up yet (a user and a password exist). */
  app.get('/api/auth/status', (c) => c.json({ setUp: !!owner(db) }));

  /** First run only: choose your name and password. */
  app.post('/api/auth/setup', async (c) => {
    if (owner(db)) return c.json({ error: 'האפליקציה כבר מוגדרת. התחברו עם הסיסמה.' }, 409);
    const { name, password } = await c.req.json<{ name?: string; password?: string }>();
    if (typeof password !== 'string' || password.length < MIN_PASSWORD) return c.json({ error: `סיסמה של ${MIN_PASSWORD} תווים לפחות` }, 400);
    const id = setOwnerPassword(db, password, String(name ?? '').slice(0, 60));
    startSession(c, auth.createSession(id));
    return c.json({ ok: true });
  });

  app.post('/api/auth/login', async (c) => {
    const { password } = await c.req.json<{ password?: string }>();
    const r = auth.login(String(password ?? ''));
    if (!r.ok) {
      const msg = { no_user: 'האפליקציה עוד לא הוגדרה', wrong_password: 'הסיסמה לא נכונה', locked: 'יותר מדי ניסיונות. נסו שוב בעוד 10 דקות.' }[r.error];
      return c.json({ error: msg }, r.error === 'locked' ? 429 : 400);
    }
    startSession(c, r);
    return c.json({ ok: true });
  });

  app.get('/health', (c) => c.json({ ok: true }));

  // Everything below needs to be logged in.
  app.use('/api/*', async (c, next) => {
    if (c.req.path.startsWith('/api/auth/') && c.req.path !== '/api/auth/logout' && c.req.path !== '/api/auth/logout-all') return next();
    const token = getCookie(c, COOKIE);
    const member = auth.memberForToken(token);
    if (!member) return c.json({ error: 'not_logged_in' }, 401);
    c.set('member', member);
    c.set('token', token!);
    return next();
  });

  app.post('/api/auth/logout', (c) => {
    auth.logout(c.get('token'));
    deleteCookie(c, COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  app.post('/api/auth/logout-all', (c) => {
    auth.logoutAll(c.get('member').id);
    deleteCookie(c, COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  // ---- Me ----
  const profileOf = (id: number) => {
    const r = db.prepare('SELECT gender, bodyweight, birthday FROM members WHERE id = ?').get(id) as {
      gender: string | null;
      bodyweight: number | null;
      birthday: string | null;
    };
    return { gender: (r?.gender as 'f' | 'm' | null) ?? null, bodyweight: r?.bodyweight ?? null, birthday: r?.birthday ?? null };
  };

  app.get('/api/me', (c) => {
    const m = c.get('member');
    return c.json({
      id: m.id,
      name: m.name,
      firstName: m.name.split(' ')[0],
      role: m.role,
      onboarded: !!m.onboarded_at,
      injury: injuryOf(db, m.id),
      ...profileOf(m.id),
    });
  });

  app.post('/api/me/name', async (c) => {
    const { name } = await c.req.json<{ name?: unknown }>();
    const clean = typeof name === 'string' ? name.trim().slice(0, 60) : '';
    if (!clean) throw new ValidationError('חסר שם');
    db.prepare('UPDATE members SET name = ? WHERE id = ?').run(clean, c.get('member').id);
    return c.json({ ok: true });
  });

  app.post('/api/me/password', async (c) => {
    const { password } = await c.req.json<{ password?: string }>();
    if (typeof password !== 'string' || password.length < MIN_PASSWORD) return c.json({ error: `סיסמה של ${MIN_PASSWORD} תווים לפחות` }, 400);
    setOwnerPassword(db, password); // logs out every device
    startSession(c, auth.createSession(c.get('member').id));
    return c.json({ ok: true });
  });

  // Day and month only, for the birthday workout badge.
  app.post('/api/me/birthday', async (c) => {
    const { birthday } = await c.req.json<{ birthday?: unknown }>();
    const b = birthday == null || birthday === '' ? null : birthdayFrom(birthday);
    if (birthday != null && birthday !== '' && !b) throw new ValidationError('תאריך לא תקין');
    db.prepare('UPDATE members SET birthday = ? WHERE id = ?').run(b, c.get('member').id);
    return c.json({ ok: true, ...profileOf(c.get('member').id) });
  });

  // Gender picks the wording (מלכה/מלך...); bodyweight is for the "x times bodyweight" badges.
  app.post('/api/me/profile', async (c) => {
    const { gender, bodyweight } = await c.req.json<{ gender?: unknown; bodyweight?: unknown }>();
    if (gender !== null && gender !== 'f' && gender !== 'm') throw new ValidationError('בחירה לא תקינה');
    const bw = bodyweight == null || bodyweight === '' ? null : Number(bodyweight);
    if (bw != null && !(bw >= 30 && bw <= 250)) throw new ValidationError('משקל גוף בין 30 ל-250 ק״ג');
    db.prepare('UPDATE members SET gender = ?, bodyweight = ? WHERE id = ?').run(gender, bw, c.get('member').id);
    return c.json({ ok: true, ...profileOf(c.get('member').id) });
  });

  app.post('/api/me/injury', async (c) => {
    const { text } = await c.req.json<{ text?: unknown }>();
    return c.json(setInjury(db, c.get('member').id, text ?? ''));
  });

  app.post('/api/me/onboarded', (c) => {
    db.prepare('UPDATE members SET onboarded_at = ? WHERE id = ?').run(nowIso(), c.get('member').id);
    return c.json({ ok: true });
  });

  // ---- Workouts ----
  app.get('/api/classes', (c) => c.json(recentClasses(db, c.get('member').id)));

  app.get('/api/classes/:id', (c) => {
    const w = getClassWorkout(db, c.get('member').id, Number(c.req.param('id')));
    if (!w) return c.json({ error: 'האימון לא נמצא' }, 404);
    return c.json(w);
  });

  // An exercise about to be added from the library: last time + recommended weight.
  app.get('/api/classes/:id/added/:exerciseId', (c) => {
    const item = addedExerciseItem(db, c.get('member').id, Number(c.req.param('id')), Number(c.req.param('exerciseId')));
    return item ? c.json(item) : c.json({ error: 'התרגיל לא נמצא' }, 404);
  });
  app.post('/api/classes/:id/entries/:entryId/delete', (c) => {
    deleteEntry(db, c.get('member').id, Number(c.req.param('id')), Number(c.req.param('entryId')));
    return c.json({ ok: true });
  });
  // Opens a workout for a day (today or earlier).
  app.post('/api/solo', async (c) => {
    const { date } = await c.req.json<{ date?: string }>();
    return c.json({ id: createSoloWorkout(db, c.get('member').id, String(date ?? '')) });
  });
  app.post('/api/classes/:id/entries', async (c) => c.json(saveEntry(db, c.get('member').id, Number(c.req.param('id')), await c.req.json())));

  app.get('/api/history', (c) => c.json(history(db, c.get('member').id)));
  app.get('/api/progress', (c) => c.json(myExercises(db, c.get('member').id)));
  app.get('/api/progress/:exerciseId', (c) => {
    const p = exerciseProgress(db, c.get('member').id, Number(c.req.param('exerciseId')));
    return p ? c.json(p) : c.json({ error: 'התרגיל לא נמצא' }, 404);
  });
  app.get('/api/badges', (c) => c.json(badges(db, c.get('member').id)));
  // "My progress": strength change per muscle group and exercise, for a month, 3 months or since the start.
  const period = (q: string | undefined): Period => (PERIODS.includes(q as Period) ? (q as Period) : '3m');
  app.get('/api/me/progress', (c) => c.json(progressOverview(db, c.get('member').id, period(c.req.query('period')))));
  app.get('/api/me/progress/groups/:group', (c) => {
    const g = groupProgress(db, c.get('member').id, c.req.param('group'), period(c.req.query('period')));
    return g ? c.json(g) : c.json({ error: 'קבוצת השריר לא נמצאה' }, 404);
  });
  // What to share: a month's summary (this month by default), and the exercise grown the most since the start.
  app.get('/api/me/month-summary', (c) => {
    const month = c.req.query('month') ?? localDate(new Date().toISOString()).slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new ValidationError('חודש לא תקין');
    return c.json(monthSummary(db, c.get('member').id, month));
  });
  app.get('/api/me/since-start', (c) => c.json({ since: sinceStart(db, c.get('member').id) }));

  // ---- Exercise library ----
  app.get('/api/exercises', (c) =>
    c.json({
      areas: AREA_LABELS,
      exercises: searchLibrary(db, c.req.query('q') ?? '', c.req.query('area') || null),
    }),
  );
  /** Adds your own exercise. 409 with `exact`/`similar` when it may already be in the library (send confirmNew: true to add anyway). */
  app.post('/api/exercises', async (c) => c.json({ id: createExercise(db, await c.req.json(), c.get('member').id) }));

  return app;
}
