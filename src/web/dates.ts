/** "2026-11-05" -> "5.11" */
export function fmtDay(date: string) {
  const [, m, d] = date.split('-');
  return `${Number(d)}.${Number(m)}`;
}
