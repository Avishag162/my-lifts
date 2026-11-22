import { useState } from 'react';
import { api } from './api.ts';

export interface Injury {
  text: string;
  at: string;
  by: string | null; // always null in this app
}

/** Shows an injury and lets it be written, changed or cleared. `path` is where it's saved. */
export function InjuryCard({ injury, path, intro, onSaved }: { injury: Injury | null; path: string; intro: string; onSaved?: (i: Injury | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(injury?.text ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cur, setCur] = useState(injury);

  async function save(value: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ injury: string | null }>(path, { text: value });
      const next = r.injury ? { text: r.injury, at: new Date().toISOString(), by: null } : null;
      setCur(next);
      setText(r.injury ?? '');
      setEditing(false);
      onSaved?.(next);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ gap: 8 }}>
      <h3 className="h2">פציעה או מגבלה</h3>
      {!editing && cur && (
        <div className="notice">
          <b>⚠ {cur.text}</b>
          <div style={{ fontSize: 13, marginTop: 2 }}>
            עודכן {new Date(cur.at).toLocaleDateString('he-IL')}
            {cur.by ? ` · על ידי ${cur.by}` : ''}
          </div>
        </div>
      )}
      {!editing && !cur && <div className="muted">{intro}</div>}
      {editing && (
        <>
          <textarea
            aria-label="פציעה או מגבלה"
            value={text}
            maxLength={300}
            placeholder="למשל: כאב בכתף ימין, בלי לחיצות מעל הראש"
            onChange={(e) => setText(e.target.value)}
          />
          {error && <div className="error-text">{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ flex: 1 }} disabled={busy || !text.trim()} onClick={() => save(text)}>
              שמירה
            </button>
            <button className="btn-ghost" disabled={busy} onClick={() => { setEditing(false); setText(cur?.text ?? ''); }}>
              ביטול
            </button>
          </div>
        </>
      )}
      {!editing && (
        <div style={{ display: 'flex', gap: 16 }}>
          <button className="link-btn" onClick={() => setEditing(true)}>
            {cur ? 'עדכון' : '+ הוספת פציעה'}
          </button>
          {cur && (
            <button className="link-btn" disabled={busy} onClick={() => save('')}>
              הפציעה עברה, למחוק
            </button>
          )}
        </div>
      )}
    </div>
  );
}
