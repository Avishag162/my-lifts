// An injury or limitation you want to remember (shown in your profile). Stored only in the app.
import { type DB, nowIso } from './db.ts';
import { ValidationError } from './workouts.ts';

export const INJURY_MAX = 300;

/** Sets or clears (empty text) the injury note. */
export function setInjury(db: DB, memberId: number, text: unknown) {
  if (typeof text !== 'string') throw new ValidationError('טקסט לא תקין');
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, INJURY_MAX) || null;
  db.prepare('UPDATE members SET injury = ?, injury_at = ?, injury_by = ? WHERE id = ?').run(clean, nowIso(), memberId, memberId);
  return { injury: clean };
}

export function injuryOf(db: DB, memberId: number) {
  const r = db.prepare('SELECT injury, injury_at FROM members WHERE id = ?').get(memberId) as { injury: string | null; injury_at: string } | undefined;
  if (!r?.injury) return null;
  return { text: r.injury, at: r.injury_at, by: null };
}
