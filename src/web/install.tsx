import { useEffect, useState } from 'react';
import { asset } from './asset.ts';

// Chrome/Android offers its own install dialog; we keep the event so a button can open it.
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();

export function setupInstall() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register(asset('/sw.js')).catch(() => {});
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export function isInstalled(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const DISMISS_KEY = 'install-dismissed';
function dismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * "Add to home screen": a button where the browser can install directly (Android), otherwise the steps
 * (iPhone: Share, then Add to Home Screen). `dismissible` shows a close button and hides it for good once closed.
 */
export function InstallCard({ dismissible = false }: { dismissible?: boolean }) {
  const [, setTick] = useState(0);
  const [hidden, setHidden] = useState(() => isInstalled() || (dismissible && dismissed()));
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  if (hidden || isInstalled()) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const r = await deferred.userChoice.catch(() => null);
    if (r?.outcome === 'accepted') setHidden(true);
    deferred = null;
  }
  function close() {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // private mode: it just shows again next time
    }
    setHidden(true);
  }

  return (
    <div className="card install-card" style={{ gap: 8 }}>
      <div className="header">
        <h3 className="h2">📲 האפליקציה במסך הבית</h3>
        {dismissible && (
          <button className="set-remove" aria-label="סגירה" onClick={close}>
            ✕
          </button>
        )}
      </div>
      <div className="muted">ככה פותחים אותה בלחיצה אחת, כמו כל אפליקציה, בלי לחפש את הקישור.</div>
      {deferred ? (
        <button className="btn" onClick={install}>
          הוספה למסך הבית
        </button>
      ) : isIos() ? (
        <ol className="install-steps">
          <li>
            לוחצים על כפתור השיתוף <ShareIcon /> בתחתית Safari
          </li>
          <li>בוחרים "הוספה למסך הבית"</li>
          <li>לוחצים "הוסף"</li>
        </ol>
      ) : (
        <ol className="install-steps">
          <li>פותחים את התפריט של הדפדפן (⋮)</li>
          <li>בוחרים "הוספה למסך הבית" או "התקנת אפליקציה"</li>
        </ol>
      )}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="שיתוף" style={{ verticalAlign: '-3px' }}>
      <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}
