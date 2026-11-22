// Muscle groups, shared by the server ("my progress") and the coach's exercise editor.

/** Muscle groups as trainees know them; arms are split by what the exercise works. */
export const GROUPS: { id: string; label: string }[] = [
  { id: 'legs', label: 'רגליים' },
  { id: 'glutes', label: 'ישבן' },
  { id: 'back', label: 'גב' },
  { id: 'chest', label: 'חזה' },
  { id: 'shoulders', label: 'כתפיים' },
  { id: 'biceps', label: 'דו-ראשי' },
  { id: 'triceps', label: 'תלת-ראשי' },
  { id: 'core', label: 'ליבה' },
];
const IDS = new Set(GROUPS.map((g) => g.id));

/** The library's body area, with arms told apart by name: extensions, skull crushers and dips work the triceps. */
export function groupOf(area: string, name: string): string {
  if (area !== 'arms') return area;
  return /פשיטת|סקאל|מקבילים|דיפס|tricep|pushdown|skull|dip/i.test(name) ? 'triceps' : 'biceps';
}

/** Other groups a lift works a lot: a deadlift is back, legs and glutes. By name, so coaches' new
 * exercises are covered too. */
const ALSO: [string, RegExp][] = [
  ['glutes', /סקוואט|לאנג|ספליט|סטפ אפ|דדליפט|תראסטר|וול בול|קלין|סנאץ|גוד מורנינג|squat|lunge|deadlift|step.?up/i],
  ['legs', /דדליפט|גוד מורנינג|היפ תראסט|קטלבל סווינג|deadlift|good morning|hip thrust|swing/i],
  ['back', /דדליפט|קלין|סנאץ|פייס פול|רוורס פליי|גוד מורנינג|deadlift|clean|snatch|face pull/i],
  ['triceps', /לחיצת חזה|שכיבות סמיכה|לחיצת כתפיים|פוש פרס|פוש ג׳רק|לחיצת ארנולד|bench|push.?up|press|jerk/i],
  ['chest', /מקבילים|dip/i],
  ['shoulders', /תראסטר|וול בול|סנאץ|פוש ג׳רק|thruster|wall ball|snatch/i],
  ['biceps', /חתירה|מתח|פולי עליון|רנגייד|row|pull.?up|chin|pulldown/i],
];

/** The other groups guessed from the name, when the coach didn't choose them. */
export function guessedExtras(area: string, name: string): string[] {
  const main = groupOf(area, name);
  // Arm exercises (curls, extensions) stay in their own group only.
  if (area === 'arms' && main !== 'triceps') return [];
  return ALSO.filter(([g, re]) => g !== main && re.test(name) && !(g === 'triceps' && area === 'legs')).map(([g]) => g);
}

/** Parses the stored choice: NULL = not chosen (guess by name), '' = only the main group, else ids by commas. */
export function parseExtras(stored: string | null | undefined): string[] | null {
  if (stored == null) return null;
  return stored.split(',').filter((g) => IDS.has(g));
}

/** Every group an exercise counts for: its main one first, then the others it works (the coach's choice, else a guess). */
export function groupsOf(area: string, name: string, stored: string | null = null): string[] {
  const main = groupOf(area, name);
  const extras = parseExtras(stored) ?? guessedExtras(area, name);
  return [main, ...extras.filter((g) => g !== main)];
}
