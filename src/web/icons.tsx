// Simple line icons per body area, for exercises without a drawing.
const PATHS: Record<string, JSX.Element> = {
  legs: (
    <>
      <circle cx="20" cy="8" r="3" />
      <path d="M7 13h26M20 11v10l-6 6v8M20 21l6 6v8" />
    </>
  ),
  chest: (
    <>
      <path d="M4 30h32M10 30v5M30 30v5M8 27h20M18 27v-12M11 15h14" />
      <circle cx="6" cy="26" r="3" />
    </>
  ),
  back: (
    <>
      <circle cx="9" cy="12" r="3" />
      <path d="M12 14l13 6l3 14M25 20l-5 14M17 17v10M11 27h12" />
    </>
  ),
  glutes: (
    <>
      <circle cx="15" cy="9" r="3" />
      <path d="M15 12l2 12l-4 11M17 24l6 11M16 15l12 4" />
      <circle cx="31" cy="21" r="3.5" />
    </>
  ),
  shoulders: (
    <>
      <circle cx="20" cy="12" r="3" />
      <path d="M8 5v8M32 5v8M8 9h24M20 15v10l-5 10M20 25l5 10" />
    </>
  ),
  arms: (
    <>
      <path d="M10 30c0-8 4-14 10-14s6-6 4-9M24 7h8M28 4v6" />
      <path d="M10 30h14" />
    </>
  ),
  core: (
    <>
      <circle cx="8" cy="22" r="3" />
      <path d="M11 23h20l4 6M5 29h32" />
    </>
  ),
};

export function ExerciseIcon({ area, size = 36, color = '#7A4A7B' }: { area?: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[area ?? ''] ?? PATHS.legs}
    </svg>
  );
}

export function NavIcon({ name }: { name: 'workout' | 'history' | 'profile' | 'progress' | 'achievements' }) {
  const d = {
    workout: 'M4 12h16M7 8v8M17 8v8M4 10v4M20 10v4',
    history: 'M12 7v5l3 2M21 12a9 9 0 1 1-3-6.7M21 4v4h-4',
    profile: 'M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6',
    progress: 'M4 20h16M6 16l4-5l3 3l5-7M15 7h3v3',
    achievements: 'M8 3h8l-1 5a3 3 0 0 1-6 0zM12 13a4 4 0 1 0 0 8a4 4 0 0 0 0-8zM10 3l2 5l2-5',
  }[name];
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
