import { useEffect, useState } from 'react';
import { LogoLarge } from '../Logo.tsx';
import { IS_LOCAL, api } from '../api.ts';

/** First run: choose a name and a password. After that: the password. */
export function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [setUp, setSetUp] = useState<boolean | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ setUp: boolean }>('/api/auth/status')
      .then((r) => setSetUp(r.setUp))
      .catch(() => setSetUp(true));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // On-device version: the data never leaves this phone, so no password to remember (a random one is stored).
    const pw = IS_LOCAL && !setUp ? crypto.randomUUID() : password;
    if (!setUp && !IS_LOCAL && password !== password2) return setError('הסיסמאות לא זהות');
    setBusy(true);
    try {
      await api(setUp ? '/api/auth/login' : '/api/auth/setup', setUp ? { password } : { name, password: pw });
      onLoggedIn();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (setUp === null) return <div className="app" />;
  return (
    <div className="app">
      <div className="page center">
        <LogoLarge />
        <h1 className="h1" style={{ textAlign: 'center' }}>{setUp ? 'ברוכים השבים' : 'יומן המשקלים האישי שלך'}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {setUp ? 'נכנסים עם הסיסמה שבחרתם.' : IS_LOCAL ? 'פעם ראשונה כאן: איך לקרוא לך? הכול נשמר רק במכשיר הזה.' : 'פעם ראשונה כאן: בוחרים שם וסיסמה. רק מי שיודע את הסיסמה יכול להיכנס.'}
        </p>
        <form className="card" onSubmit={submit}>
          {!setUp && (
            <div className="field">
              <label htmlFor="name">איך לקרוא לך?</label>
              <input id="name" className="input" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>
          )}
          {!(IS_LOCAL && !setUp) && <div className="field">
            <label htmlFor="password">סיסמה</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete={setUp ? 'current-password' : 'new-password'}
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus={setUp}
              required
            />
          </div>}
          {!setUp && !IS_LOCAL && (
            <div className="field">
              <label htmlFor="password2">שוב את הסיסמה</label>
              <input id="password2" className="input" type="password" autoComplete="new-password" dir="ltr" value={password2} onChange={(e) => setPassword2(e.target.value)} required />
            </div>
          )}
          {error && <div className="error" role="alert">{error}</div>}
          <button className="btn" disabled={busy || (!(IS_LOCAL && !setUp) && password.length < (setUp ? 1 : 6)) || (!setUp && !name.trim())}>
            {setUp ? 'כניסה' : 'מתחילים'}
          </button>
          {setUp ? (
            <div className="muted" style={{ fontSize: 13 }}>שכחתם? במחשב שמריץ את האפליקציה: <span dir="ltr">npm run reset-password -- 'new password'</span></div>
          ) : IS_LOCAL ? null : (
            <div className="muted" style={{ fontSize: 13 }}>לפחות 6 תווים.</div>
          )}
        </form>
      </div>
    </div>
  );
}
