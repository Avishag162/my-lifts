import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../ui-icons.tsx';
import { api } from '../api.ts';
import { type MonthStoryData, type SinceStoryData, type StoryKind, drawBadgeStory, drawMonthStory, drawSinceStory, shareStory } from '../story.ts';

interface Badge {
  id: string;
  title: string;
  detail: string;
  icon: string;
  kind: StoryKind;
}
interface Locked {
  id: string;
  title: string;
  hint: string;
  icon: string;
  kind: StoryKind;
}
type Data = { earned: Badge[]; locked?: Locked[]; challenges: Challenge[]; streak: number };
interface Challenge {
  id: string;
  title: string;
  value: number;
  target: number;
  unit: string;
}

type MonthSummary = Omit<MonthStoryData, 'firstName'> & { month: string; sets: number };

const ym = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }).slice(0, 7);

/** A card with a ready story: drawn when the card opens, because phones only open the share sheet straight from a tap. */
function ShareCard({ title, children, draw }: { title: string; children: React.ReactNode; draw: (() => Promise<Blob>) | null }) {
  const [story, setStory] = useState<Blob | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    setStory(null);
    if (!draw) return;
    let live = true;
    draw()
      .then((b) => live && setStory(b))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [draw]);
  return (
    <div className="card share-card" style={{ gap: 8 }}>
      <h2 className="h2">{title}</h2>
      {children}
      <button
        className="btn"
        style={{ height: 44, fontSize: 16 }}
        disabled={!story}
        onClick={async () => {
          if (!story) return;
          const r = await shareStory(story);
          setNote(r === 'downloaded' ? 'התמונה ירדה למכשיר. אפשר להעלות אותה לסטורי מהגלריה.' : null);
        }}
      >
        שיתוף לסטורי
      </button>
      {note && <span className="muted">{note}</span>}
    </div>
  );
}

/** The month in numbers, and "since I started": both ready to share. */
function ShareCards({ firstName }: { firstName: string }) {
  const now = new Date();
  const thisMonth = ym(now);
  const lastMonth = ym(new Date(now.getFullYear(), now.getMonth() - 1, 15));
  // In the first week of a month, last month is the one to share.
  const [month, setMonth] = useState(now.getDate() <= 7 ? lastMonth : thisMonth);
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [since, setSince] = useState<SinceStoryData | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    api<{ since: Omit<SinceStoryData, 'firstName'> | null }>('/api/me/since-start').then((r) => setSince(r.since ? { ...r.since, firstName } : null));
    for (const m of [thisMonth, lastMonth]) api<MonthSummary>(`/api/me/month-summary?month=${m}`).then((r) => setNames((n) => ({ ...n, [m]: r.monthName })));
  }, [firstName, thisMonth, lastMonth]);
  useEffect(() => {
    setSummary(null);
    api<MonthSummary>(`/api/me/month-summary?month=${month}`).then(setSummary);
  }, [month]);
  const drawMonth = useMemo(() => (summary && summary.workouts ? () => drawMonthStory({ ...summary, firstName }) : null), [summary, firstName]);
  const drawSince = useMemo(() => (since ? () => drawSinceStory(since) : null), [since]);
  return (
    <>
      <ShareCard title={summary ? `הסיכום של ${summary.monthName}` : 'הסיכום החודשי'} draw={drawMonth}>
        <div className="seg">
          {[lastMonth, thisMonth].map((m) => (
            <button key={m} aria-pressed={month === m} onClick={() => setMonth(m)}>
              {m === thisMonth ? 'החודש' : names[m] ?? 'חודש קודם'}
            </button>
          ))}
        </div>
        {summary && (summary.workouts ? (
          <div className="muted">
            {summary.workouts} אימונים · {summary.tons.toLocaleString('he-IL')} טון · {summary.prs} שיאים
          </div>
        ) : (
          <div className="muted">אין עדיין אימונים רשומים בחודש הזה.</div>
        ))}
      </ShareCard>
      {since && (
        <ShareCard title="מאז שהתחלתי" draw={drawSince}>
          <div className="muted">
            {since.exercise}: <bdi>{since.from} ← {since.to} ק״ג</bdi> · +{since.pct}%
          </div>
        </ShareCard>
      )}
    </>
  );
}

