// The things to share: the monthly summary and "since I started". Used by badges() in analytics.ts and by the API.
import { type DB } from './db.ts';
import { TIME_ZONE } from './time.ts';
import { localDate } from './workouts.ts';

const DAY = 86_400_000;
const round1 = (n: number) => Math.round(n * 10) / 10;
const israelHHMM = (iso: string) => new Date(iso).toLocaleString('sv-SE', { timeZone: TIME_ZONE, hour12: false }).slice(11, 16);

export const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
export const monthName = (month: string) => MONTH_NAMES[Number(month.slice(5, 7)) - 1];

/** Sunday that starts the week of a YYYY-MM-DD date. */
export function weekOf(date: string): string {
  const d = new Date(date + 'T12:00:00Z');
  return new Date(d.getTime() - d.getUTCDay() * DAY).toISOString().slice(0, 10);
}
const addDays = (date: string, n: number) => new Date(Date.parse(date + 'T12:00:00Z') + n * DAY).toISOString().slice(0, 10);
const prevMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
};
const monthEnd = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

// ---------- Sharing: the month, and since I started ----------

export interface MonthSummary {
  month: string;
  monthName: string;
  workouts: number;
  tons: number;
  sets: number;
  prs: number;
  records: { exercise: string; weight: number | null; reps: number }[];
  topExercise: string | null;
}

export function monthSummary(db: DB, memberId: number, month: string): MonthSummary {
  const from = `${month}-01`;
  const to = monthEnd(month);
  const sets = db
    .prepare(
      `SELECT COALESCE(x.name, e.raw_name) AS exercise, s.weight, s.reps, s.is_pr, w.id AS workout_id
       FROM set_entries s JOIN exercise_entries e ON e.id = s.entry_id JOIN workouts w ON w.id = e.workout_id
       LEFT JOIN exercises x ON x.id = e.exercise_id WHERE w.member_id = ? AND w.date >= ? AND w.date <= ?`,
    )
    .all(memberId, from, to) as { exercise: string; weight: number | null; reps: number; is_pr: number; workout_id: number }[];
  const kg = new Map<string, number>();
  for (const s of sets) if (s.weight && s.weight > 0) kg.set(s.exercise, (kg.get(s.exercise) ?? 0) + s.weight * s.reps);
  // One record per exercise, the heaviest.
  const best = new Map<string, { exercise: string; weight: number | null; reps: number }>();
  for (const s of sets.filter((s) => s.is_pr)) {
    const cur = best.get(s.exercise);
    if (!cur || (s.weight ?? 0) > (cur.weight ?? 0)) best.set(s.exercise, { exercise: s.exercise, weight: s.weight, reps: s.reps });
  }
  return {
    month,
    monthName: monthName(month),
    workouts: new Set(sets.map((s) => s.workout_id)).size,
    tons: round1(sets.reduce((t, s) => t + (s.weight && s.weight > 0 ? s.weight * s.reps : 0), 0) / 1000),
    sets: sets.length,
    prs: sets.filter((s) => s.is_pr).length,
    records: [...best.values()].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)).slice(0, 3),
    topExercise: [...kg.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
  };
}

export interface SinceStart {
  exercise: string;
  from: number;
  to: number;
  pct: number;
  since: string; // YYYY-MM-DD of the first time
}

/** The exercise the trainee grew the most in: the heaviest weight the first time against the heaviest since (4 weeks apart at least). */
export function sinceStart(db: DB, memberId: number): SinceStart | null {
  const rows = db
    .prepare(
      `SELECT x.name AS exercise, w.date, MAX(s.weight) AS top
       FROM set_entries s JOIN exercise_entries e ON e.id = s.entry_id JOIN workouts w ON w.id = e.workout_id
       JOIN exercises x ON x.id = e.exercise_id
       WHERE w.member_id = ? AND s.weight > 0 GROUP BY w.id, x.id ORDER BY w.date`,
    )
    .all(memberId) as { exercise: string; date: string; top: number }[];
  const byEx = new Map<string, { date: string; top: number }[]>();
  for (const r of rows) byEx.set(r.exercise, [...(byEx.get(r.exercise) ?? []), r]);
  let best: SinceStart | null = null;
  for (const [exercise, list] of byEx) {
    if (list.length < 3) continue;
    const first = list[0];
    const later = list.filter((l) => Date.parse(l.date) - Date.parse(first.date) >= 28 * DAY);
    if (!later.length) continue;
    const to = Math.max(...later.map((l) => l.top));
    const pct = Math.round((to / first.top - 1) * 100);
    if (pct > 0 && (!best || pct > best.pct)) best = { exercise, from: first.top, to, pct, since: first.date };
  }
  return best;
}

// ---------- Small helpers for the badge list ----------

/** True when a YYYY-MM-DD date is the birthday (MM-DD). 29 February counts on the 28th in other years. */
export function isBirthday(date: string, birthday: string): boolean {
  if (date.slice(5) === birthday) return true;
  const y = Number(date.slice(0, 4));
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return birthday === '02-29' && !leap && date.slice(5) === '02-28';
}
