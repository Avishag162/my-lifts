/** An exercise's technique cues, folded under one line so the workout screen stays calm. */
export function Cues({ cues }: { cues?: string[] }) {
  if (!cues?.length) return null;
  return (
    <details className="cues" style={{ fontSize: 13, marginTop: 4 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 500, color: 'var(--brand-ink)' }}>💡 דגשים לביצוע</summary>
      <ul style={{ margin: '6px 0 0', paddingInlineStart: 18, lineHeight: 1.5 }}>
        {cues.map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ul>
    </details>
  );
}
