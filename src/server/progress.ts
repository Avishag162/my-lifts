// The trainee's "my progress" tab: strength change per muscle group and per exercise, for a period.
import { type DB } from './db.ts';
import { badges } from './analytics.ts';
import { localDate } from './workouts.ts';

export type Period = 'month' | '3m' | 'all';
export const PERIODS: Period[] = ['month', '3m', 'all'];

export { GROUPS, groupOf, groupsOf } from '../shared/muscles.ts';
import { GROUPS, groupOf, groupsOf } from '../shared/muscles.ts';

const DAY = 86_400_000;
function periodStart(period: Period, now: Date): string | null {
  if (period === 'all') return null;
  return localDate(new Date(now.getTime() - (period === 'month' ? 30 : 90) * DAY).toISOString());
}

interface Session {
  date: string;
  top: number;
}
export interface ExerciseTrend {
  id: number;
  name: string;
  group: string;
  /** Every group it counts for (a deadlift: back, legs, glutes). */
  groups: string[];
  /** Workouts with this exercise in the period. */
  sessions: number;
  lastDate: string;
  /** Heaviest weight in the period. */
  best: number;
  /** Change of the heaviest weight from the start of the period (the last time before it, else its first time). */
  pct: number | null;
  /** The heaviest weight of each time, oldest first (the last time before the period, then up to 8 in it). */
  series: number[];
}

function trends(db: DB, memberId: number, period: Period, now: Date): { start: string | null; list: ExerciseTrend[]; byExercise: Map<number, Session[]> } {
  const start = periodStart(period, now);
  const rows = db
    .prepare(
      `SELECT x.id, x.name, x.body_area, x.muscle_groups, w.date, MAX(s.weight) AS top
       FROM set_entries s JOIN exercise_entries e ON e.id = s.entry_id JOIN workouts w ON w.id = e.workout_id
       JOIN exercises x ON x.id = e.exercise_id
       WHERE w.member_id = ? AND x.tracks_weight = 1 AND s.weight > 0
       GROUP BY e.id ORDER BY w.date, e.id`,
    )
    .all(memberId) as { id: number; name: string; body_area: string; muscle_groups: string | null; date: string; top: number }[];
  const byExercise = new Map<number, Session[]>();
  const info = new Map<number, { name: string; area: string; groups: string | null }>();
  for (const r of rows) {
    if (!byExercise.has(r.id)) byExercise.set(r.id, []);
    byExercise.get(r.id)!.push({ date: r.date, top: r.top });
    info.set(r.id, { name: r.name, area: r.body_area, groups: r.muscle_groups });
  }
  const list: ExerciseTrend[] = [];
  for (const [id, all] of byExercise) {
    const inPeriod = start ? all.filter((s) => s.date >= start) : all;
    if (!inPeriod.length) continue;
    const before = start ? all.filter((s) => s.date < start).at(-1) : undefined;
    const baseline = before?.top ?? inPeriod[0].top;
    const best = Math.max(...inPeriod.map((s) => s.top));
    const comparable = before != null || inPeriod.length >= 2;
    const { name, area, groups } = info.get(id)!;
    list.push({
      id,
      name,
      group: groupOf(area, name),
      groups: groupsOf(area, name, groups),
      sessions: inPeriod.length,
      lastDate: inPeriod.at(-1)!.date,
      best,
      pct: comparable ? Math.round((best / baseline - 1) * 100) : null,
      series: [...(before ? [before.top] : []), ...inPeriod.slice(-8).map((s) => s.top)],
    });
  }
  return { start, list, byExercise };
}

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export function progressOverview(db: DB, memberId: number, period: Period, now = new Date()) {
  const { start, list } = trends(db, memberId, period, now);
  const from = start ?? '0000-00-00';
  const workouts = (
    db
      .prepare(
        `SELECT COUNT(*) n FROM workouts w WHERE w.member_id = ? AND w.solo = 0 AND w.date >= ?
           AND EXISTS (SELECT 1 FROM exercise_entries e WHERE e.workout_id = w.id)`,
      )
      .get(memberId, from) as { n: number }
  ).n;
  const records = (
    db
      .prepare(
        `SELECT x.name AS exercise, s.weight, s.reps, w.date FROM set_entries s JOIN exercise_entries e ON e.id = s.entry_id
         JOIN workouts w ON w.id = e.workout_id JOIN exercises x ON x.id = e.exercise_id
         WHERE w.member_id = ? AND s.is_pr = 1 AND s.weight > 0 AND w.date >= ?
         ORDER BY w.date DESC, s.weight DESC`,
      )
      .all(memberId, from) as { exercise: string; weight: number; reps: number; date: string }[]
  );
  // One record per exercise and day: the heaviest.
  const seen = new Set<string>();
  const recent = records.filter((r) => {
    const k = `${r.exercise}|${r.date}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const groups = GROUPS.map((g) => {
    const mine = list.filter((e) => e.groups.includes(g.id));
    return { id: g.id, label: g.label, exercises: mine.length, pct: avg(mine.map((e) => e.pct).filter((p): p is number => p != null)) };
  });
  return {
    period,
    workouts,
    streak: badges(db, memberId, now).streak,
    pct: avg(list.map((e) => e.pct).filter((p): p is number => p != null)),
    records: recent.length,
    groups,
    exercises: list.sort((a, b) => (b.pct ?? -1e9) - (a.pct ?? -1e9) || b.lastDate.localeCompare(a.lastDate)),
    recentRecords: recent.slice(0, 6),
  };
}

/** One muscle group: its change week by week (the average over its exercises), and its exercises. */
export function groupProgress(db: DB, memberId: number, group: string, period: Period, now = new Date()) {
  const label = GROUPS.find((g) => g.id === group)?.label;
  if (!label) return null;
  const { start, list, byExercise } = trends(db, memberId, period, now);
  const mine = list.filter((e) => e.groups.includes(group));
  const today = localDate(now.toISOString());
  const first = start ?? mine.map((e) => byExercise.get(e.id)![0].date).sort()[0] ?? today;
  // Points every week (or every few weeks over a long period), at most 12.
  const days = Math.max(7, (Date.parse(today) - Date.parse(first)) / DAY);
  const step = Math.ceil(days / 7 / 11) * 7;
  const points: string[] = [];
  for (let t = Date.parse(first); t < Date.parse(today); t += step * DAY) points.push(new Date(t).toISOString().slice(0, 10));
  points.push(today);
  const series = points
    .map((date) => {
      const gains: number[] = [];
      for (const e of mine) {
        const all = byExercise.get(e.id)!;
        const before = start ? all.filter((s) => s.date < start).at(-1) : undefined;
        const upTo = all.filter((s) => (!start || s.date >= start) && s.date <= date);
        if (!upTo.length) continue;
        const baseline = before?.top ?? upTo[0].top;
        gains.push(Math.max(...upTo.map((s) => s.top)) / baseline - 1);
      }
      return { date, pct: gains.length ? Math.round((gains.reduce((a, b) => a + b, 0) / gains.length) * 1000) / 10 : null };
    })
    .filter((p): p is { date: string; pct: number } => p.pct != null);
  return {
    id: group,
    label,
    period,
    pct: avg(mine.map((e) => e.pct).filter((p): p is number => p != null)),
    series,
    exercises: mine.sort((a, b) => (b.pct ?? -1e9) - (a.pct ?? -1e9)),
  };
}
