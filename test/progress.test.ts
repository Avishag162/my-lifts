import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type DB } from '../src/server/db.ts';
import { seedLibrary, updateExercise } from '../src/server/library.ts';
import { searchLibrary } from '../src/server/workouts.ts';
import { groupOf, groupProgress, groupsOf, progressOverview } from '../src/server/progress.ts';

const NOW = new Date('2026-11-13T09:00:00Z');

describe('my progress', () => {
  let db: DB;
  const ex = (name: string) => (db.prepare('SELECT id FROM exercises WHERE name = ?').get(name) as { id: number }).id;
  function workout(memberId: number, date: string, items: [string, number][], pr = false) {
    const w = db.prepare("INSERT INTO workouts (member_id, date, created_at) VALUES (?, ?, datetime('now'))").run(memberId, date);
    for (const [name, kg] of items) {
      const e = db.prepare("INSERT INTO exercise_entries (workout_id, exercise_id, raw_name, created_at) VALUES (?, ?, ?, datetime('now'))").run(Number(w.lastInsertRowid), ex(name), name);
      db.prepare('INSERT INTO set_entries (entry_id, set_no, weight, reps, is_pr) VALUES (?, 1, ?, 5, ?)').run(Number(e.lastInsertRowid), kg, pr ? 1 : 0);
    }
  }
  let dana: number;
  beforeEach(() => {
    db = openDb(':memory:');
    seedLibrary(db);
    dana = Number(db.prepare("INSERT INTO members (name, phone, role) VALUES ('דנה', '+972500000001', 'trainee')").run().lastInsertRowid);
  });

  it('tells biceps from triceps', () => {
    expect(groupOf('arms', 'כפיפת מרפקים')).toBe('biceps');
    expect(groupOf('arms', 'פשיטת מרפקים בכבל')).toBe('triceps');
    expect(groupOf('arms', 'מקבילים')).toBe('triceps');
    expect(groupOf('legs', 'סקוואט עם מוט')).toBe('legs');
  });

  it('counts a lift in every group it works: a deadlift is back, legs and glutes', () => {
    expect(groupsOf('back', 'דדליפט')).toEqual(['back', 'glutes', 'legs']);
    expect(groupsOf('chest', 'לחיצת חזה')).toEqual(['chest', 'triceps']);
    expect(groupsOf('back', 'חתירה בהטיה')).toEqual(['back', 'biceps']);
    expect(groupsOf('arms', 'כפיפת מרפקים')).toEqual(['biceps']);
    workout(dana, '2026-11-12', [['דדליפט', 70]]);
    const m = progressOverview(db, dana, '3m', NOW);
    expect(m.groups.filter((g) => g.exercises > 0).map((g) => g.id)).toEqual(['legs', 'glutes', 'back']);
  });

  it("follows the coach's choice of muscle groups, else guesses by name", () => {
    workout(dana, '2026-11-12', [['סקוואט עם מוט', 60]]);
    const id = ex('סקוואט עם מוט');
    const base = { name: 'סקוואט עם מוט', bodyArea: 'legs', equipment: 'barbell', weightStep: 2.5, tracksWeight: true };
    // Same as the guess: nothing stored, so renaming still re-guesses.
    updateExercise(db, id, { ...base, muscleGroups: ['glutes'] });
    expect((db.prepare('SELECT muscle_groups FROM exercises WHERE id = ?').get(id) as any).muscle_groups).toBeNull();
    updateExercise(db, id, { ...base, muscleGroups: ['core', 'back', 'legs'] });
    expect(searchLibrary(db, 'סקוואט עם מוט', null)[0].muscleGroups).toEqual(['legs', 'back', 'core']);
    let m = progressOverview(db, dana, '3m', NOW);
    expect(m.groups.filter((g) => g.exercises > 0).map((g) => g.id)).toEqual(['legs', 'back', 'core']);
    // Only its main group.
    updateExercise(db, id, { ...base, muscleGroups: [] });
    m = progressOverview(db, dana, '3m', NOW);
    expect(m.groups.filter((g) => g.exercises > 0).map((g) => g.id)).toEqual(['legs']);
    // Saved without the field (an older screen): unchanged.
    updateExercise(db, id, base);
    expect(groupProgress(db, dana, 'glutes', '3m', NOW)!.exercises).toHaveLength(0);
  });

  it('measures the change from before the period, per exercise and per muscle group', () => {
    workout(dana, '2026-07-01', [['סקוואט עם מוט', 40], ['לחיצת חזה', 30]]);
    workout(dana, '2026-09-01', [['סקוואט עם מוט', 50], ['לחיצת חזה', 30], ['כפיפת מרפקים', 10]]);
    workout(dana, '2026-11-01', [['סקוואט עם מוט', 60], ['לחיצת חזה', 33], ['כפיפת מרפקים', 12]], true);
    const m = progressOverview(db, dana, 'month', NOW);
    expect(m.workouts).toBe(1);
    expect(m.records).toBe(3);
    expect(m.exercises.map((e) => [e.name, e.pct, e.series])).toEqual([
      ['סקוואט עם מוט', 20, [50, 60]],
      ['כפיפת מרפקים', 20, [10, 12]],
      ['לחיצת חזה', 10, [30, 33]],
    ]);
    expect(m.groups.find((g) => g.id === 'biceps')).toMatchObject({ label: 'דו-ראשי', pct: 20 });
    expect(m.groups.find((g) => g.id === 'triceps')).toMatchObject({ exercises: 1, pct: 10 }); // the bench press
    expect(m.groups.find((g) => g.id === 'core')).toMatchObject({ exercises: 0, pct: null });
    const all = progressOverview(db, dana, 'all', NOW);
    expect(all.exercises.find((e) => e.name === 'סקוואט עם מוט')?.pct).toBe(50);
    const legs = groupProgress(db, dana, 'legs', 'all', NOW)!;
    expect(legs.pct).toBe(50);
    expect(legs.series.at(-1)?.pct).toBe(50);
    expect(legs.series[0].pct).toBe(0);
    expect(groupProgress(db, dana, 'nope', 'all', NOW)).toBeNull();
  });
});
