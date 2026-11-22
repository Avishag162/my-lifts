import { useEffect, useState } from 'react';
import { api, type Feel, type SetEntry } from '../api.ts';
import { fmtKg } from './Log.tsx';

interface HistoryWorkout {
  id: number;
  date: string;
  classType: string | null;
  totalKg: number;
  prCount: number;
  exercises: { name: string; feel: Feel | null; sets: SetEntry[] }[];
}

const FEEL: Record<Feel, string> = { easy: 'קל', challenging: 'מאתגר', very_hard: 'קשה מאוד' };

function fmtDay(date: string): string {
  const d = new Date(date + 'T12:00:00');
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' });
}

/** Every workout logged, newest first. */
export function WorkoutLog({ onBack }: { onBack: () => void }) {
  const [list, setList] = useState<HistoryWorkout[] | null>(null);
  useEffect(() => {
    api<HistoryWorkout[]>('/api/history').then(setList);
  }, []);
  return (
    <div className="page">
      <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={onBack}>
        › ההתקדמות שלי
      </button>
      <h1 className="h1">יומן אימונים</h1>
      {list?.length === 0 && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>עוד לא נרשמו אימונים. אחרי האימון הראשון הוא יופיע כאן.</p>
        </div>
      )}
      {list?.map((w) => (
        <div key={w.id} className="card" style={{ gap: 6 }}>
          <div className="header">
            <div>
              <div className="eyebrow">{w.classType}</div>
              <h2 className="h2">{fmtDay(w.date)}</h2>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 800 }}>{Math.round(w.totalKg).toLocaleString('he-IL')} ק״ג</div>
              {w.prCount > 0 && <div style={{ color: 'var(--ok)', fontSize: 13, fontWeight: 700 }}>★ {w.prCount} שיאים</div>}
            </div>
          </div>
          {w.exercises.map((e, i) => (
            <div key={i} className="hist-ex">
              <span>
                {e.name}
                {e.feel && <span className="muted"> · {FEEL[e.feel]}</span>}
              </span>
              <span dir="ltr" style={{ fontWeight: 700 }}>
                {e.sets.map((s) => (s.weight != null ? `${fmtKg(s.weight)}×${s.reps}` : `${s.reps}`)).join('  ')}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