/** The achievements tab: challenges first, then badges, then the month's story. */
export function AchievementsScreen({ firstName, newIds }: { firstName: string; newIds: string[]; gender?: 'f' | 'm' | null }) {
  return (
    <div className="page">
      <h1 className="h1">הישגים</h1>
      <BadgesView firstName={firstName} newIds={newIds} />
    </div>
  );
}

export function BadgesView({ firstName, newIds = [], records }: { firstName: string; newIds?: string[]; records?: React.ReactNode }) {
  const [data, setData] = useState<Data | null>(null);
  const [showLocked, setShowLocked] = useState(false);
  const [open, setOpen] = useState<Badge | null>(null);
  const [story, setStory] = useState<Blob | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    api<Data>('/api/badges').then(setData);
  }, []);

  // Drawn as soon as a badge is opened: phones only open the share sheet straight from a tap.
  useEffect(() => {
    setStory(null);
    setNote(null);
    if (!open) return;
    let live = true;
    drawBadgeStory({ firstName, icon: open.icon, title: open.title, detail: open.detail, kind: open.kind })
      .then((b) => live && setStory(b))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [open, firstName]);

  if (!data) return null;
  return (
    <>
      <div className="card" style={{ gap: 10 }}>
        <div className="header">
          <h2 className="h2">אתגרים</h2>
          {data.streak > 0 && <span className="muted">🔥 {data.streak} שבועות ברצף</span>}
        </div>
        {data.challenges.map((c) => (
          <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="header" style={{ fontSize: 15 }}>
              <b>{c.title}</b>
              <span className="muted">
                {c.value.toLocaleString('he-IL')} / {c.target.toLocaleString('he-IL')} {c.unit}
              </span>
            </div>
            <div className="progress-track" role="progressbar" aria-label={c.title} aria-valuemin={0} aria-valuemax={c.target} aria-valuenow={c.value}>
              <span style={{ width: `${Math.min(100, (c.value / c.target) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ gap: 10 }}>
        <div className="header">
          <h2 className="h2">התגים שלי</h2>
          <span className="muted">{data.earned.length}</span>
        </div>
        {data.earned.length === 0 ? (
          <div className="muted">אחרי האימון הראשון שתרשמו, יופיע כאן התג הראשון.</div>
        ) : (
          <div className="badge-grid">
            {[...data.earned].sort((a, b) => Number(newIds.includes(b.id)) - Number(newIds.includes(a.id))).map((b) => (
              <button key={b.id} className={`badge kind-${b.kind}`} aria-pressed={open?.id === b.id} onClick={() => setOpen(open?.id === b.id ? null : b)}>
                {newIds.includes(b.id) && <span className="is-new">חדש</span>}
                <span className="icon" aria-hidden="true">{b.icon}</span>
                <b>{b.title}</b>
              </button>
            ))}
          </div>
        )}
        {data.locked && data.locked.length > 0 && (
          <>
            <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setShowLocked(!showLocked)}>
              {showLocked ? 'הסתרת התגים הבאים' : `עוד ${data.locked.length} תגים לפתוח`}
            </button>
            {showLocked && (
              <div className="badge-grid">
                {data.locked.map((b) => (
                  <div key={b.id} className="badge locked" aria-label={`${b.title}: ${b.hint}`}>
                    <span className="icon" aria-hidden="true">{b.icon}</span>
                    <b>{b.title}</b>
                    <span className="hint">{b.hint}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {open && (
          <div className="plan-notes" style={{ alignItems: 'center', textAlign: 'center' }}>
            <span style={{ fontSize: 40 }} aria-hidden="true">{open.icon}</span>
            <b style={{ fontSize: 17 }}>{open.title}</b>
            <span className="muted">{open.detail}</span>
            <span className="muted" style={{ fontSize: 13 }}>כל תג אפשר לשתף בסטורי, עם התמונה שלו.</span>
            <button className="btn" style={{ height: 44, fontSize: 16 }} disabled={!story} onClick={async () => {
              if (!story) return;
              const r = await shareStory(story);
              setNote(r === 'downloaded' ? 'התמונה ירדה למכשיר. אפשר להעלות אותה לסטורי מהגלריה.' : null);
            }}>
              <Icon name="share" /> שיתוף לסטורי
            </button>
            {note && <span className="muted">{note}</span>}
          </div>
        )}
      </div>
      {records}
      <ShareCards firstName={firstName} />
    </>
  );
}
