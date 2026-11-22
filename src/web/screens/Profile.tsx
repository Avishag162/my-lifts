import { InstallCard } from '../install.tsx';
import { Icon } from '../ui-icons.tsx';
import { useState } from 'react';
import { IS_LOCAL, api, type Me } from '../api.ts';
import { InjuryCard } from '../Injury.tsx';

/** Optional: gender (for the wording of badges) and body weight (for the "x times bodyweight" badges). */
function CompareProfileCard({ me }: { me: Me }) {
  const [gender, setGender] = useState<'f' | 'm' | null>(me.gender ?? null);
  const [bw, setBw] = useState(me.bodyweight != null ? String(me.bodyweight) : '');
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function save(g: 'f' | 'm' | null, weight: string) {
    setError(null);
    setSaved(null);
    try {
      await api('/api/me/profile', { gender: g, bodyweight: weight.trim() ? weight.trim() : null });
      setSaved('נשמר');
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <div className="card" style={{ gap: 8 }}>
      <b>עליי</b>
      <div className="muted" style={{ fontSize: 13 }}>
        לא חובה. משקל הגוף פותח תגים כמו ״סקוואט במשקל הגוף״.
      </div>
      {(
      <div className="seg">
        {(
          [
            ['f', 'אישה'],
            ['m', 'גבר'],
          ] as const
        ).map(([g, label]) => (
          <button
            key={g}
            aria-pressed={gender === g}
            onClick={() => {
              const next = gender === g ? null : g;
              setGender(next);
              save(next, bw);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      )}
      <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        משקל גוף (לא חובה)
        <input
          className="input"
          style={{ width: 90, height: 40 }}
          inputMode="decimal"
          value={bw}
          placeholder="ק״ג"
          onChange={(e) => setBw(e.target.value)}
          onBlur={() => save(gender, bw)}
        />
      </label>
      {saved && <span className="muted">{saved}</span>}
      {error && <span style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</span>}
    </div>
  );
}

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

/** Day and month of the birthday, for a special badge for a workout on the day. */
function BirthdayCard({ me }: { me: Me }) {
  const [day, setDay] = useState(me.birthday ? String(Number(me.birthday.slice(3))) : '');
  const [month, setMonth] = useState(me.birthday ? String(Number(me.birthday.slice(0, 2))) : '');
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function save(d: string, m: string) {
    setDay(d);
    setMonth(m);
    setSaved(null);
    setError(null);
    if (!!d !== !!m) return;
    try {
      await api('/api/me/birthday', { birthday: d && m ? `${m.padStart(2, '0')}-${d.padStart(2, '0')}` : null });
      setSaved(d ? 'נשמר. אימון ביום ההולדת = תג מיוחד 🎂' : 'נמחק');
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <div className="card" style={{ gap: 8 }}>
      <b>יום הולדת 🎂</b>
      <div className="muted" style={{ fontSize: 13 }}>אימון ביום ההולדת = תג מיוחד. רק יום וחודש, בלי שנה.</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <select className="input" style={{ height: 44, flex: 1 }} aria-label="יום" value={day} onChange={(e) => save(e.target.value, month)}>
          <option value="">יום</option>
          {Array.from({ length: 31 }, (_, i) => (
            <option key={i} value={String(i + 1)}>
              {i + 1}
            </option>
          ))}
        </select>
        <select className="input" style={{ height: 44, flex: 2 }} aria-label="חודש" value={month} onChange={(e) => save(day, e.target.value)}>
          <option value="">חודש</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </select>
      </div>
      {saved && <span className="muted">{saved}</span>}
      {error && <span style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</span>}
    </div>
  );
}

/** Your name and password. Changing the password logs out every other device. */
function AccountCard({ me }: { me: Me }) {
  const [name, setName] = useState(me.name);
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function run(path: string, body: unknown, ok: string) {
    setMsg(null);
    setError(null);
    try {
      await api(path, body);
      setMsg(ok);
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <div className="card" style={{ gap: 8 }}>
      <b>{IS_LOCAL ? 'שם' : 'שם וסיסמה'}</b>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" style={{ height: 44, flex: 1 }} aria-label="שם" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-ghost" disabled={!name.trim() || name === me.name} onClick={() => run('/api/me/name', { name }, 'השם נשמר')}>
          שמירה
        </button>
      </div>
      {!IS_LOCAL && <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" style={{ height: 44, flex: 1 }} type="password" autoComplete="new-password" dir="ltr" placeholder="סיסמה חדשה" aria-label="סיסמה חדשה" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn-ghost" disabled={password.length < 6} onClick={() => run('/api/me/password', { password }, 'הסיסמה הוחלפה').then(() => setPassword(''))}>
          החלפה
        </button>
      </div>}
      {msg && <span className="muted">{msg}</span>}
      {error && <span style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</span>}
    </div>
  );
}

/** The on-device version keeps everything in this browser: a backup file guards against losing the phone or its data. */
function BackupCard() {
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setError(null);
    setMsg(null);
    try {
      const { exportBackup } = await import('../local/server.ts');
      const bytes = await exportBackup();
      const name = `my-lifts-${new Date().toISOString().slice(0, 10)}.db`;
      const file = new File([bytes as BlobPart], name, { type: 'application/octet-stream' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name }).catch((e) => {
          if (e?.name !== 'AbortError') throw e;
        });
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
      setMsg('הגיבוי מוכן. שמרו אותו בקבצים או בענן.');
    } catch (e: any) {
      setError(e?.message ?? 'הגיבוי נכשל');
    }
  }

  async function restore(file: File | undefined) {
    if (!file) return;
    setError(null);
    setMsg(null);
    if (!confirm('לשחזר מהגיבוי? כל מה שרשום עכשיו במכשיר יוחלף בתוכן הגיבוי.')) return;
    try {
      const { importBackup } = await import('../local/server.ts');
      await importBackup(new Uint8Array(await file.arrayBuffer()));
      location.reload();
    } catch (e: any) {
      setError(e?.message ?? 'השחזור נכשל');
    }
  }

  return (
    <div className="card" style={{ gap: 8 }}>
      <b>גיבוי</b>
      <span className="muted">האימונים שמורים רק במכשיר הזה. כדאי להוריד גיבוי מדי פעם, למקרה שהטלפון יוחלף או שנתוני האתר יימחקו.</span>
      <button className="btn-ghost" onClick={download}>הורדת גיבוי</button>
      <label className="btn-ghost" style={{ textAlign: 'center', cursor: 'pointer' }}>
        שחזור מגיבוי
        <input type="file" accept=".db,application/octet-stream" style={{ display: 'none' }} onChange={(e) => restore(e.target.files?.[0])} />
      </label>
      {msg && <span className="muted">{msg}</span>}
      {error && <span style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</span>}
    </div>
  );
}

export function ProfileScreen({ me, onLoggedOut }: { me: Me; onLoggedOut: () => void }) {
  const [busy, setBusy] = useState(false);

  async function logout(all: boolean) {
    setBusy(true);
    await api(all ? '/api/auth/logout-all' : '/api/auth/logout', {}).catch(() => {});
    onLoggedOut();
  }

  return (
    <div className="page">
      <h1 className="h1">פרופיל</h1>
      <div className="card">
        <h2 className="h2">{me.name}</h2>
        <div className="muted">{IS_LOCAL ? 'כל הנתונים שמורים במכשיר הזה בלבד.' : 'ההתחברות נשמרת במכשיר הזה ל-3 חודשים.'}</div>
      </div>
      <InjuryCard injury={me.injury ?? null} path="/api/me/injury" intro="יש לך פציעה או מגבלה? כתבו כאן כדי לזכור אותה." />
      <CompareProfileCard me={me} />
      <BirthdayCard me={me} />
      <AccountCard me={me} />
      <InstallCard />
      {IS_LOCAL && <BackupCard />}
      {!IS_LOCAL && (
        <>
          <button className="btn-ghost" onClick={() => logout(false)} disabled={busy}>
            <Icon name="logout" /> התנתקות
          </button>
          <button className="btn-ghost" onClick={() => logout(true)} disabled={busy}>
            <Icon name="logout" /> התנתקות מכל המכשירים
          </button>
        </>
      )}
    </div>
  );
}
