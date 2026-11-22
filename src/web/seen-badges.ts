// Which earned badges the trainee has already seen, so a new one can be pointed out. Per device; a lost list just
// means no dot until the next new badge.
const KEY = 'seen-badges';

export function seenBadges(): Set<string> | null {
  try {
    const v = localStorage.getItem(KEY);
    return v ? new Set(JSON.parse(v) as string[]) : null;
  } catch {
    return null;
  }
}

export function saveSeenBadges(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // private mode: not remembered
  }
}

/** Earned badges not seen yet. The first time on a device everything counts as seen (no dot for old badges). */
export function newBadgeIds(earned: string[]): string[] {
  const seen = seenBadges();
  if (!seen) {
    saveSeenBadges(earned);
    return [];
  }
  return earned.filter((id) => !seen.has(id));
}
