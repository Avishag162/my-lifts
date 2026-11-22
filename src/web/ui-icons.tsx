// Line icons for buttons, tabs and chips (Arena Luxe design). 24×24, drawn with currentColor.
const PATHS = {
  plus: 'M12 8v8M8 12h8M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5z',
  chat: 'M4 5h16v11H9l-5 4zM8 9.5h8M8 12.5h5',
  check: 'M12 21.5a9.5 9.5 0 1 0 0-19a9.5 9.5 0 0 0 0 19zM7.5 12.5l3 3 6-6',
  feather: 'M20 4C11 4 6 9 6 18l-2 2M6 18c6 0 11-3 12-8h-5M9 15h6',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  fire: 'M12 22c4.5 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8 0 4 2.5 7 7 7z',
  share: 'M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7',
  calendar: 'M6 5h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3zM3 10h18M8 3v4M16 3v4',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  medal: 'M12 21a6 6 0 1 0 0-12a6 6 0 0 0 0 12zM8 3l4 6 4-6',
  pencil: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10',
  users: 'M9 11.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7zM2 20c.8-3.5 3.5-5 7-5s6.2 1.5 7 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.4 2.2 4 5',
  library: 'M12 5v15M3 5h9M12 5h9M5 5v14h7M19 5v14h-7',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, filled = false }: { name: IconName; size?: number; filled?: boolean }) {
  return (
    <svg className="ui-icon" width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
