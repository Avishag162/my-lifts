export class ApiError extends Error {
  constructor(public status: number, message: string, public data: any = {}) {
    super(message);
  }
}

/** The in-browser version (vite --mode device): no server, everything is stored on this device. */
export const IS_LOCAL = import.meta.env.MODE === 'device';

export async function api<T = any>(path: string, body?: unknown): Promise<T> {
  const init: RequestInit = {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  };
  const res = IS_LOCAL ? await (await import('./local/server.ts')).localFetch(path, init) : await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'משהו השתבש', data);
  return data as T;
}

export type Feel = 'easy' | 'challenging' | 'very_hard';
export interface SetEntry { weight: number | null; reps: number; isPr?: boolean }
export interface Exercise {
  id: number; name: string; bodyArea: string; bodyAreaLabel: string; equipment: string;
  weightStep: number; tracksWeight: boolean; imageUrl: string | null; videoUrl: string | null;
  cues: string[];
  /** Every muscle group it counts for, main first. */
  muscleGroups?: string[];
}
export interface WorkoutItem {
  key: string;
  classExerciseId: number | null;
  rawName: string;
  exercise: Exercise | null;
  prescribed: { sets: number | null; reps: number | null; repsText: string | null; section: string | null };
  last: { date: string; sets: SetEntry[]; feel: Feel | null } | null;
  target: { sets: number | null; reps: number | null; repsText: string | null; weight: number | null } | null;
  logged: { entryId: number; sets: SetEntry[]; feel: Feel | null; note: string | null } | null;
}
export interface ClassSummary { id: number; classType: string; startsAt: string; hasWorkout: boolean }
export interface Me { id: number; name: string; firstName: string; role: string; onboarded: boolean; injury?: { text: string; at: string; by: string | null } | null; gender?: 'f' | 'm' | null; bodyweight?: number | null; birthday?: string | null }
