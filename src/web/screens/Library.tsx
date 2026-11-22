import { useEffect, useState } from 'react';
import { ApiError, api, type Exercise } from '../api.ts';
import { ExerciseIcon } from '../icons.tsx';

export function LibrarySheet({ onPick, onClose }: { onPick: (exerciseId: number) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [area, setArea] = useState<string | null>(null);
  const [areas, setAreas] = useState<Record<string, string>>({});
  const [list, setList] = useState<Exercise[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (area) params.set('area', area);
      api<{ areas: Record<string, string>; exercises: Exercise[] }>(`/api/exercises?${params}`).then((r) => {
        setAreas(r.areas);
        setList(r.exercises);
      });
    }, 150);
    return () => clearTimeout(t);
  }, [q, area]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="הוספת תרגיל מהספרייה" onClick={(e) => e.stopPropagation()}>
        <div className="header">
          <h2 className="h2">הוספת תרגיל</h2>
          <button className="btn-ghost" onClick={onClose}>
            סגירה
          </button>
        </div>
        <input
          className="input"
          style={{ fontSize: 16, height: 46 }}
          placeholder="חיפוש תרגיל"
          aria-label="חיפוש תרגיל"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <div className="chips" role="group" aria-label="סינון לפי אזור בגוף">
          <button className="chip" aria-pressed={area === null} onClick={() => setArea(null)}>
            הכול
          </button>
          {Object.entries(areas).map(([k, label]) => (
            <button key={k} className="chip" aria-pressed={area === k} onClick={() => setArea(area === k ? null : k)}>
              {label}
            </button>
          ))}
        </div>
        <div className="sheet-list">
          {list.map((e) => (
            <button key={e.id} className="lib-item" onClick={() => onPick(e.id)}>
              <span className="ex-pic">
                {e.imageUrl ? <img src={e.imageUrl} alt="" /> : <ExerciseIcon area={e.bodyArea} size={32} />}
              </span>
              <span style={{ flex: 1 }}>
                <b style={{ display: 'block' }}>{e.name}</b>
                <span className="muted">{e.bodyAreaLabel}</span>
              </span>
            </button>
          ))}
          {list.length === 0 && <div className="muted">לא נמצא תרגיל בשם הזה.</div>}
        </div>
        <NewExercise name={q} areas={areas} defaultArea={area} onPick={onPick} />
      </div>
    </div>
  );
}

const EQUIPMENT: [string, string, number][] = [
  ['barbell', 'מוט', 2.5],
  ['dumbbell', 'משקולות יד', 1],
  ['kettlebell', 'קטלבל', 4],
  ['machine', 'מכונה', 5],
  ['cable', 'כבל', 2.5],
  ['ball', 'כדור', 1],
  ['bodyweight', 'משקל גוף', 1],
];

/** Adds your own exercise to the library, then picks it. */
function NewExercise({ name: initial, areas, defaultArea, onPick }: { name: string; areas: Record<string, string>; defaultArea: string | null; onPick: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial);
  const [area, setArea] = useState(defaultArea ?? 'legs');
  const [equipment, setEquipment] = useState('barbell');
  const [error, setError] = useState<string | null>(null);
  const [similar, setSimilar] = useState<{ id: number; name: string }[]>([]);
  const [busy, setBusy] = useState(false);

  async function save(confirmNew = false) {
    setBusy(true);
    setError(null);
    const step = EQUIPMENT.find(([k]) => k === equipment)?.[2] ?? 2.5;
    try {
      const r = await api<{ id: number }>('/api/exercises', {
        name: name.trim(),
        bodyArea: area,
        equipment,
        weightStep: step,
        tracksWeight: equipment !== 'bodyweight',
        confirmNew,
      });
      onPick(r.id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setSimilar(e.data.exact ? [e.data.exact] : e.data.similar ?? []);
        setError(e.message);
      } else setError(e instanceof Error ? e.message : 'משהו השתבש');
    } finally {
      setBusy(false);
    }
  }

  if (!open)
    return (
      <button className="btn-dashed" onClick={() => { setName(initial); setOpen(true); }}>
        + תרגיל חדש משלי{initial.trim() ? `: ${initial.trim()}` : ''}
      </button>
    );
  return (
    <div className="card" style={{ gap: 8 }}>
      <b>תרגיל חדש</b>
      <input className="input" style={{ height: 44 }} aria-label="שם התרגיל" placeholder="שם התרגיל" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="chips" role="group" aria-label="אזור בגוף">
        {Object.entries(areas).map(([k, label]) => (
          <button key={k} className="chip" aria-pressed={area === k} onClick={() => setArea(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="chips" role="group" aria-label="ציוד">
        {EQUIPMENT.map(([k, label]) => (
          <button key={k} className="chip" aria-pressed={equipment === k} onClick={() => setEquipment(k)}>
            {label}
          </button>
        ))}
      </div>
      {error && <div className="error">{error}</div>}
      {similar.length > 0 && (
        <div className="chips">
          {similar.map((x) => (
            <button key={x.id} className="chip" onClick={() => onPick(x.id)}>
              {x.name}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" disabled={busy || !name.trim()} onClick={() => save(similar.length > 0 && !error?.startsWith('התרגיל כבר קיים'))}>
          {similar.length > 0 && !error?.startsWith('התרגיל כבר קיים') ? 'להוסיף בכל זאת' : 'הוספה'}
        </button>
        <button className="btn-ghost" onClick={() => setOpen(false)}>
          ביטול
        </button>
      </div>
    </div>
  );
}
