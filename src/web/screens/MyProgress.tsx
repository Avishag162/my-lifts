import { useEffect, useState } from 'react';
import { api } from '../api.ts';
import { fmtKg } from './Log.tsx';
import { ExerciseProgressScreen } from './Progress.tsx';
import { WorkoutLog } from './History.tsx';

type Period = 'month' | '3m' | 'all';
const PERIODS: [Period, string][] = [
  ['month', 'חודש'],
  ['3m', '3 חודשים'],
  ['all', 'מההתחלה'],
];
const SINCE: Record<Period, string> = { month: 'בחודש', '3m': 'ב-3 חודשים', all: 'מההתחלה' };

interface Trend {
  id: number;
  name: string;
  group: string;
  sessions: number;
  lastDate: string;
  best: number;
  pct: number | null;
  series: number[];
}
interface Overview {
  workouts: number;
  streak: number;
  pct: number | null;
  records: number;
  groups: { id: string; label: string; exercises: number; pct: number | null }[];
  exercises: Trend[];
  recentRecords: { exercise: string; weight: number; reps: number; date: string }[];
}
interface Group {
  id: string;
  label: string;
  pct: number | null;
  series: { date: string; pct: number }[];
  exercises: Trend[];
}

const PERIOD_KEY = 'progress-period';
function savedPeriod(): Period {
  try {
    const v = localStorage.getItem(PERIOD_KEY);
    return v === 'month' || v === '3m' || v === 'all' ? v : '3m';
  } catch {
    return '3m';
  }
}

const shortDate = (d: string) => `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}`;
const signed = (n: number) => `${n > 0 ? '+' : ''}${n}%`;

/** The heaviest weight of each time, as a small line: one series, the last point marked. */
function Spark({ values }: { values: number[] }) {
  const w = 84;
  const h = 30;
  if (values.length < 2) values = [values[0], values[0]];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = (i: number) => 4 + (i * (w - 8)) / (values.length - 1);
  const y = (v: number) => h - 5 - ((v - min) / (max - min || 1)) * (h - 10);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="spark" aria-hidden="true">
      <path d={d} />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="3.5" />
    </svg>
  );
}

