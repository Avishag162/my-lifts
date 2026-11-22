// Analytics built on what you log: estimated strength (1RM) over time and badges.
import { type DB } from './db.ts';
import { TIME_ZONE } from './time.ts';
import { strength } from './rules.ts';
import { localDate } from './workouts.ts';
import { isBirthday, monthName } from './achievements.ts';

const DAY = 86_400_000;
const dayOf = (now: Date, daysAgo: number) => localDate(new Date(now.getTime() - daysAgo * DAY).toISOString());
const israelHHMM = (iso: string) =>
  new Date(iso).toLocaleString('sv-SE', { timeZone: TIME_ZONE, hour12: false }).slice(11, 16);
const round1 = (n: number) => Math.round(n * 10) / 10;

/** One logged exercise: the strongest set as estimated 1RM. */
interface StrengthLog {
  memberId: number;
  exerciseId: number;
  date: string;
  e1rm: number;
  classId: number | null;
}

/** Estimated 1RM of every logged weighted exercise, oldest first. */
function strengthLogs(db: DB, opts: { from?: string; to?: string; members?: number[] } = {}): StrengthLog[] {
  const where: string[] = ['x.tracks_weight = 1', 's.weight > 0'];
  const args: (string | number)[] = [];
  if (opts.from) (where.push('w.date >= ?'), args.push(opts.from));
  if (opts.to) (where.push('w.date <= ?'), args.push(opts.to));
  if (opts.members) {
    if (!opts.members.length) return [];
    where.push(`w.member_id IN (SELECT value FROM json_each(?))`);
    args.push(JSON.stringify(opts.members));
  }
  const rows = db
    .prepare(
      `SELECT e.id, w.member_id, e.exercise_id, w.date, w.class_id, s.weight, s.reps
       FROM set_entries s JOIN exercise_entries e ON e.id = s.entry_id JOIN workouts w ON w.id = e.workout_id
       JOIN exercises x ON x.id = e.exercise_id
       WHERE ${where.join(' AND ')} ORDER BY w.date, e.id`,
    )
    .all(...args) as any[];
  const byEntry = new Map<number, StrengthLog>();
  for (const r of rows) {
    const v = strength({ weight: r.weight, reps: r.reps });
    const cur = byEntry.get(r.id);
    if (!cur) byEntry.set(r.id, { memberId: r.member_id, exerciseId: r.exercise_id, date: r.date, e1rm: v, classId: r.class_id });
    else if (v > cur.e1rm) cur.e1rm = v;
  }
  return [...byEntry.values()].filter((l) => l.e1rm > 0);
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const i of items) {
    const k = key(i);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(i);
  }
  return m;
}

// ---------- Badges and challenges ----------

/** The colour family of a badge, for its card and its story image. */
export type BadgeKind = 'crown' | 'strength' | 'streak' | 'volume' | 'record' | 'habit' | 'milestone';

export interface Badge {
  id: string;
  title: string;
  detail: string;
  icon: string;
  kind: BadgeKind;
}

/** A badge not earned yet, shown greyed with how to get it. */
export interface LockedBadge {
  id: string;
  title: string;
  hint: string;
  icon: string;
  kind: BadgeKind;
}

export interface Challenge {
  id: string;
  title: string;
  value: number;
  target: number;
  unit: string;
}

const COUNT_STEPS = [1, 10, 25, 50, 100, 200, 300, 500];
const STREAK_STEPS = [3, 6, 10, 20, 52, 78, 104];
const TON_STEPS = [1, 10, 50, 100, 250, 500, 1000, 2000];
const PR_STEPS = [1, 10, 25, 50, 100, 200, 300];
const VARIETY_STEPS = [10, 25, 40, 60];
const TIME_STEPS = [5, 20, 50, 100];
/** Workouts in one month: 12 is a perfect month, and two harder ones above it. */
const MONTH_TIERS: [number, string][] = [
  [12, 'חודש מושלם'],
  [16, 'חודש מטורף'],
  [20, 'חודש של ברזל'],
];


const range = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
/** Weight badges, only for the heavy lifts: the heaviest weight actually lifted, even for one rep. A step every 10 kg. */
export const CLUBS: { exercise: string; steps: number[] }[] = [
  { exercise: 'דדליפט', steps: range(60, 300, 10) },
  { exercise: 'דדליפט סומו', steps: range(60, 300, 10) },
  { exercise: 'סקוואט עם מוט', steps: range(40, 250, 10) },
  { exercise: 'פרונט סקוואט', steps: range(40, 200, 10) },
  { exercise: 'היפ תראסט', steps: range(60, 300, 10) },
  { exercise: 'לחיצת חזה', steps: range(40, 180, 10) },
];

