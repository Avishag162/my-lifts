import { useEffect, useState } from 'react';
import { Cues } from '../Cues.tsx';
import { api, type Exercise as ExerciseInfo, type Feel, type SetEntry } from '../api.ts';
import { LineChart } from '../Chart.tsx';
import { fmtDay } from '../dates.ts';
import { ExerciseIcon } from '../icons.tsx';
import { fmtKg } from './Log.tsx';
import { asset } from '../asset.ts';

interface MyExercise {
  exercise: ExerciseInfo;
  lastDate: string;
  sessions: number;
  bestWeight: number | null;
}

interface Session {
  date: string;
  classType: string | null;
  sets: SetEntry[];
  feel: Feel | null;
  topWeight: number | null;
  estimated1RM: number | null;
  volume: number;
}

interface Progress {
  exercise: ExerciseInfo;
  sessions: Session[];
  best: { weight: number; reps: number; date: string } | null;
  mostReps: { reps: number; date: string } | null;
  best1RM: number | null;
  first1RM: number | null;
  last1RM: number | null;
}

const FEEL: Record<Feel, string> = { easy: 'קל', challenging: 'מאתגר', very_hard: 'קשה מאוד' };

function setsText(sets: SetEntry[]) {
  return sets.map((s) => (s.weight != null ? `${fmtKg(s.weight)}×${s.reps}` : `${s.reps}`)).join('  ');
}

function Pic({ ex, size = 44 }: { ex: ExerciseInfo; size?: number }) {
  return (
    <div className="ex-pic" style={{ width: size, height: size, borderRadius: size > 50 ? 14 : 10 }}>
      {ex.imageUrl ? <img src={asset(ex.imageUrl)} alt="" /> : <ExerciseIcon area={ex.bodyArea} size={size - 12} />}
    </div>
  );
}

/** Every exercise the trainee logged. Tapping one opens its progress. */
export function MyExercisesList({ onOpen }: { onOpen: (id: number) => void }) {
  const [list, setList] = useState<MyExercise[] | null>(null);
  useEffect(() => {
    api<MyExercise[]>('/api/progress').then(setList);
  }, []);
  if (list?.length === 0)
    return (
      <div className="card">
        <p className="muted" style={{ margin: 0 }}>אחרי שתרשמו משקלים, כל תרגיל יופיע כאן עם הגרף שלו.</p>
      </div>
    );
  return (
    <div className="card" style={{ padding: '4px 16px' }}>
      {list?.map((m) => (
        <button key={m.exercise.id} className="lib-item" onClick={() => onOpen(m.exercise.id)}>
          <Pic ex={m.exercise} />
          <span style={{ flex: 1, textAlign: 'start' }}>
            <b>{m.exercise.name}</b>
            <span className="muted" style={{ display: 'block', fontSize: 13 }}>
              {m.sessions} אימונים · אחרון {fmtDay(m.lastDate)}
            </span>
          </span>
          {m.bestWeight != null && <span style={{ fontWeight: 800 }}>{fmtKg(m.bestWeight)} ק״ג</span>}
          <span aria-hidden="true" className="muted">‹</span>
        </button>
      ))}
    </div>
  );
}

type Metric = 'weight' | 'strength';

