import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Icon, type IconName } from '../ui-icons.tsx';
import { seenBadges } from '../seen-badges.ts';
import { api, type ClassSummary, type Feel, type Me, type WorkoutItem } from '../api.ts';
import { ExerciseIcon } from '../icons.tsx';
import { LibrarySheet } from './Library.tsx';
import { drawBadgeStory, drawStory, shareStory } from '../story.ts';
import { InstallCard } from '../install.tsx';
import { Cues } from '../Cues.tsx';

interface Workout {
  class: { id: number; classType: string; startsAt: string };
  items: WorkoutItem[];
}

interface DraftSet {
  weight: string;
  reps: string;
}

const FEEL_LABELS: [Feel, string, IconName][] = [
  ['easy', 'קל', 'feather'],
  ['challenging', 'מאתגר', 'bolt'],
  ['very_hard', 'קשה מאוד', 'fire'],
];

export function fmtKg(n: number | null | undefined): string {
  if (n == null) return '';
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

function classLabel(c: { classType: string; startsAt: string }): string {
  const d = new Date(c.startsAt);
  const today = new Date();
  const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  const isToday = d.toDateString() === today.toDateString();
  // A workout on one's own has no hour.
  if (c.classType === SOLO) return `${isToday ? 'היום' : fmtDate(c.startsAt)} · ${c.classType}`;
  return `${isToday ? 'היום' : fmtDate(c.startsAt)} · ${c.classType} · ${time}`;
}

function summarizeSets(sets: { weight: number | null; reps: number }[]): string {
  if (sets.length === 0) return '';
  const weights = sets.map((s) => s.weight).filter((w): w is number => w != null);
  const reps = Math.max(...sets.map((s) => s.reps));
  if (weights.length === 0) return `${sets.length} × ${reps}`;
  return `${sets.length} × ${reps} · ${fmtKg(Math.max(...weights))} ק״ג`;
}

/** Starting rows for the set editor: what was logged, else the target, else empty rows for the prescribed sets. */
function initialDraft(item: WorkoutItem): DraftSet[] {
  if (item.logged) return item.logged.sets.map((s) => ({ weight: fmtKg(s.weight), reps: String(s.reps) }));
  const n = item.target?.sets ?? item.prescribed.sets ?? 3;
  const reps = item.prescribed.reps ? String(item.prescribed.reps) : '';
  const weight = item.target?.weight != null ? fmtKg(item.target.weight) : '';
  return Array.from({ length: Math.min(Math.max(n, 1), 10) }, () => ({ weight, reps }));
}

// Where the workouts API lives.
const Base = createContext('/api/classes');

/** The workout screen: pick or open a workout, add exercises, log sets. */
export function LogScreen({
  me,
  onOpenProgress,
  initialClassId,
  onOpenMyProgress,
}: {
  me?: Me;
  onOpenProgress?: (exerciseId: number) => void;
  /** The trainee's own screen: the end-of-workout card links to "my progress". */
  onOpenMyProgress?: () => void;
  initialClassId?: number;
}) {
  const base = '/api/classes';
  const pageClass = 'page';
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [toast, setToast] = useState<{ text: string; pr: boolean } | null>(null);
  const [record, setRecord] = useState<NewRecord | null>(null);
  // A workout on one's own just opened: reload the list and show it.
  const [opened, setOpened] = useState<number | null>(null);

  useEffect(() => {
    api<ClassSummary[]>(base).then((cs) => {
      setClasses(cs);
      // Default: the class asked for, else the most recent class that has started, else the next one today.
      const now = Date.now();
      const started = cs.find((c) => new Date(c.startsAt).getTime() <= now);
      const asked = cs.find((c) => c.id === (opened ?? initialClassId));
      setClassId((asked ?? started ?? cs[cs.length - 1])?.id ?? null);
    });
  }, [base, initialClassId, opened]);
  const solo = (
    <SoloStart
      onOpened={(id) => {
        setOpened(id);
        if (classes?.some((c) => c.id === id)) setClassId(id);
      }}
    />
  );

  const loadWorkout = useCallback(async (id: number, focusKey?: string) => {
    const w = await api<Workout>(`${base}/${id}`);
    setWorkout(w);
    setActiveKey((cur) => {
      if (focusKey && w.items.some((i) => i.key === focusKey)) return focusKey;
      if (cur && w.items.some((i) => i.key === cur)) return cur;
      return (w.items.find((i) => !i.logged) ?? w.items[0])?.key ?? null;
    });
  }, [base]);

  useEffect(() => {
    if (classId != null) {
      setActiveKey(null);
      loadWorkout(classId);
    }
  }, [classId, loadWorkout]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const active = workout?.items.find((i) => i.key === activeKey) ?? null;
  const loggedCount = workout?.items.filter((i) => i.logged).length ?? 0;
  const allDone = !!workout && workout.items.length > 0 && loggedCount === workout.items.length;

  async function onSaved(prSets: number[], savedKey: string, saved: { weight: number | null; reps: number }[], item: WorkoutItem) {
    if (!workout || classId == null) return;
    const pr = prSets.map((i) => saved[i]).filter(Boolean).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || b.reps - a.reps)[0];
    // A new record gets its own screen.
    if (pr) setRecord({ exercise: item.exercise?.name ?? item.rawName, weight: pr.weight, reps: pr.reps, before: lastBest(item) });
    else setToast({ text: 'נשמר', pr: false });
    const fresh = await api<Workout>(`${base}/${classId}`);
    setWorkout(fresh);
    // Move on to the next exercise that hasn't been logged yet.
    const idx = fresh.items.findIndex((i) => i.key === savedKey);
    const next = [...fresh.items.slice(idx + 1), ...fresh.items.slice(0, idx)].find((i) => !i.logged);
    setActiveKey(next?.key ?? savedKey);
  }

  async function addFromLibrary(exerciseId: number) {
    if (classId == null) return;
    setShowLibrary(false);
    // An added exercise appears as soon as the first set is saved; start it with an empty draft.
    setPendingExtra(exerciseId);
  }

  const [pendingExtra, setPendingExtra] = useState<number | null>(null);
  const [pendingExtraItem, setPendingExtraItem] = useState<WorkoutItem | null>(null);
  useEffect(() => {
    if (pendingExtra == null) {
      setPendingExtraItem(null);
      return;
    }
    // Comes with last time and a recommended weight, like the coach's lines (a workout on one's own is all added exercises).
    api<WorkoutItem>(`${base}/${classId}/added/${pendingExtra}`).then((item) => {
      setPendingExtraItem(item);
      setActiveKey(item.key);
    });
  }, [pendingExtra, base, classId]);

  const items = useMemo(() => {
    const list = workout?.items ?? [];
    if (pendingExtraItem && !list.some((i) => i.exercise?.id === pendingExtraItem.exercise?.id && !i.classExerciseId))
      return [...list, pendingExtraItem];
    return list;
  }, [workout, pendingExtraItem]);
  const current = items.find((i) => i.key === activeKey) ?? active;

  if (classes === null) return <div className={pageClass} />;

  if (classes.length === 0) {
    return (
      <div className={pageClass}>
        <Header me={me!} sub="אין אימונים פתוחים" />
        <div className="card">
          <h2 className="h2">מתחילים אימון</h2>
          <p className="muted" style={{ margin: 0 }}>
            פותחים אימון ליום, מוסיפים את התרגילים שעשיתם ורושמים סטים ומשקלים. בפעם הבאה תראו מה הרמתם ויעד מומלץ.
          </p>
        </div>
        {solo}
      </div>
    );
  }

  return (
    <Base.Provider value={base}>
    <div className={pageClass}>
      <Header me={me!} sub={workout ? classLabel(workout.class) : ''} />
      <InstallCard dismissible />

      {classes.length > 1 && (
        <div className="chips" role="group" aria-label="בחירת אימון">
          {classes.map((c) => (
            <button key={c.id} className="chip" aria-pressed={c.id === classId} onClick={() => setClassId(c.id)}>
              {classLabel(c)}
            </button>
          ))}
        </div>
      )}

      {workout && workout.items.length === 0 && !pendingExtraItem && (
        <div className="card">
          <h2 className="h2">עוד אין תרגילים באימון</h2>
          <p className="muted" style={{ margin: 0 }}>
            מוסיפים מהספרייה את התרגילים שעשיתם (או תרגיל חדש משלכם), ורושמים סטים ומשקלים.
          </p>
          <button className="btn-dashed" onClick={() => setShowLibrary(true)}>
            + הוספת תרגיל מהספרייה
          </button>
        </div>
      )}

      {workout && items.length > 0 && (
        <>
          <div className="muted">
            התרגילים שלי · {loggedCount} מתוך {workout.items.length} נרשמו
          </div>
          <div className="strip">
            {items.map((i) => (
              <button
                key={i.key}
                className="ex-chip"
                aria-current={i.key === current?.key}
                aria-label={`${i.exercise?.name ?? i.rawName}${i.logged ? ', נרשם' : ''}`}
                onClick={() => setActiveKey(i.key)}
              >
                <ExerciseIcon area={i.exercise?.bodyArea} color={i.key === current?.key ? '#7A4A7B' : '#486060'} />
                <span className={i.logged ? 'done' : ''}>
                  {shortName(i.exercise?.name ?? i.rawName)}
                  {i.logged ? ' ✓' : ''}
                </span>
              </button>
            ))}
            <button className="ex-add" aria-label="הוספת תרגיל שלא ברשימה" onClick={() => setShowLibrary(true)}>
              +
            </button>
          </div>

          {allDone && <DoneCard workout={workout} firstName={me?.firstName ?? null} onOpenMyProgress={onOpenMyProgress} />}

          {current && (
            <ExerciseCard
              key={`${classId}:${current.key}:${current.logged?.entryId ?? 'new'}`}
              classId={classId!}
              item={current}
              onOpenProgress={onOpenProgress}
              onSaved={(prSets, saved) => {
                if (current.key.startsWith('new:')) setPendingExtra(null);
                onSaved(prSets, current.key, saved, current);
              }}
              onDeleted={async () => {
                setToast({ text: 'נמחק', pr: false });
                if (classId != null) await loadWorkout(classId);
              }}
            />
          )}
        </>
      )}

      {solo}
      {showLibrary && <LibrarySheet onPick={addFromLibrary} onClose={() => setShowLibrary(false)} />}
      {record && <RecordScreen record={record} firstName={me?.firstName ?? ''} onClose={() => setRecord(null)} />}
      {toast && (
        <div className={`toast${toast.pr ? ' pr' : ''}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
    </Base.Provider>
  );
}

const SOLO = 'אימון';

/** The local date n days ago, as YYYY-MM-DD. */
function daysAgo(n: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date(Date.now() - n * 86_400_000));
}

/** Opens a workout: pick the day, then add exercises. */
function SoloStart({ onOpened }: { onOpened: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(daysAgo(0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function start() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ id: number }>('/api/solo', { date });
      setOpen(false);
      onOpened(r.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'משהו השתבש');
    } finally {
      setBusy(false);
    }
  }
  if (!open)
    return (
      <button className="btn-dashed" onClick={() => setOpen(true)}>
        + אימון חדש
      </button>
    );
  return (
    <div className="card" style={{ gap: 10 }}>
      <h2 className="h2">אימון חדש</h2>
      <div className="muted">מתי התאמנתם?</div>
      <div className="chips" role="group" aria-label="מתי">
        {[
          ['היום', 0],
          ['אתמול', 1],
          ['שלשום', 2],
        ].map(([label, n]) => (
          <button key={n} type="button" className="chip" aria-pressed={date === daysAgo(n as number)} onClick={() => setDate(daysAgo(n as number))}>
            {label}
          </button>
        ))}
      </div>
      <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        או תאריך:
        <input type="date" value={date} min={daysAgo(365)} max={daysAgo(0)} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </label>
      {error && <div className="error">{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" disabled={busy} onClick={start}>
          התחלה
        </button>
        <button className="btn-ghost" onClick={() => setOpen(false)}>
          ביטול
        </button>
      </div>
    </div>
  );
}

function prescription(sets: number | null, repsText: string): string {
  return sets ? `${sets} × ${repsText}` : repsText;
}

function shortName(name: string): string {
  return name.length > 14 ? name.split(' ').slice(0, 2).join(' ') : name;
}

function Header({ me, sub }: { me: Me; sub: string }) {
  return (
    <div className="header">
      <div>
        <div className="eyebrow">{sub}</div>
        <h1 className="h1">היי {me.firstName}</h1>
      </div>
    </div>
  );
}

/** The workout summary; `firstName` (the trainee's own screen) also offers sharing it as a story. */
function DoneCard({ workout, firstName, onOpenMyProgress }: { workout: Workout; firstName: string | null; onOpenMyProgress?: () => void }) {
  const sets = workout.items.flatMap((i) => i.logged?.sets ?? []);
  const total = sets.reduce((t, s) => t + (s.weight ?? 0) * s.reps, 0);
  const prs = sets.filter((s) => s.isPr).length;
  const [story, setStory] = useState<Blob | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);

  // Drawn ahead of time: phones only open the share sheet straight from a tap.
  const key = JSON.stringify(workout.items.map((i) => i.logged?.sets));
  useEffect(() => {
    if (!firstName) return;
    let live = true;
    const name = (i: WorkoutItem) => i.exercise?.name ?? i.rawName;
    drawStory({
      firstName,
      classType: workout.class.classType,
      startsAt: workout.class.startsAt,
      totalKg: total,
      sets: sets.length,
      prs: workout.items.flatMap((i) =>
        (i.logged?.sets ?? []).filter((s) => s.isPr).slice(-1).map((s) => ({ name: name(i), weight: s.weight, reps: s.reps })),
      ),
      exercises: workout.items
        .filter((i) => i.logged)
        .map((i) => {
          const ss = i.logged!.sets;
          const w = ss.map((s) => s.weight).filter((x): x is number => x != null);
          return { name: name(i), top: w.length ? `${fmtKg(Math.max(...w))} kg` : `${ss.length} × ${Math.max(...ss.map((s) => s.reps))}` };
        }),
    })
      .then((b) => live && setStory(b))
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstName, key]);

  // What got better today: new records, more weight than last time, new badges, and the month's count.
  const [extra, setExtra] = useState<{ newBadges: string[]; month: { value: number; target: number; title: string } | null } | null>(null);
  useEffect(() => {
    if (!firstName) return;
    api<{ earned: { id: string; title: string }[]; challenges: { id: string; title: string; value: number; target: number }[] }>('/api/badges')
      .then((b) => {
        const seen = seenBadges();
        const m = b.challenges.find((c) => c.id === 'month');
        setExtra({
          newBadges: seen ? b.earned.filter((x) => !seen.has(x.id)).map((x) => x.title) : [],
          month: m ? { value: m.value, target: m.target, title: m.title } : null,
        });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstName, key]);
  const name = (i: WorkoutItem) => i.exercise?.name ?? i.rawName;
  const records = workout.items.flatMap((i) => {
    const pr = (i.logged?.sets ?? []).filter((s) => s.isPr).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || b.reps - a.reps)[0];
    return pr ? [{ name: name(i), set: pr }] : [];
  });
  const heavier = workout.items.flatMap((i) => {
    const now = Math.max(0, ...(i.logged?.sets ?? []).map((s) => s.weight ?? 0));
    const before = Math.max(0, ...(i.last?.sets ?? []).map((s) => s.weight ?? 0));
    return now > 0 && before > 0 && now > before && !records.some((r) => r.name === name(i)) ? [{ name: name(i), kg: now - before }] : [];
  });
  const gains = firstName ? [
    ...records.map((r) => ({ icon: '🏆', text: `שיא חדש ב${r.name}`, value: setText(r.set) })),
    ...heavier.map((h) => ({ icon: '📈', text: h.name, value: `+${fmtKg(h.kg)} ק״ג מהפעם הקודמת` })),
    ...(extra?.newBadges ?? []).map((t) => ({ icon: '🏅', text: `תג חדש: ${t}`, value: '' })),
  ] : [];

  async function share() {
    if (!story) return;
    const r = await shareStory(story);
    setShareNote(r === 'downloaded' ? 'התמונה ירדה למכשיר. אפשר להעלות אותה לסטורי מהגלריה.' : null);
  }

  return (
    <div className="card" style={{ background: 'var(--ok-soft)' }}>
      <h2 className="h2">כל הכבוד, האימון נרשם</h2>
      <div className="stat-row">
        <div>
          <div className="v">{Math.round(total).toLocaleString('he-IL')}</div>
          <div className="k">ק״ג שהורמו</div>
        </div>
        <div>
          <div className="v">{sets.length}</div>
          <div className="k">סטים</div>
        </div>
        <div>
          <div className="v">{prs}</div>
          <div className="k">שיאים חדשים</div>
        </div>
      </div>
      {gains.length > 0 && (
        <div className="gains">
          <b>💪 מה התקדמת היום</b>
          {gains.map((g, i) => (
            <div key={i} className="gain">
              <span>
                {g.icon} {g.text}
              </span>
              {g.value && <b>{g.value}</b>}
            </div>
          ))}
        </div>
      )}
      {firstName && extra?.month && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="header" style={{ fontSize: 15 }}>
            <b>{extra.month.title}</b>
            <span className="muted">
              {extra.month.value} / {extra.month.target} אימונים
            </span>
          </div>
          <div className="progress-track">
            <span style={{ width: `${Math.min(100, (extra.month.value / extra.month.target) * 100)}%` }} />
          </div>
        </div>
      )}
      {firstName && (
        <button className="btn" style={{ marginTop: 4 }} disabled={!story} onClick={share}>
          <Icon name="share" /> שיתוף לסטורי
        </button>
      )}
      {onOpenMyProgress && (
        <button className="btn-ghost" onClick={onOpenMyProgress}>
          לכל ההתקדמות שלי
        </button>
      )}
      {shareNote && <div className="muted" style={{ fontSize: 13 }}>{shareNote}</div>}
    </div>
  );
}

interface NewRecord {
  exercise: string;
  weight: number | null;
  reps: number;
  before: { weight: number | null; reps: number } | null;
}

/** The heaviest set of the last time, to show how much better the new record is. */
function lastBest(item: WorkoutItem): NewRecord['before'] {
  const sets = item.last?.sets ?? [];
  return sets.length ? [...sets].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || b.reps - a.reps)[0] : null;
}

const setText = (s: { weight: number | null; reps: number }) => (s.weight != null ? `${fmtKg(s.weight)} ק״ג × ${s.reps}` : `${s.reps} חזרות`);

/** A full screen celebration for a new personal record, with a story to share. */
function RecordScreen({ record, firstName, onClose }: { record: NewRecord; firstName: string; onClose: () => void }) {
  const [story, setStory] = useState<Blob | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const gain = record.before?.weight != null && record.weight != null && record.weight > record.before.weight ? record.weight - record.before.weight : null;
  // Drawn as soon as the screen opens: phones only open the share sheet straight from a tap.
  useEffect(() => {
    let live = true;
    drawBadgeStory({ firstName, icon: '🏆', title: 'שיא אישי חדש', detail: `${record.exercise}: ${setText(record)}`, kind: 'record' })
      .then((b) => live && setStory(b))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [record, firstName]);
  return (
    <div className="record-screen" role="dialog" aria-label="שיא אישי חדש">
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <i key={i} style={{ insetInlineStart: `${(i * 37) % 100}%`, animationDelay: `${((i * 0.83) % 2.6).toFixed(2)}s`, animationDuration: `${2.2 + (i % 5) * 0.3}s`, background: ['#F6C450', '#fff', '#E9A8E0', '#B98BD0'][i % 4] }} />
        ))}
      </div>
      <div className="record-medal" aria-hidden="true">🏆</div>
      <div className="record-pill">שיא אישי חדש</div>
      <h1>{record.exercise}</h1>
      <div className="record-value"><bdi>{setText(record)}</bdi></div>
      {gain != null ? (
        <p>עוד {fmtKg(gain)} ק״ג מהפעם הקודמת</p>
      ) : record.before ? (
        <p>הפעם הקודמת: <bdi>{setText(record.before)}</bdi></p>
      ) : null}
      <button
        className="btn record-share"
        disabled={!story}
        onClick={async () => {
          if (!story) return;
          const r = await shareStory(story);
          setNote(r === 'downloaded' ? 'התמונה ירדה למכשיר. אפשר להעלות אותה לסטורי מהגלריה.' : null);
        }}
      >
        שיתוף לסטורי
      </button>
      {note && <p>{note}</p>}
      <button className="link-btn record-close" onClick={onClose}>
        להמשיך באימון
      </button>
    </div>
  );
}

function ExerciseCard({ classId, item, onSaved, onDeleted, onOpenProgress }: { classId: number; item: WorkoutItem; onSaved: (prSets: number[], saved: { weight: number | null; reps: number }[]) => void; onDeleted: () => void; onOpenProgress?: (exerciseId: number) => void }) {
  const base = useContext(Base);
  const [sets, setSets] = useState<DraftSet[]>(() => initialDraft(item));
  const [feel, setFeel] = useState<Feel | null>(item.logged?.feel ?? null);
  const [note, setNote] = useState(item.logged?.note ?? '');
  const [showNote, setShowNote] = useState(!!item.logged?.note);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ex = item.exercise;
  const tracksWeight = ex ? ex.tracksWeight : true;
  const loggedPr = new Set((item.logged?.sets ?? []).map((s, i) => (s.isPr ? i : -1)).filter((i) => i >= 0));

  // How much + and − change the weight: the exercise's usual step, or what this trainee picked for it last time.
  const [step, setStep] = useState<number>(() => savedStep(ex?.id) ?? (ex?.weightStep || 2.5));
  function chooseStep(v: number) {
    setStep(v);
    if (ex) rememberStep(ex.id, v);
  }

  // A change in the first set carries on to the sets below it that still had the same value, so usually only one number is typed.
  // Any other set changes on its own.
  function update(i: number, field: keyof DraftSet, value: string) {
    const v = value.replace(',', '.');
    setSets((cur) => {
      const old = cur[i][field];
      return cur.map((s, j) => (j === i || (i === 0 && j > 0 && s[field] === old) ? { ...s, [field]: v } : s));
    });
  }

  function bump(i: number, dir: 1 | -1) {
    const w = Number(sets[i].weight);
    const base = Number.isFinite(w) ? w : 0;
    const next = Math.max(0, Math.round((base + dir * step) * 100) / 100);
    update(i, 'weight', fmtKg(next));
  }

  async function save() {
    setError(null);
    const parsed = sets
      .filter((s) => s.reps.trim() !== '' || s.weight.trim() !== '')
      .map((s) => ({ weight: tracksWeight && s.weight.trim() !== '' ? Number(s.weight) : null, reps: Number(s.reps) }));
    if (parsed.length === 0) return setError('מלאו לפחות סט אחד');
    if (parsed.some((s) => !Number.isInteger(s.reps) || s.reps < 1)) return setError('בכל סט צריך מספר חזרות');
    if (tracksWeight && parsed.some((s) => s.weight == null || Number.isNaN(s.weight)))
      return setError('בכל סט צריך משקל');
    setBusy(true);
    try {
      const r = await api<{ prSets: number[] }>(`${base}/${classId}/entries`, {
        classExerciseId: item.classExerciseId,
        exerciseId: item.classExerciseId ? null : ex?.id,
        sets: parsed,
        feel,
        note: note.trim() || null,
      });
      onSaved(r.prSets, parsed);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="ex-head">
        <div className={`ex-pic${ex ? '' : ' unknown'}`}>
          {ex?.imageUrl ? <img src={ex.imageUrl} alt="" /> : ex ? <ExerciseIcon area={ex.bodyArea} size={52} /> : '?'}
        </div>
        <div style={{ flex: 1 }}>
          <h2 className="h2">{ex?.name ?? item.rawName}</h2>
          {ex?.videoUrl && (
            <a href={ex.videoUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
              ▶ סרטון הדגמה
            </a>
          )}
          {ex && item.last && onOpenProgress && (
            <button className="link-btn" style={{ fontSize: 13, marginInlineStart: ex.videoUrl ? 12 : 0 }} onClick={() => onOpenProgress(ex.id)}>
              📈 ההתקדמות שלי
            </button>
          )}
          <Cues cues={ex?.cues} />
          {(item.prescribed.section || item.prescribed.repsText) && (
            <div className="muted">
              {item.prescribed.section}
              {item.prescribed.section && item.prescribed.repsText && ' · '}
              {item.prescribed.repsText && (
                <>
                  מתוכנן:{' '}
                  <bdi dir="ltr">{prescription(item.prescribed.sets, item.prescribed.repsText)}</bdi>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {!ex && <div className="notice">התרגיל לא נמצא בספרייה.</div>}

      {ex && (
        <div className="compare">
          <div className="last">
            <div className="k muted">{item.last ? `בפעם הקודמת · ${fmtDate(item.last.date)}` : 'בפעם הקודמת'}</div>
            <div className="v">{item.last ? summarizeSets(item.last.sets) : 'פעם ראשונה'}</div>
          </div>
          <div className="target">
            <div className="k">יעד מומלץ להיום</div>
            <div className="v">
              {item.target?.weight != null && <>{fmtKg(item.target.weight)} ק״ג</>}
              {item.target?.weight != null && item.prescribed.repsText && ' · '}
              {item.prescribed.repsText && (
                <>
                  <bdi dir="ltr">{item.prescribed.repsText}</bdi> חזרות
                </>
              )}
              {item.target?.weight == null && !item.prescribed.repsText && 'משקל שנוח לכם'}
            </div>
          </div>
        </div>
      )}

      {tracksWeight && (
        <div className="step-pick" role="group" aria-label="קפיצות משקל בלחיצה על פלוס ומינוס">
          <span className="muted">קפיצות</span>
          {STEPS.map((v) => (
            <button key={v} type="button" className="qchip" aria-pressed={step === v} onClick={() => chooseStep(v)}>
              {fmtKg(v)}
            </button>
          ))}
        </div>
      )}

      <div className={`sets${tracksWeight ? '' : ' no-weight'}`}>
        <span className="hdr" style={{ textAlign: 'center' }}>סט</span>
        {tracksWeight && <span className="hdr">משקל (ק״ג)</span>}
        <span className="hdr">חזרות</span>
        <span />
        {sets.map((s, i) => (
          <SetRow
            key={i}
            index={i}
            set={s}
            tracksWeight={tracksWeight}
            canRemove={sets.length > 1}
            isPr={loggedPr.has(i)}
            onChange={update}
            onBump={(dir) => bump(i, dir)}
            step={step}
            onRemove={() => setSets((cur) => cur.filter((_, j) => j !== i))}
          />
        ))}
      </div>

      <div className="row">
        <button
          className="btn-dashed"
          onClick={() => setSets((cur) => [...cur, { ...(cur[cur.length - 1] ?? { weight: '', reps: '' }) }])}
          disabled={sets.length >= 20}
        >
          <Icon name="plus" /> הוסף סט
        </button>
        <button className="btn-ghost" onClick={() => setShowNote((v) => !v)} aria-expanded={showNote}>
          <Icon name="chat" /> הערה
        </button>
      </div>

      {showNote && (
        <div className="field">
          <label htmlFor="note">הערה לעצמי</label>
          <textarea id="note" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="למשל: הרגשתי כאב בברך בסט האחרון" />
        </div>
      )}

      <div>
        <div className="muted" style={{ marginBottom: 6 }} id="feel-label">
          איך הרגיש?
        </div>
        <div className="feel" role="group" aria-labelledby="feel-label">
          {FEEL_LABELS.map(([k, label, icon]) => (
            <button key={k} aria-pressed={feel === k} onClick={() => setFeel(feel === k ? null : k)}>
              <Icon name={icon} filled={icon === 'bolt'} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error" role="alert">{error}</div>}
      <button className="btn" onClick={save} disabled={busy}>
        <Icon name="check" size={22} />
        {item.logged ? 'עדכון' : 'שמירה ומעבר לתרגיל הבא'}
      </button>
      {item.logged && <DeleteEntry classId={classId} entryId={item.logged.entryId} ownExtra={!item.classExerciseId} onDeleted={onDeleted} />}
    </div>
  );
}

/** A logged exercise entered by mistake: two taps (no browser dialog) to delete it. */
function DeleteEntry({ classId, entryId, ownExtra, onDeleted }: { classId: number; entryId: number; ownExtra: boolean; onDeleted: () => void }) {
  const base = useContext(Base);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = ownExtra ? 'מחיקת התרגיל' : 'מחיקת מה שנרשם';
  async function del() {
    setBusy(true);
    setError(null);
    try {
      await api(`${base}/${classId}/entries/${entryId}/delete`, {});
      onDeleted();
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }
  if (!asking)
    return (
      <button type="button" className="link-btn delete-entry" onClick={() => setAsking(true)}>
        <Icon name="trash" size={16} /> {label}
      </button>
    );
  return (
    <div className="delete-ask" role="alert">
      <span>{ownExtra ? 'למחוק את התרגיל מהאימון?' : 'למחוק את הסטים שנרשמו בתרגיל הזה?'}</span>
      <div className="row">
        <button type="button" className="btn-ghost" onClick={() => setAsking(false)}>
          ביטול
        </button>
        <button type="button" className="btn-danger" disabled={busy} onClick={del}>
          מחיקה
        </button>
      </div>
      {error && <div className="error">{error}</div>}
    </div>
  );
}

const STEPS = [0.5, 1, 1.25, 2, 2.5, 5, 10];
const STEP_KEY = 'weight-steps';

function savedStep(exerciseId: number | undefined): number | null {
  if (exerciseId == null) return null;
  try {
    const v = JSON.parse(localStorage.getItem(STEP_KEY) ?? '{}')[exerciseId];
    return STEPS.includes(v) ? v : null;
  } catch {
    return null;
  }
}

function rememberStep(exerciseId: number, v: number) {
  try {
    const all = JSON.parse(localStorage.getItem(STEP_KEY) ?? '{}');
    all[exerciseId] = v;
    localStorage.setItem(STEP_KEY, JSON.stringify(all));
  } catch {
    /* not remembered: fine */
  }
}

function SetRow(props: {
  index: number;
  set: DraftSet;
  tracksWeight: boolean;
  canRemove: boolean;
  isPr: boolean;
  onChange: (i: number, field: keyof DraftSet, value: string) => void;
  onBump: (dir: 1 | -1) => void;
  step: number;
  onRemove: () => void;
}) {
  const { index: i, set, tracksWeight } = props;
  return (
    <>
      <span className="set-no">{i + 1}</span>
      {tracksWeight && (
        <div className="stepper">
          <button type="button" className="step-btn" aria-label={`סט ${i + 1}: פחות ${fmtKg(props.step)} ק״ג`} onClick={() => props.onBump(-1)}>
            −
          </button>
          <input
            className="set-input"
            aria-label={`סט ${i + 1} משקל`}
            inputMode="decimal"
            value={set.weight}
            onChange={(e) => props.onChange(i, 'weight', e.target.value)}
          />
          <button type="button" className="step-btn" aria-label={`סט ${i + 1}: עוד ${fmtKg(props.step)} ק״ג`} onClick={() => props.onBump(1)}>
            +
          </button>
        </div>
      )}
      <input
        className="set-input"
        aria-label={`סט ${i + 1} חזרות`}
        inputMode="numeric"
        value={set.reps}
        onChange={(e) => props.onChange(i, 'reps', e.target.value.replace(/\D/g, ''))}
      />
      {props.canRemove ? (
        <button className="set-remove" aria-label={`הסרת סט ${i + 1}`} onClick={props.onRemove}>
          ✕
        </button>
      ) : (
        <span />
      )}
      {props.isPr && <span className="pr-badge">★ שיא חדש</span>}
    </>
  );
}
