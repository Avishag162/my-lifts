// Trainee-side logic: today's classes, logging sets, history and the exercise library.
import { randomUUID } from 'node:crypto';
import { type DB, nowIso, tx } from './db.ts';
import { TIME_ZONE, localTimeToIso } from './time.ts';
import { AREA_LABELS } from './library.ts';
import { normalizeName } from './matching.ts';
import { groupsOf } from '../shared/muscles.ts';
import { type Feel, type SetEntry, isPersonalRecord, recommendedWeight, strength } from './rules.ts';

export interface ExerciseInfo {
  id: number;
  name: string;
  bodyArea: string;
  bodyAreaLabel: string;
  equipment: string;
  weightStep: number;
  tracksWeight: boolean;
  imageUrl: string | null;
  videoUrl: string | null;
  /** Technique cues, one per item (empty when there are none). */
  cues: string[];
  /** Every muscle group it counts for, main first (a deadlift: back, glutes, legs). */
  muscleGroups: string[];
}

export interface WorkoutItem {
  key: string; // "line:<classExerciseId>" or "extra:<entryId>"
  classExerciseId: number | null;
  rawName: string;
  exercise: ExerciseInfo | null; // null while the coach hasn't confirmed an unknown name
  prescribed: { sets: number | null; reps: number | null; repsText: string | null; section: string | null };
  last: { date: string; sets: SetEntry[]; feel: Feel | null } | null;
  target: { sets: number | null; reps: number | null; repsText: string | null; weight: number | null } | null;
  logged: { entryId: number; sets: (SetEntry & { isPr: boolean })[]; feel: Feel | null; note: string | null } | null;
}

export interface ClassSummary {
  id: number;
  classType: string;
  startsAt: string;
  hasWorkout: boolean;
}

export function splitCues(text: string | null | undefined): string[] {
  return (text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
}

function exerciseRow(db: DB, id: number): ExerciseInfo | null {
  const r = db.prepare('SELECT * FROM exercises WHERE id = ?').get(id) as any;
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    bodyArea: r.body_area,
    bodyAreaLabel: AREA_LABELS[r.body_area] ?? r.body_area,
    equipment: r.equipment,
    weightStep: r.weight_step,
    tracksWeight: !!r.tracks_weight,
    imageUrl: r.image_url,
    videoUrl: r.video_url,
    cues: splitCues(r.cues),
    muscleGroups: groupsOf(r.body_area, r.name, r.muscle_groups),
  };
}

export function localDate(iso: string, timeZone = TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(iso),
  );
}

/** A workout the trainee did on their own, outside the studio's classes. */
export const SOLO_CLASS_TYPE = 'אימון';
/** How far back a workout done on one's own can be entered. */
export const SOLO_MAX_DAYS_BACK = 365;

/**
 * Opens a workout the trainee did on their own on a day (today or up to a month back), to log like a class:
 * exercises from the library, sets and weights. An empty one already opened for that day is reused.
 */
export function createSoloWorkout(db: DB, memberId: number, date: string, now = new Date()): number {
  const today = localDate(now.toISOString());
  const earliest = localDate(new Date(now.getTime() - SOLO_MAX_DAYS_BACK * 86_400_000).toISOString());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || date > today || date < earliest)
    throw new ValidationError(`אפשר לרשום אימון מהיום ועד ${SOLO_MAX_DAYS_BACK} יום אחורה`);
  const startsAt = localTimeToIso(date, '12:00');
  const empty = db
    .prepare(
      `SELECT c.id FROM classes c JOIN attendance a ON a.class_id = c.id
       WHERE c.class_type = ? AND a.member_id = ? AND c.starts_at = ?
         AND NOT EXISTS (SELECT 1 FROM workouts w WHERE w.class_id = c.id) LIMIT 1`,
    )
    .get(SOLO_CLASS_TYPE, memberId, startsAt) as { id: number } | undefined;
  if (empty) {
    db.prepare('UPDATE classes SET synced_at = ? WHERE id = ?').run(nowIso(), empty.id);
    return empty.id;
  }
  return tx(db, () => {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO classes (ref, class_type, starts_at, synced_at) VALUES (?, ?, ?, ?)')
      .run(`solo:${randomUUID()}`, SOLO_CLASS_TYPE, startsAt, nowIso());
    const id = Number(lastInsertRowid);
    db.prepare('INSERT INTO attendance (class_id, member_id, attended) VALUES (?, ?, 1)').run(id, memberId);
    return id;
  });
}

/** How far back results can still be logged or changed: a trainee in the app, and a coach or the owner from the trainee's file. */
export const TRAINEE_EDIT_DAYS = 60;
export const COACH_EDIT_DAYS = 30;