/** One exercise: records, a chart over time and every session. */
export function ExerciseProgressScreen({ id, onBack }: { id: number; onBack: () => void }) {
  const [p, setP] = useState<Progress | null>(null);
  const [metric, setMetric] = useState<Metric>('strength');
  const load = () => api<Progress>(`/api/progress/${id}`).then(setP);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!p) return null;

  const ex = p.exercise;
  const weighted = ex.tracksWeight && p.sessions.some((s) => s.topWeight != null);
  const change = p.first1RM != null && p.last1RM != null && p.sessions.length > 1 ? p.last1RM - p.first1RM : null;
  const points = weighted
    ? p.sessions
        .filter((s) => (metric === 'weight' ? s.topWeight : s.estimated1RM) != null)
        .map((s) => ({ date: s.date, value: (metric === 'weight' ? s.topWeight : s.estimated1RM)!, detail: setsText(s.sets) }))
    : p.sessions.map((s) => ({ date: s.date, value: Math.max(...s.sets.map((x) => x.reps)), detail: setsText(s.sets) }));

  return (
    <>
      <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={onBack}>
        › חזרה
      </button>
      <div className="ex-head">
        <Pic ex={ex} size={64} />
        <div style={{ flex: 1 }}>
          <div className="eyebrow">ההתקדמות שלי</div>
          <h1 className="h1" style={{ fontSize: 24 }}>{ex.name}</h1>
          {ex.videoUrl && (
            <a href={ex.videoUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
              ▶ סרטון הדגמה
            </a>
          )}
          <Cues cues={ex.cues} />
        </div>
      </div>

      <div className="card">
        <div className="stat-row">
          {weighted ? (
            <>
              <div>
                <div className="v">{p.best ? <bdi dir="ltr">{`${fmtKg(p.best.weight)}×${p.best.reps}`}</bdi> : '–'}</div>
                <div className="k">שיא אישי (ק״ג×חזרות)</div>
              </div>
              <div>
                <div className="v">{p.best1RM != null ? fmtKg(p.best1RM) : '–'}</div>
                <div className="k">1RM משוער (ק״ג)</div>
              </div>
              <div>
                <div className="v" style={{ color: change != null && change > 0 ? 'var(--ok)' : undefined }}>
                  {change == null ? '–' : <bdi dir="ltr">{`${change > 0 ? '+' : ''}${fmtKg(Math.round(change * 2) / 2)}`}</bdi>}
                </div>
                <div className="k">שינוי בכוח מההתחלה</div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="v">{p.mostReps?.reps ?? '–'}</div>
                <div className="k">הכי הרבה חזרות</div>
              </div>
              <div>
                <div className="v">{p.sessions.length}</div>
                <div className="k">אימונים</div>
              </div>
              <div>
                <div className="v">{p.sessions.length ? fmtDay(p.sessions[p.sessions.length - 1].date) : '–'}</div>
                <div className="k">אחרון</div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ gap: 10 }}>
        {weighted && (
          <div className="chips" role="group" aria-label="מה להציג בגרף">
            <button className="chip" aria-pressed={metric === 'strength'} onClick={() => setMetric('strength')}>
              כוח משוער (1RM)
            </button>
            <button className="chip" aria-pressed={metric === 'weight'} onClick={() => setMetric('weight')}>
              משקל עבודה
            </button>
          </div>
        )}
        {points.length > 1 ? (
          <LineChart
            points={points}
            label={`${ex.name}: ${!weighted ? 'חזרות' : metric === 'weight' ? 'משקל עבודה' : 'כוח משוער'} לאורך זמן`}
            unit={weighted ? 'ק״ג' : 'חזרות'}
          />
        ) : (
          <div className="muted">הגרף יופיע אחרי שני אימונים לפחות.</div>
        )}
        {weighted && metric === 'strength' && (
          <div className="muted" style={{ fontSize: 13 }}>
            כוח משוער מחושב מהמשקל והחזרות יחד, ולכן גם עוד חזרות באותו משקל נחשבות התקדמות.
          </div>
        )}
      </div>


      <h2 className="h2">כל האימונים</h2>
      <div className="card" style={{ gap: 0 }}>
        {[...p.sessions].reverse().map((s, i) => (
          <div key={i} className="hist-ex" style={{ flexDirection: 'column', gap: 2 }}>
            <span>
              {fmtDay(s.date)}
              {s.classType && <span className="muted"> · {s.classType}</span>}
              {s.feel && <span className="muted"> · {FEEL[s.feel]}</span>}
              {s.sets.some((x) => x.isPr) && <span style={{ color: 'var(--ok)', fontWeight: 700 }}> ★ שיא</span>}
            </span>
            <bdi dir="ltr" style={{ fontWeight: 700, alignSelf: 'flex-start' }}>
              {setsText(s.sets)}
            </bdi>
          </div>
        ))}
      </div>
    </>
  );
}
