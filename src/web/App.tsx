import { useCallback, useEffect, useState } from 'react';
import { BrandBar } from './Logo.tsx';
import { ApiError, api, type Me } from './api.ts';
import { NavIcon } from './icons.tsx';
import { MyProgressScreen } from './screens/MyProgress.tsx';
import { AchievementsScreen } from './screens/Badges.tsx';
import { newBadgeIds, saveSeenBadges } from './seen-badges.ts';
import { LoginScreen } from './screens/Login.tsx';
import { LogScreen } from './screens/Log.tsx';
import { OnboardingScreen } from './screens/Onboarding.tsx';
import { ProfileScreen } from './screens/Profile.tsx';

type Tab = 'workout' | 'progress' | 'achievements' | 'profile';

export function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('workout');
  const [progressId, setProgressId] = useState<number | null>(null);
  const [progressFromLog, setProgressFromLog] = useState(false);
  // Badges earned since the trainee last opened the achievements tab: a dot on the tab, "חדש" on the badge.
  const [newIds, setNewIds] = useState<string[]>([]);
  const [shownNew, setShownNew] = useState<string[]>([]);

  const loadMe = useCallback(async () => {
    try {
      setMe(await api<Me>('/api/me'));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setMe(null);
      else setMe(null);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);
  const trainee = !!me;
  useEffect(() => {
    if (!trainee) return;
    api<{ earned: { id: string }[] }>('/api/badges')
      .then((b) => {
        const earned = b.earned.map((x) => x.id);
        if (tab === 'achievements') {
          setShownNew((cur) => [...new Set([...cur, ...newBadgeIds(earned)])]);
          saveSeenBadges(earned);
          setNewIds([]);
        } else setNewIds(newBadgeIds(earned));
      })
      .catch(() => {});
  }, [tab, trainee]);

  if (me === undefined) return <div className="app" />;
  if (me === null) return <LoginScreen onLoggedIn={loadMe} />;
  if (!me.onboarded) return <OnboardingScreen me={me} onDone={() => setMe({ ...me, onboarded: true })} />;

  return (
    <div className="app">
      <BrandBar />
      {tab === 'workout' && (
        <LogScreen
          me={me}
          onOpenProgress={(id) => { setProgressId(id); setProgressFromLog(true); setTab('progress'); }}
          onOpenMyProgress={() => setTab('progress')}
        />
      )}
      {tab === 'progress' && (
        <MyProgressScreen
          exerciseId={progressId}
          onOpenExercise={(id) => {
            setProgressId(id);
            if (id == null && progressFromLog) setTab('workout');
            setProgressFromLog(false);
          }}
          onGoAchievements={() => setTab('achievements')}
        />
      )}
      {tab === 'achievements' && <AchievementsScreen firstName={me.firstName} newIds={shownNew} gender={me.gender} />}
      {tab === 'profile' && <ProfileScreen me={me} onLoggedOut={() => setMe(null)} />}
      <nav className="nav nav-4" aria-label="ניווט ראשי">
        {(
          [
            ['workout', 'אימון'],
            ['progress', 'ההתקדמות שלי'],
            ['achievements', 'הישגים'],
            ['profile', 'פרופיל'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            aria-current={tab === key ? 'page' : undefined}
            aria-label={key === 'achievements' && newIds.length ? `${label}, ${newIds.length} חדשים` : undefined}
            onClick={() => { setTab(key); setProgressId(null); setProgressFromLog(false); if (key !== 'achievements') setShownNew([]); }}
          >
            <NavIcon name={key} />
            {key === 'achievements' && newIds.length > 0 && <span className="new-dot" aria-hidden="true" />}
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