/** Relevant classes the member was registered to in the last few days, newest first. */
export function recentClasses(db: DB, memberId: number, now = new Date(), days = TRAINEE_EDIT_DAYS): ClassSummary[] {
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  const types: string[] = [];
  const rows = db
    .prepare(
      `SELECT c.id, c.class_type, c.starts_at, (SELECT COUNT(*) FROM class_exercises ce WHERE ce.class_id = c.id) AS n
       FROM classes c JOIN attendance a ON a.class_id = c.id
       WHERE a.member_id = ? AND (a.attended IS NULL OR a.attended = 1)
         AND ((c.starts_at >= ? AND c.starts_at <= ? AND c.class_type IN (SELECT value FROM json_each(?)))
           -- A workout on one's own shows while it's being entered, even for a day further back.
           OR (c.class_type = ? AND c.synced_at >= ?))
       ORDER BY c.starts_at DESC`,
    )
    .all(memberId, from.toISOString(), endOfDay(now).toISOString(), JSON.stringify(types), SOLO_CLASS_TYPE, from.toISOString()) as any[];
  return rows.map((r) => ({ id: r.id, classType: r.class_type, startsAt: r.starts_at, hasWorkout: r.n > 0 }));
}

function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}

function setsForEntry(db: DB, entryId: number): (SetEntry & { isPr: boolean })[] {
  return (
    db.prepare('SELECT weight, reps, is_pr FROM set_entries WHERE entry_id = ? ORDER BY set_no').all(entryId) as any[]
  ).map((s) => ({ weight: s.weight, reps: s.reps, isPr: !!s.is_pr }));
}

/** The member's most recent earlier log of an exercise (by library id, or by raw name if unconfirmed). */
function lastPerformance(db: DB, memberId: number, exerciseId: number | null, rawName: string, excludeWorkoutId: number | null) {
  const row = db
    .prepare(
      `SELECT e.id, e.feel, e.target_reps, w.date FROM exercise_entries e JOIN workouts w ON w.id = e.workout_id
       WHERE w.member_id = ? AND ${exerciseId != null ? 'e.exercise_id = ?' : '(e.exercise_id IS NULL AND e.raw_name = ?)'}
         AND (? IS NULL OR w.id != ?)
       ORDER BY w.date DESC, e.id DESC LIMIT 1`,
    )
    .get(memberId, exerciseId ?? rawName, excludeWorkoutId, excludeWorkoutId) as any;
  if (!row) return null;
  return {
    date: row.date as string,
    sets: setsForEntry(db, row.id).map(({ weight, reps }) => ({ weight, reps })),
    feel: (row.feel as Feel | null) ?? null,
    targetReps: row.target_reps as number | null,
  };
}

type BuildArgs = [
  key: string,
  classExerciseId: number | null,
  rawName: string,
  exerciseId: number | null,
  sets: number | null,
  reps: number | null,
  entry: any | undefined,
  repsText?: string | null,
  section?: string | null,
];

function buildItem(
  db: DB,
  memberId: number,
  workoutId: number | null,
  key: string,
  classExerciseId: number | null,
  rawName: string,
  exerciseId: number | null,
  sets: number | null,
  reps: number | null,
  entry: any | undefined,
  repsText: string | null = null,
  section: string | null = null,
): WorkoutItem {
  const exercise = exerciseId != null ? exerciseRow(db, exerciseId) : null;
  // Unknown names: no picture and no comparison with last time, until the coach answers.
  const last = exercise ? lastPerformance(db, memberId, exercise.id, rawName, workoutId) : null;
  let target: WorkoutItem['target'] = null;
  if (exercise) {
    const weight = exercise.tracksWeight ? recommendedWeight(last, exercise.weightStep, reps) : null;
    target = { sets: sets ?? last?.sets.length ?? null, reps: reps ?? null, repsText: repsText ?? (reps != null ? String(reps) : null), weight };
  }
  return {
    key,
    classExerciseId,
    rawName,
    exercise,
    prescribed: { sets, reps, repsText: repsText ?? (reps != null ? String(reps) : null), section },
    last: last ? { date: last.date, sets: last.sets, feel: last.feel } : null,
    target,
    logged: entry
      ? { entryId: entry.id, sets: setsForEntry(db, entry.id), feel: entry.feel, note: entry.note }
      : null,
  };
}

/**
 * An exercise the member is about to add from the library (always so in a workout on one's own):
 * last time and a recommended weight, as for the coach's lines, before anything is saved.
 */