/** A muscle group's change over the period: one line, a soft area under it, light grid, dates below. */
function GroupChart({ series }: { series: { date: string; pct: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (series.length < 2) return <div className="muted">עוד אין מספיק אימונים כדי לצייר גרף.</div>;
  const w = 326;
  const h = 150;
  const vals = series.map((p) => p.pct);
  const min = Math.min(0, ...vals);
  const max = Math.max(1, ...vals);
  const x = (i: number) => 20 + (i * (w - 40)) / (series.length - 1);
  const y = (v: number) => h - 26 - ((v - min) / (max - min)) * (h - 40);
  const d = series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.pct).toFixed(1)}`).join(' ');
  const area = `${d} L${x(series.length - 1)},${h - 26} L${x(0)},${h - 26} Z`;
  const every = Math.ceil(series.length / 5);
  const shown = hover ?? series.length - 1;
  return (
    <svg className="group-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`שינוי בכוח: ${series.map((p) => `${shortDate(p.date)} ${signed(p.pct)}`).join(', ')}`}>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} className="grid" x1="12" x2={w - 12} y1={(h - 26) * f + 7} y2={(h - 26) * f + 7} />
      ))}
      <path className="area" d={area} />
      <path className="line" d={d} />
      {series.map((p, i) => (
        <g key={p.date}>
          {(i % every === 0 || i === series.length - 1) && (
            <text x={x(i)} y={h - 8} textAnchor="middle">
              {shortDate(p.date)}
            </text>
          )}
          <rect x={x(i) - 14} y="0" width="28" height={h - 26} fill="transparent" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
        </g>
      ))}
      <circle className="dot" cx={x(shown)} cy={y(series[shown].pct)} r="4.5" />
      {hover != null && (
        <text className="tip" x={Math.min(w - 40, Math.max(40, x(hover)))} y={Math.max(14, y(series[hover].pct) - 10)} textAnchor="middle">
          {shortDate(series[hover].date)} · {signed(series[hover].pct)}
        </text>
      )}
    </svg>
  );
}

function ExerciseRow({ e, onOpen }: { e: Trend; onOpen: (id: number) => void }) {
  return (
    <button className="ex-trend" onClick={() => onOpen(e.id)}>
      <span className="nm">
        <b>{e.name}</b>
        <span>
          {e.sessions} {e.sessions === 1 ? 'אימון' : 'אימונים'} · אחרון {shortDate(e.lastDate)}
        </span>
      </span>
      <Spark values={e.series} />
      <span className="val">
        <b>{fmtKg(e.best)} ק״ג</b>
        <span className={e.pct == null ? 'new' : e.pct > 0 ? 'up' : 'flat'}>{e.pct == null ? 'חדש' : signed(e.pct)}</span>
      </span>
    </button>
  );
}

function PeriodSwitch({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  return (
    <div className="seg" role="group" aria-label="תקופה">
      {PERIODS.map(([p, label]) => (
        <button key={p} aria-pressed={p === period} onClick={() => onChange(p)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function GroupScreen({ id, period, onPeriod, onBack, onOpen }: { id: string; period: Period; onPeriod: (p: Period) => void; onBack: () => void; onOpen: (id: number) => void }) {
  const [g, setG] = useState<Group | null>(null);
  useEffect(() => {
    api<Group>(`/api/me/progress/groups/${id}?period=${period}`).then(setG);
  }, [id, period]);
  return (
    <div className="page">
      <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={onBack}>
        › ההתקדמות שלי
      </button>
      <h1 className="h1">{g?.label ?? ''}</h1>
      <PeriodSwitch period={period} onChange={onPeriod} />
      {g && (
        <>
          <div className="card" style={{ gap: 4 }}>
            <div className="muted" style={{ fontSize: 13 }}>שינוי בכוח (ממוצע התרגילים, לפי המשקל הכי כבד)</div>
            <div className="big-num">
              <bdi dir="ltr">{g.pct == null ? '—' : signed(g.pct)}</bdi> <span className="muted">{SINCE[period]}</span>
            </div>
            <GroupChart series={g.series} />
          </div>
          <div className="card" style={{ gap: 0 }}>
            <h2 className="h2">התרגילים</h2>
            {g.exercises.length === 0 && <div className="muted">אין אימונים בקבוצה הזו בתקופה.</div>}
            {g.exercises.map((e) => (
              <ExerciseRow key={e.id} e={e} onOpen={onOpen} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type View = { kind: 'overview' } | { kind: 'group'; id: string } | { kind: 'log' };
type Sort = 'improved' | 'recent' | 'abc';

/** "My progress": the period, strength by muscle group and by exercise, and recent records. */
export function MyProgressScreen({ exerciseId, onOpenExercise, onGoAchievements }: { exerciseId: number | null; onOpenExercise: (id: number | null) => void; onGoAchievements: () => void }) {
  const [period, setPeriodState] = useState<Period>(savedPeriod);
  const [data, setData] = useState<Overview | null>(null);
  const [view, setView] = useState<View>({ kind: 'overview' });
  const [sort, setSort] = useState<Sort>('improved');
  const [allExercises, setAllExercises] = useState(false);
  const setPeriod = (p: Period) => {
    setPeriodState(p);
    try {
      localStorage.setItem(PERIOD_KEY, p);
    } catch {
      // private mode: not remembered
    }
  };
  useEffect(() => {
    api<Overview>(`/api/me/progress?period=${period}`).then(setData);
  }, [period]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view, exerciseId]);

  if (exerciseId != null)
    return (
      <div className="page">
        <ExerciseProgressScreen id={exerciseId} onBack={() => onOpenExercise(null)} />
      </div>
    );
  if (view.kind === 'log') return <WorkoutLog onBack={() => setView({ kind: 'overview' })} />;
  if (view.kind === 'group')
    return <GroupScreen id={view.id} period={period} onPeriod={setPeriod} onBack={() => setView({ kind: 'overview' })} onOpen={onOpenExercise} />;

  const exercises = data
    ? [...data.exercises].sort((a, b) =>
        sort === 'recent' ? b.lastDate.localeCompare(a.lastDate) : sort === 'abc' ? a.name.localeCompare(b.name, 'he') : 0,
      )
    : [];
  const shown = allExercises ? exercises : exercises.slice(0, 6);
  const top = Math.max(1, ...(data?.groups.map((g) => g.pct ?? 0) ?? []));
  const missing = data?.groups.filter((g) => g.exercises === 0).map((g) => g.label) ?? [];

  return (
    <div className="page">
      <h1 className="h1">ההתקדמות שלי</h1>
      <PeriodSwitch period={period} onChange={setPeriod} />
      {data && data.exercises.length === 0 && (
        <div className="card muted">אחרי שתרשמו משקלים בכמה אימונים, תראו כאן כמה התחזקתם בכל קבוצת שריר ובכל תרגיל.</div>
      )}
      {data && data.exercises.length > 0 && (
        <>
          <div className="kpis">
            <div className="kpi">
              <b>{data.workouts}</b>
              <span>אימונים</span>
              {data.streak > 0 && <span className="up">🔥 {data.streak} שב׳ ברצף</span>}
            </div>
            <div className="kpi">
              <b>
                <bdi dir="ltr">{data.pct == null ? '—' : signed(data.pct)}</bdi>
              </b>
              <span>כוח ממוצע</span>
              <span className="up">{SINCE[period]}</span>
            </div>
            <div className="kpi">
              <b>{data.records}</b>
              <span>שיאים</span>
            </div>
          </div>

          <div className="card" style={{ gap: 0 }}>
            <div className="header">
              <h2 className="h2">לפי קבוצת שריר</h2>
              <span className="muted">שינוי בכוח</span>
            </div>
            {data.groups
              .filter((g) => g.exercises > 0)
              .map((g) => (
                <button key={g.id} className="group-row" onClick={() => setView({ kind: 'group', id: g.id })}>
                  <span>{g.label}</span>
                  <span className="bar">
                    <span style={{ width: `${g.pct && g.pct > 0 ? Math.max(4, (g.pct / top) * 100) : 0}%` }} />
                  </span>
                  <bdi dir="ltr" className={g.pct && g.pct > 0 ? 'pct' : 'pct flat'}>
                    {g.pct == null ? 'חדש' : signed(g.pct)}
                  </bdi>
                  <span className="chev" aria-hidden="true">‹</span>
                </button>
              ))}
            {missing.length > 0 && <div className="muted" style={{ fontSize: 13, paddingTop: 8 }}>לא עבדתם בתקופה על: {missing.join(', ')}.</div>}
          </div>

          <div className="card" style={{ gap: 6 }}>
            <h2 className="h2">לפי תרגיל</h2>
            <div className="chips-sm" role="group" aria-label="מיון">
              {(
                [
                  ['improved', 'הכי השתפרו'],
                  ['recent', 'אחרונים'],
                  ['abc', 'א-ב'],
                ] as [Sort, string][]
              ).map(([k, label]) => (
                <button key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>
                  {label}
                </button>
              ))}
            </div>
            <div>
              {shown.map((e) => (
                <ExerciseRow key={e.id} e={e} onOpen={onOpenExercise} />
              ))}
            </div>
            {exercises.length > 6 && (
              <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setAllExercises(!allExercises)}>
                {allExercises ? 'פחות' : `כל ${exercises.length} התרגילים`}
              </button>
            )}
          </div>

          {data.recentRecords.length > 0 && (
            <div className="card" style={{ gap: 10 }}>
              <h2 className="h2">שיאים אחרונים</h2>
              <div className="rec-strip">
                {data.recentRecords.map((r) => (
                  <div key={`${r.exercise}-${r.date}`}>
                    <span>{r.exercise}</span>
                    <b dir="ltr">
                      {fmtKg(r.weight)} × {r.reps}
                    </b>
                    <span>{shortDate(r.date)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <div className="foot-links">
        <button onClick={() => setView({ kind: 'log' })}>🗓️ יומן אימונים</button>
        <button onClick={onGoAchievements}>🏅 תגים ואתגרים</button>
      </div>
    </div>
  );
}
