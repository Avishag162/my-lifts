// Calculation rules from the spec ("כללי חישוב"). Thresholds are defaults and live in settings.

export type Feel = 'easy' | 'challenging' | 'very_hard';

export interface SetEntry {
  weight: number | null; // null for bodyweight exercises
  reps: number;
}

export interface PastPerformance {
  sets: SetEntry[];
  feel: Feel | null;
  targetReps: number | null; // what the coach prescribed that time
}

/**
 * Recommended working weight for today.
 * Same reps as last time: if every set reached the reps and it wasn't "very hard", add one weight step,
 * otherwise keep the weight.
 * Different reps today (for a range like 8–10, the low end): take the strongest set from last time as an estimated one-rep max and convert it
 * to today's reps (e.g. 3×10 at 30 kg ≈ 40 kg max, so 5 reps ≈ 35 kg). Rounded to the exercise's step.
 */
export function recommendedWeight(last: PastPerformance | null, weightStep: number, todayReps: number | null = null): number | null {
  if (!last || last.sets.length === 0) return null;
  const weighted = last.sets.filter((s): s is SetEntry & { weight: number } => s.weight != null && s.weight > 0);
  if (weighted.length === 0) return null;
  const working = Math.max(...weighted.map((s) => s.weight));
  const lastReps = last.targetReps ?? Math.max(...last.sets.map((s) => s.reps));
  if (todayReps == null || todayReps === lastReps) {
    const allReps = last.sets.every((s) => s.reps >= lastReps);
    if (allReps && last.feel !== 'very_hard') return round(working + weightStep);
    return working;
  }
  const max = Math.max(...weighted.map((s) => strength(s)));
  const w = todayReps <= 1 ? max : max / (1 + todayReps / 30);
  return Math.max(weightStep, round(Math.round(w / weightStep) * weightStep));
}

/**
 * Strength of a set as an estimated one-rep max (Epley), so sets with different reps can be compared:
 * 40 kg × 10 is stronger than 40 kg × 8 even though the weight didn't change. Reps above 15 count as 15.
 */
export function strength(set: SetEntry): number {
  if (set.weight == null || set.weight <= 0 || set.reps < 1) return 0;
  const reps = Math.min(set.reps, 15);
  return reps === 1 ? set.weight : round(set.weight * (1 + reps / 30));
}

/** A set is a personal record if no earlier set had the same or higher weight with the same or more reps. */
export function isPersonalRecord(set: SetEntry, history: SetEntry[]): boolean {
  if (set.weight == null || set.weight <= 0) return false;
  return !history.some((h) => h.weight != null && h.weight >= set.weight! && h.reps >= set.reps);
}

/** Epley estimated one-rep max, only for sets of up to 10 reps. */
export function estimatedOneRepMax(set: SetEntry): number | null {
  if (set.weight == null || set.reps < 1 || set.reps > 10) return null;
  if (set.reps === 1) return set.weight;
  return round(set.weight * (1 + set.reps / 30));
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