export function addedExerciseItem(db: DB, memberId: number, classId: number, exerciseId: number): WorkoutItem | null {
  const ex = exerciseRow(db, exerciseId);
  if (!ex || !db.prepare('SELECT 1 FROM attendance WHERE class_id = ? AND member_id = ?').get(classId, memberId)) return null;
  const workout = db.prepare('SELECT id FROM workouts WHERE member_id = ? AND class_id = ?').get(memberId, classId) as
    | { id: number }
    | undefined;
  return buildItem(db, memberId, workout?.id ?? null, `new:${exerciseId}`, null, ex.name, exerciseId, null, null, undefined);
}

export function getClassWorkout(db: DB, memberId: number, classId: number) {
  const cls = db
    .prepare(
      `SELECT c.id, c.class_type, c.starts_at FROM classes c JOIN attendance a ON a.class_id = c.id
       WHERE c.id = ? AND a.member_id = ?`,
    )
    .get(classId, memberId) as any;
  if (!cls) return null;
  const workout = db.prepare('SELECT id FROM workouts WHERE member_id = ? AND class_id = ?').get(memberId, classId) as
    | { id: number }
    | undefined;
  const workoutId = workout?.id ?? null;

  const lines = db
    .prepare('SELECT id, raw_name, exercise_id, sets, reps, reps_text, section FROM class_exercises WHERE class_id = ? ORDER BY line_no')
    .all(classId) as any[];
  const entries = workoutId
    ? (db.prepare('SELECT * FROM exercise_entries WHERE workout_id = ? ORDER BY id').all(workoutId) as any[])
    : [];

  const build = (...args: BuildArgs) => buildItem(db, memberId, workoutId, ...args);

  const items: WorkoutItem[] = lines.map((l) =>
    build(
      `line:${l.id}`,
      l.id,
      l.raw_name,
      l.exercise_id,
      l.sets,
      l.reps,
      entries.find((e) => e.class_exercise_id === l.id),
      l.reps_text,
      l.section,
    ),
  );
  for (const e of entries.filter((e) => e.class_exercise_id == null)) {
    items.push(build(`extra:${e.id}`, null, e.raw_name, e.exercise_id, null, null, e));
  }
  return {
    class: { id: cls.id, classType: cls.class_type, startsAt: cls.starts_at },
    items,
  };
}

export interface SaveEntryInput {
  classExerciseId?: number | null;
  exerciseId?: number | null; // for an exercise the trainee added from the library
  sets: { weight: number | null; reps: number }[];
  feel?: Feel | null;
  note?: string | null;
}

export class ValidationError extends Error {}

const FEELS: Feel[] = ['easy', 'challenging', 'very_hard'];

