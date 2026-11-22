// Dates and times. Workouts are stored in UTC and shown in this time zone.
// Change TIME_ZONE if you live somewhere else (any IANA name, e.g. 'Europe/London').
export const TIME_ZONE = 'Asia/Jerusalem';

/** A local date (YYYY-MM-DD) and time (HH:MM) in TIME_ZONE, as an ISO string in UTC. */
export function localTimeToIso(date: string, time: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Offset of the time zone at that moment, found by formatting the guess there.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return new Date(guess - (asIfUtc - guess)).toISOString();
}