/** Lifting a multiple of your own bodyweight (needs the bodyweight in the profile). */
const BODYWEIGHT: { exercise: string; times: number[]; short: string }[] = [
  { exercise: 'דדליפט', times: [1, 1.5, 2, 2.5, 3], short: 'דדליפט' },
  { exercise: 'סקוואט עם מוט', times: [0.75, 1, 1.5, 2, 2.5], short: 'סקוואט' },
  { exercise: 'לחיצת חזה', times: [0.5, 0.75, 1, 1.25, 1.5], short: 'לחיצת חזה' },
  { exercise: 'היפ תראסט', times: [1, 1.5, 2, 2.5, 3], short: 'היפ תראסט' },
];

/** Sunday that starts the week of a YYYY-MM-DD date. */
function weekOf(date: string): string {
  const d = new Date(date + 'T12:00:00Z');
  return new Date(d.getTime() - d.getUTCDay() * DAY).toISOString().slice(0, 10);
}

/** The longest and the current run of weeks with at least one logged workout. */
export function weekStreaks(dates: string[], now = new Date()): { current: number; best: number } {
  const weeks = [...new Set(dates.map(weekOf))].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const w of weeks) {
    run = prev && Date.parse(w) - Date.parse(prev) === 7 * DAY ? run + 1 : 1;
    best = Math.max(best, run);
    prev = w;
  }
  const thisWeek = weekOf(localDate(now.toISOString()));
  const lastWeek = new Date(Date.parse(thisWeek) - 7 * DAY).toISOString().slice(0, 10);
  // A streak still counts this week until the week is over.
  const current = prev === thisWeek || prev === lastWeek ? run : 0;
  return { current, best };
}

const times = (t: number) =>
  t === 1 ? 'משקל הגוף' : t === 0.5 ? 'חצי ממשקל הגוף' : t === 2 ? 'פעמיים משקל הגוף' : t > 1 ? `פי ${t} ממשקל הגוף` : `${Math.round(t * 100)}% ממשקל הגוף`;