/** `enteredBy`: the coach who entered it for the trainee, if not the trainee. */
export function saveEntry(db: DB, memberId: number, classId: number, input: SaveEntryInput, enteredBy: number | null = null) {
  if (!Array.isArray(input.sets) || input.sets.length < 1 || input.sets.length > 20)
    throw new ValidationError('צריך בין סט אחד ל-20 סטים');
  for (const s of input.sets) {
    if (!Number.isInteger(s.reps) || s.reps < 1 || s.reps > 200) throw new ValidationError('מספר חזרות לא תקין');
    if (s.weight != null && (typeof s.weight !== 'number' || !(s.weight >= 0) || s.weight > 500))
      throw new ValidationError('משקל לא תקין');
  }
  if (input.feel != null && !FEELS.includes(input.feel)) throw new ValidationError('דירוג לא תקין');
  const note = input.note?.trim().slice(0, 1000) || null;

  const cls = db
    .prepare('SELECT c.id, c.starts_at, c.class_type FROM classes c JOIN attendance a ON a.class_id = c.id WHERE c.id = ? AND a.member_id = ?')
    .get(classId, memberId) as any;
  if (!cls) throw new ValidationError('השיעור לא נמצא');

  let rawName: string;
  let exerciseId: number | null;
  let targetReps: number | null = null;
  let classExerciseId: number | null = null;
  if (input.classExerciseId != null) {
    const line = db
      .prepare('SELECT id, raw_name, exercise_id, reps FROM class_exercises WHERE id = ? AND class_id = ?')
      .get(input.classExerciseId, classId) as any;
    if (!line) throw new ValidationError('התרגיל לא שייך לשיעור');
    rawName = line.raw_name;
    exerciseId = line.exercise_id;
    targetReps = line.reps;
    classExerciseId = line.id;
  } else if (input.exerciseId != null) {
    const ex = exerciseRow(db, input.exerciseId);
    if (!ex) throw new ValidationError('התרגיל לא נמצא בספרייה');
    rawName = ex.name;
    exerciseId = ex.id;
  } else {
    throw new ValidationError('חסר תרגיל');
  }

  return tx(db, () => {
    db.prepare('INSERT OR IGNORE INTO workouts (member_id, class_id, date, created_at, solo) VALUES (?, ?, ?, ?, ?)').run(
      memberId,
      classId,
      localDate(cls.starts_at),
      nowIso(),
      0, // personal edition: every workout counts (streaks, badges, monthly summary)
    );
    const workoutId = (
      db.prepare('SELECT id FROM workouts WHERE member_id = ? AND class_id = ?').get(memberId, classId) as { id: number }
    ).id;

    // Saving the same exercise again replaces the earlier log.
    const existing = db
      .prepare(
        classExerciseId != null
          ? 'SELECT id FROM exercise_entries WHERE workout_id = ? AND class_exercise_id = ?'
          : 'SELECT id FROM exercise_entries WHERE workout_id = ? AND class_exercise_id IS NULL AND exercise_id = ?',
      )
      .get(workoutId, classExerciseId ?? exerciseId) as { id: number } | undefined;
    if (existing) db.prepare('DELETE FROM exercise_entries WHERE id = ?').run(existing.id);

    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO exercise_entries (workout_id, exercise_id, raw_name, class_exercise_id, target_reps, feel, note, created_at, entered_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(workoutId, exerciseId, rawName, classExerciseId, targetReps, input.feel ?? null, note, nowIso(), enteredBy);
    const entryId = Number(lastInsertRowid);

    // Personal records are compared against everything logged before, for library exercises only.
    const history: SetEntry[] =
      exerciseId != null
        ? (db
            .prepare(
              `SELECT s.weight, s.reps FROM set_entries s JOIN exercise_entries e ON e.id = s.entry_id
               JOIN workouts w ON w.id = e.workout_id WHERE w.member_id = ? AND e.exercise_id = ? AND e.id != ?`,
            )
            .all(memberId, exerciseId, entryId) as any[])
        : [];
    const ins = db.prepare('INSERT INTO set_entries (entry_id, set_no, weight, reps, is_pr) VALUES (?, ?, ?, ?, ?)');
    const prs: number[] = [];
    const sofar = [...history];
    input.sets.forEach((s, i) => {
      // The first time an exercise is logged sets a baseline; it isn't a "new record".
      const pr = history.length > 0 && isPersonalRecord(s, sofar);
      if (pr) prs.push(i + 1);
      ins.run(entryId, i + 1, s.weight, s.reps, pr ? 1 : 0);
      sofar.push(s);
    });
    return { entryId, workoutId, prSets: prs };
  });
}

/**
 * Deletes one logged exercise of a trainee's class (logged by mistake). An exercise the trainee added is gone;
 * a line of the coach's workout stays in the class, just unlogged. A workout left empty goes too.
 */
export function deleteEntry(db: DB, memberId: number, classId: number, entryId: number) {
  const row = db
    .prepare(
      `SELECT e.id, e.workout_id FROM exercise_entries e JOIN workouts w ON w.id = e.workout_id
       WHERE e.id = ? AND w.member_id = ? AND w.class_id = ?`,
    )
    .get(entryId, memberId, classId) as { id: number; workout_id: number } | undefined;
  if (!row) throw new ValidationError('התרגיל לא נמצא');
  tx(db, () => {
    db.prepare('DELETE FROM exercise_entries WHERE id = ?').run(row.id);
    if (!db.prepare('SELECT 1 FROM exercise_entries WHERE workout_id = ?').get(row.workout_id))
      db.prepare('DELETE FROM workouts WHERE id = ?').run(row.workout_id);
  });
}

export function history(db: DB, memberId: number) {
  const workouts = db
    .prepare(
      `SELECT w.id, w.date, c.class_type FROM workouts w LEFT JOIN classes c ON c.id = w.class_id
       WHERE w.member_id = ? ORDER BY w.date DESC, w.id DESC LIMIT 200`,
    )
    .all(memberId) as any[];
  return workouts.map((w) => {
    const entries = db
      .prepare(
        `SELECT e.id, e.raw_name, e.feel, x.name AS ex_name FROM exercise_entries e LEFT JOIN exercises x ON x.id = e.exercise_id
         WHERE e.workout_id = ? ORDER BY e.id`,
      )
      .all(w.id) as any[];
    const exercises = entries.map((e) => ({ name: e.ex_name ?? e.raw_name, feel: e.feel, sets: setsForEntry(db, e.id) }));
    const totalKg = exercises.reduce((t, e) => t + e.sets.reduce((s, x) => s + (x.weight ?? 0) * x.reps, 0), 0);
    return {
      id: w.id,
      date: w.date,
      classType: w.class_type,
      exercises,
      totalKg,
      prCount: exercises.reduce((n, e) => n + e.sets.filter((s) => s.isPr).length, 0),
    };
  });
}

// ---------- Progress per exercise ----------

export interface ProgressSession {
  date: string;
  classType: string | null;
  sets: (SetEntry & { isPr: boolean })[];
  feel: Feel | null;
  topWeight: number | null; // heaviest set
  estimated1RM: number | null; // strongest set, so more reps at the same weight shows as progress
  volume: number; // kg × reps
}

/** Every library exercise the member logged, most recent first. */
export function myExercises(db: DB, memberId: number) {
  const rows = db
    .prepare(
      `SELECT e.exercise_id AS id, MAX(w.date) AS last_date, COUNT(DISTINCT e.id) AS sessions, MAX(s.weight) AS best_weight
       FROM exercise_entries e JOIN workouts w ON w.id = e.workout_id LEFT JOIN set_entries s ON s.entry_id = e.id
       WHERE w.member_id = ? AND e.exercise_id IS NOT NULL
       GROUP BY e.exercise_id ORDER BY last_date DESC`,
    )
    .all(memberId) as any[];
  return rows.map((r) => ({
    exercise: exerciseRow(db, r.id)!,
    lastDate: r.last_date as string,
    sessions: r.sessions as number,
    bestWeight: r.best_weight as number | null,
  }));
}

/** Full history of one exercise for the member, oldest first, with records and the change in strength. */
export function exerciseProgress(db: DB, memberId: number, exerciseId: number) {
  const exercise = exerciseRow(db, exerciseId);
  if (!exercise) return null;
  const entries = db
    .prepare(
      `SELECT e.id, e.feel, w.date, c.class_type FROM exercise_entries e JOIN workouts w ON w.id = e.workout_id
       LEFT JOIN classes c ON c.id = w.class_id
       WHERE w.member_id = ? AND e.exercise_id = ? ORDER BY w.date, e.id`,
    )
    .all(memberId, exerciseId) as any[];
  const sessions: ProgressSession[] = entries.map((e) => {
    const sets = setsForEntry(db, e.id);
    const weights = sets.map((x) => x.weight).filter((w): w is number => w != null && w > 0);
    const strongest = Math.max(0, ...sets.map((x) => strength(x)));
    return {
      date: e.date,
      classType: e.class_type ?? null,
      sets,
      feel: e.feel ?? null,
      topWeight: weights.length ? Math.max(...weights) : null,
      estimated1RM: strongest > 0 ? Math.round(strongest * 2) / 2 : null,
      volume: Math.round(sets.reduce((t, x) => t + (x.weight ?? 0) * x.reps, 0)),
    };
  });
  // Best set: heaviest weight, and the most reps at that weight.
  let best: { weight: number; reps: number; date: string } | null = null;
  let mostReps: { reps: number; date: string } | null = null;
  for (const s of sessions)
    for (const x of s.sets) {
      if (x.weight != null && x.weight > 0 && (!best || x.weight > best.weight || (x.weight === best.weight && x.reps > best.reps)))
        best = { weight: x.weight, reps: x.reps, date: s.date };
      if (!mostReps || x.reps > mostReps.reps) mostReps = { reps: x.reps, date: s.date };
    }
  const strengths = sessions.map((s) => s.estimated1RM).filter((v): v is number => v != null);
  return {
    exercise,
    sessions,
    best,
    mostReps,
    best1RM: strengths.length ? Math.max(...strengths) : null,
    first1RM: strengths.length ? strengths[0] : null,
    last1RM: strengths.length ? strengths[strengths.length - 1] : null,
  };
}

export function searchLibrary(db: DB, q: string, area: string | null): ExerciseInfo[] {
  const rows = db.prepare('SELECT id FROM exercises ORDER BY name').all() as { id: number }[];
  const all = rows.map((r) => exerciseRow(db, r.id)!);
  const query = normalizeName(q);
  const aliasHits = new Set(
    query
      ? (db.prepare('SELECT exercise_id, alias_key FROM exercise_aliases').all() as any[])
          .filter((a) => a.alias_key.includes(query))
          .map((a) => a.exercise_id as number)
      : [],
  );
  return all.filter(
    (e) => (!area || e.bodyArea === area) && (!query || normalizeName(e.name).includes(query) || aliasHits.has(e.id)),
  );
}