export function badges(
  db: DB,
  memberId: number,
  now = new Date(),
): { earned: Badge[]; locked: LockedBadge[]; challenges: Challenge[]; streak: number } {
  const me = db.prepare('SELECT gender, bodyweight, birthday FROM members WHERE id = ?').get(memberId) as
    | { gender: string | null; bodyweight: number | null; birthday: string | null }
    | undefined;
  const gender = me?.gender ?? null;
  const workoutsRows = db
    .prepare(
      `SELECT w.id, w.date, c.starts_at FROM workouts w LEFT JOIN classes c ON c.id = w.class_id
       WHERE w.member_id = ? AND w.solo = 0 AND EXISTS (SELECT 1 FROM exercise_entries e WHERE e.workout_id = w.id) ORDER BY w.date`,
    )
    .all(memberId) as { id: number; date: string; starts_at: string | null }[];
  const dates = workoutsRows.map((r) => r.date);
  const workouts = dates.length;
  const sets = db
    .prepare(
      `SELECT w.id AS workout_id, e.exercise_id, x.name AS exercise, x.body_area, s.weight, s.reps, s.is_pr
       FROM set_entries s JOIN exercise_entries e ON e.id = s.entry_id JOIN workouts w ON w.id = e.workout_id
       LEFT JOIN exercises x ON x.id = e.exercise_id WHERE w.member_id = ?`,
    )
    .all(memberId) as { workout_id: number; exercise_id: number | null; exercise: string | null; body_area: string | null; weight: number | null; reps: number; is_pr: number }[];
  const tons = sets.reduce((t, s) => t + (s.weight && s.weight > 0 ? s.weight * s.reps : 0), 0) / 1000;
  const prs = sets.filter((s) => s.is_pr).length;
  const { current, best } = weekStreaks(dates, now);
  const monthStart = localDate(now.toISOString()).slice(0, 7) + '-01';
  const thisMonth = dates.filter((d) => d >= monthStart).length;

  const earned: Badge[] = [];
  const locked: LockedBadge[] = [];
  const challenges: Challenge[] = [];
  /** Steps of one family: every reached step is a badge, the next one is locked. */
  const ladder = (v: number, steps: number[], make: (n: number) => Omit<Badge, 'id'> & { id?: string }, id: (n: number) => string, hint: (n: number) => string) => {
    for (const n of steps.filter((n) => v >= n)) earned.push({ id: id(n), ...make(n) });
    const next = steps.find((n) => v < n);
    if (next != null) {
      const b = make(next);
      locked.push({ id: id(next), title: b.title, icon: b.icon, kind: b.kind, hint: hint(next) });
    }
    return next;
  };

  // ---- Strength: clubs and bodyweight multiples ----
  const heaviest = new Map<string, number>();
  for (const s of sets) if (s.exercise && s.weight && s.weight > 0) heaviest.set(s.exercise, Math.max(heaviest.get(s.exercise) ?? 0, s.weight));
  for (const c of CLUBS) {
    const top = heaviest.get(c.exercise) ?? 0;
    const club = (n: number) => ({ icon: '🏋️', kind: 'strength' as const, title: `${n} ק״ג ${c.exercise}`, detail: `הרמת ${n} ק״ג ב${c.exercise}` });
    // Only the highest weight reached shows, so a 150 kg deadlift is one badge and not ten.
    const reached = c.steps.filter((n) => top >= n).pop();
    if (reached != null) earned.push({ id: `club-${c.exercise}-${reached}`, ...club(reached) });
    const next = c.steps.find((n) => top < n);
    if (next != null && top > 0) locked.push({ id: `club-${c.exercise}-${next}`, title: club(next).title, icon: '🏋️', kind: 'strength', hint: `עוד ${round1(next - top)} ק״ג` });
  }
  const bw = me?.bodyweight ?? 0;
  if (bw > 0) {
    for (const b of BODYWEIGHT) {
      const ratio = (heaviest.get(b.exercise) ?? 0) / bw;
      ladder(
        ratio,
        b.times,
        (t) => ({ icon: '🦾', kind: 'strength', title: `${b.short} ב${times(t)}`, detail: `הרמת ב${b.exercise} ${times(t)}` }),
        (t) => `bw-${b.exercise}-${t}`,
        (t) => `${b.exercise}: ${Math.round(t * bw)} ק״ג`,
      );
    }
  }

  // ---- The big three together: heaviest squat + bench + deadlift ----
  const big3 = ['סקוואט עם מוט', 'לחיצת חזה', 'דדליפט'].map((e) => heaviest.get(e) ?? 0);
  if (big3.every((v) => v > 0)) {
    const total = big3.reduce((a, b) => a + b, 0);
    const steps = [150, 200, 250, 300, 350, 400, 450, 500, 600];
    const reached = steps.filter((n) => total >= n).pop();
    const totalBadge = (n: number) => ({ icon: '🏆', kind: 'strength' as const, title: `טוטאל ${n} ק״ג`, detail: 'סקוואט + לחיצת חזה + דדליפט, המשקל הכי כבד בכל אחד, ביחד' });
    if (reached != null) earned.push({ id: `total-${reached}`, ...totalBadge(reached) });
    const next = steps.find((n) => total < n);
    if (next != null) locked.push({ id: `total-${next}`, title: totalBadge(next).title, icon: '🏆', kind: 'strength', hint: `עוד ${round1(next - total)} ק״ג בטוטאל` });
  } else locked.push({ id: 'total', title: 'טוטאל', icon: '🏆', kind: 'strength', hint: 'סקוואט, לחיצת חזה ודדליפט: הסכום של המשקל הכי כבד בכל אחד' });

  // ---- Progress on one exercise against the first time ----
  const byExercise = new Map<string, { first: number; best: number; n: number }>();
  const perEntry = new Map<string, number>();
  for (const s of sets) {
    if (!s.exercise || !s.weight || s.weight <= 0) continue;
    const key = `${s.workout_id}:${s.exercise}`;
    perEntry.set(key, Math.max(perEntry.get(key) ?? 0, strength({ weight: s.weight, reps: s.reps })));
  }
  for (const [key, v] of perEntry) {
    const ex = key.slice(key.indexOf(':') + 1);
    const cur = byExercise.get(ex);
    if (!cur) byExercise.set(ex, { first: v, best: v, n: 1 });
    else (cur.best = Math.max(cur.best, v)), cur.n++;
  }
  let bestGain = { pct: 0, exercise: '' };
  for (const [ex, g] of byExercise) {
    if (g.n < 3 || g.first <= 0) continue;
    const pct = (g.best / g.first - 1) * 100;
    if (pct > bestGain.pct) bestGain = { pct, exercise: ex };
  }
  ladder(
    bestGain.pct,
    [10, 25, 50],
    (n) => ({ icon: '📈', kind: 'record', title: `שיפור של ${n}%`, detail: bestGain.exercise ? `התחזקת ב-${n}% ב${bestGain.exercise} מאז הפעם הראשונה` : `התחזקת ב-${n}% בתרגיל אחד` }),
    (n) => `gain-${n}`,
    (n) => `להתחזק ב-${n}% בתרגיל אחד מאז הפעם הראשונה`,
  );

  // ---- Milestones ----
  const nw = ladder(
    workouts,
    COUNT_STEPS,
    (n) => ({ icon: '🏋️', kind: 'milestone', title: n === 1 ? 'אימון ראשון' : `${n} אימונים`, detail: n === 1 ? 'רשמת את האימון הראשון' : `רשמת ${n} אימונים` }),
    (n) => `workouts-${n}`,
    (n) => `עוד ${n - workouts} אימונים`,
  );
  const nb = ladder(
    best,
    STREAK_STEPS,
    (n) => ({ icon: '🔥', kind: 'streak', title: `${n} שבועות ברצף`, detail: `רשמת לפחות אימון אחד בשבוע, ${n} שבועות ברצף` }),
    (n) => `streak-${n}`,
    (n) => `${n} שבועות ברצף עם אימון רשום`,
  );
  const nt = ladder(
    tons,
    TON_STEPS,
    (n) => ({ icon: '💪', kind: 'volume', title: `${n} טון`, detail: `הרמת בסך הכל ${n.toLocaleString('he-IL')} טון` }),
    (n) => `tons-${n}`,
    (n) => `עוד ${round1(n - tons)} טון`,
  );
  ladder(
    prs,
    PR_STEPS,
    (n) => ({ icon: '⭐', kind: 'record', title: n === 1 ? 'שיא ראשון' : `${n} שיאים`, detail: n === 1 ? 'שברת שיא אישי' : `שברת ${n} שיאים אישיים` }),
    (n) => `prs-${n}`,
    (n) => `עוד ${n - prs} שיאים אישיים`,
  );
  const variety = new Set(sets.filter((s) => s.exercise_id != null).map((s) => s.exercise_id)).size;
  ladder(
    variety,
    VARIETY_STEPS,
    (n) => ({ icon: '🧭', kind: 'habit', title: `${n} תרגילים שונים`, detail: `רשמת ${n} תרגילים שונים` }),
    (n) => `variety-${n}`,
    (n) => `עוד ${n - variety} תרגילים שונים`,
  );

  // ---- One great workout ----
  const perWorkout = new Map<number, { kg: number; prs: number; areas: Set<string> }>();
  for (const s of sets) {
    const w = perWorkout.get(s.workout_id) ?? { kg: 0, prs: 0, areas: new Set<string>() };
    if (s.weight && s.weight > 0) w.kg += s.weight * s.reps;
    if (s.is_pr) w.prs++;
    if (s.body_area) w.areas.add(s.body_area);
    perWorkout.set(s.workout_id, w);
  }
  const maxPrs = Math.max(0, ...[...perWorkout.values()].map((w) => w.prs));
  const maxKg = Math.max(0, ...[...perWorkout.values()].map((w) => w.kg));
  const PR_DAY: Record<number, string> = { 3: 'יום שיאים', 5: 'סופת שיאים', 8: 'יום היסטורי' };
  ladder(
    maxPrs,
    [3, 5, 8],
    (n) => ({ icon: '⚡', kind: 'record', title: PR_DAY[n], detail: `${n} שיאים אישיים באימון אחד` }),
    (n) => (n === 3 ? 'pr-day' : `pr-day-${n}`),
    (n) => `${n} שיאים אישיים באימון אחד`,
  );
  ladder(
    maxKg / 1000,
    [5, 10, 15, 20],
    (n) => ({ icon: '🚀', kind: 'volume', title: `${n} טון באימון`, detail: `הרמת ${n} טון באימון אחד` }),
    (n) => `big-workout-${n}`,
    (n) => `${n} טון באימון אחד`,
  );

  // ---- Habits ----
  const hourOf = (iso: string | null) => (iso ? Number(new Date(iso).toLocaleString('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', hour12: false })) : null);
  const early = workoutsRows.filter((r) => (hourOf(r.starts_at) ?? 12) < 8).length;
  const late = workoutsRows.filter((r) => (hourOf(r.starts_at) ?? 12) >= 20).length;
  ladder(early, TIME_STEPS, (n) => ({ icon: '🌅', kind: 'habit', title: n === 5 ? 'ציפור מוקדמת' : 'ציפור מוקדמת מקצוענית', detail: `${n} אימונים לפני 08:00` }), (n) => `early-${n}`, (n) => `${n} אימונים לפני 08:00`);
  ladder(late, TIME_STEPS, (n) => ({ icon: '🌙', kind: 'habit', title: n === 5 ? 'ינשוף לילה' : 'ינשוף לילה מקצוען', detail: `${n} אימונים מ-20:00 והלאה` }), (n) => `late-${n}`, (n) => `${n} אימונים מ-20:00 והלאה`);
  const legs = workoutsRows.filter((r) => perWorkout.get(r.id)?.areas.has('legs')).length;
  ladder(legs, [10, 25, 50, 100], (n) => ({ icon: '🦵', kind: 'habit', title: n === 10 ? 'לא מדלגים על רגליים' : `${n} אימוני רגליים`, detail: `${n} אימונים עם תרגילי רגליים` }), (n) => `legs-${n}`, (n) => `עוד ${n - legs} אימונים עם רגליים`);
  const months = new Map<string, number>();
  const monthAreas = new Map<string, Set<string>>();
  for (const r of workoutsRows) {
    const m = r.date.slice(0, 7);
    months.set(m, (months.get(m) ?? 0) + 1);
    const a = monthAreas.get(m) ?? new Set<string>();
    for (const x of perWorkout.get(r.id)?.areas ?? []) a.add(x);
    monthAreas.set(m, a);
  }
  // A badge for every month with 12 workouts or more, named by how full it was, so this month's can be shared.
  for (const [m, n] of [...months.entries()].sort()) {
    const tier = [...MONTH_TIERS].reverse().find(([t]) => n >= t);
    if (tier) earned.push({ id: `month-${m}`, icon: '📅', kind: 'habit', title: `${tier[1]} · ${monthName(m)}`, detail: `${n} אימונים ב${monthName(m)} ${m.slice(0, 4)}` });
  }
  const bestMonth = Math.max(0, ...months.values());
  const nextTier = MONTH_TIERS.find(([t]) => bestMonth < t);
  if (nextTier) locked.push({ id: `month-tier-${nextTier[0]}`, icon: '📅', kind: 'habit', title: nextTier[1], hint: `${nextTier[0]} אימונים בחודש אחד` });
  const fullMonths = [...months.keys()].filter((m) => months.get(m)! >= 12).sort();
  ladder(
    fullMonths.length,
    [3, 6, 12],
    (n) => ({ icon: '📅', kind: 'streak', title: `${n} חודשים מושלמים`, detail: `${n} חודשים עם 12 אימונים ומעלה` }),
    (n) => `full-months-${n}`,
    (n) => `עוד ${n - fullMonths.length} חודשים עם 12 אימונים ומעלה`,
  );
  // Full months in a row: a quarter, then half a year.
  let run = 0;
  let bestRun = 0;
  for (let i = 0; i < fullMonths.length; i++) {
    const prev = i ? new Date(Date.UTC(Number(fullMonths[i].slice(0, 4)), Number(fullMonths[i].slice(5)) - 2, 1)).toISOString().slice(0, 7) : null;
    run = prev === fullMonths[i - 1] ? run + 1 : 1;
    bestRun = Math.max(bestRun, run);
  }
  ladder(
    bestRun,
    [3, 6],
    (n) => ({ icon: '🔥', kind: 'streak', title: n === 3 ? 'רבעון מושלם' : 'חצי שנה מושלמת', detail: `${n} חודשים ברצף עם 12 אימונים ומעלה בכל אחד` }),
    (n) => `full-run-${n}`,
    (n) => `${n} חודשים ברצף עם 12 אימונים ומעלה`,
  );
  ladder(Math.max(0, ...[...monthAreas.values()].map((a) => a.size)), [7], () => ({ icon: '🧩', kind: 'habit', title: 'גוף שלם', detail: 'עבדת על כל 7 אזורי הגוף בחודש אחד' }), () => 'full-body', () => 'כל 7 אזורי הגוף בחודש אחד');
  let comeback = false;
  for (let i = 1; i < dates.length; i++) if (Date.parse(dates[i]) - Date.parse(dates[i - 1]) >= 28 * DAY) comeback = true;
  if (comeback) earned.push({ id: 'comeback', icon: '🔄', kind: 'streak', title: 'הקאמבק', detail: 'חזרת להתאמן אחרי הפסקה של 4 שבועות ומעלה' });

  // ---- Birthday: a workout on the day, a badge for each year ----
  const birthday = me?.birthday ?? null;
  const today = localDate(now.toISOString());
  const bdays = birthday ? [...new Set(dates.filter((d) => isBirthday(d, birthday)).map((d) => d.slice(0, 4)))] : [];
  for (const y of bdays)
    earned.push({ id: `birthday-${y}`, icon: '🎂', kind: 'habit', title: 'אימון יום הולדת', detail: `התאמנת ביום ההולדת שלך ב-${y}. מזל טוב!` });
  if (!bdays.includes(today.slice(0, 4)))
    locked.push({ id: 'birthday', icon: '🎂', kind: 'habit', title: 'אימון יום הולדת', hint: birthday ? 'להתאמן ביום ההולדת' : 'להוסיף יום הולדת בפרופיל ולהתאמן ביום' });

  // ---- Records in many exercises ----
  const prExercises = new Set(sets.filter((s) => s.is_pr && s.exercise_id != null).map((s) => s.exercise_id)).size;
  ladder(
    prExercises,
    [5, 10, 20, 30],
    (n) => ({ icon: '🎯', kind: 'record', title: `שיאים ב-${n} תרגילים`, detail: `שברת שיא אישי ב-${n} תרגילים שונים` }),
    (n) => `pr-exercises-${n}`,
    (n) => `שיא אישי בעוד ${n - prExercises} תרגילים`,
  );

  // ---- Time with the app, from the first workout ----
  const daysIn = dates.length ? Math.floor((Date.parse(today) - Date.parse(dates[0])) / DAY) : 0;
  const ANNIVERSARY: [number, string][] = [
    [30, 'חודש באפליקציה'],
    [182, 'חצי שנה באפליקציה'],
    [365, 'שנה באפליקציה'],
    [730, 'שנתיים באפליקציה'],
  ];
  if (dates.length)
    ladder(
      daysIn,
      ANNIVERSARY.map(([d]) => d),
      (d) => ({ icon: '🎖️', kind: 'milestone', title: ANNIVERSARY.find(([x]) => x === d)![1], detail: `רושם/ת אימונים כבר ${ANNIVERSARY.find(([x]) => x === d)![1].replace(' באפליקציה', '')}` }),
      (d) => `anniversary-${d}`,
      (d) => `עוד ${d - daysIn} ימים`,
    );

  // ---- Challenges: what's closest ----
  if (birthday && isBirthday(today, birthday) && !bdays.includes(today.slice(0, 4)))
    challenges.push({ id: 'birthday', title: 'מזל טוב! אימון היום = תג יום הולדת 🎂', value: 0, target: 1, unit: 'אימון' });
  if (nw) challenges.push({ id: 'workouts', title: `${nw} אימונים`, value: workouts, target: nw, unit: 'אימונים' });
  const ns = STREAK_STEPS.find((n) => current < n);
  if (ns) challenges.push({ id: 'streak', title: `${ns} שבועות ברצף`, value: current, target: ns, unit: 'שבועות' });
  if (nt) challenges.push({ id: 'tons', title: `${nt} טון`, value: round1(tons), target: nt, unit: 'טון' });
  const monthGoal = MONTH_TIERS.find(([t]) => thisMonth < t) ?? MONTH_TIERS[MONTH_TIERS.length - 1];
  challenges.push({ id: 'month', title: `${monthGoal[0]} אימונים החודש · ${monthGoal[1]}`, value: Math.min(thisMonth, monthGoal[0]), target: monthGoal[0], unit: 'אימונים' });
  void nb;

  // Titles first, then the rest, highest step of each family first.
  const order: BadgeKind[] = ['crown', 'strength', 'record', 'volume', 'streak', 'habit', 'milestone'];
  earned.reverse().sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  locked.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return { earned, locked, challenges, streak: current };
}
