import { useState } from 'react';
import { fmtDay } from './dates.ts';
import { fmtKg } from './screens/Log.tsx';

export interface ChartPoint {
  date: string; // YYYY-MM-DD
  value: number;
  detail?: string; // shown when the point is tapped, e.g. the sets
}

/** One value per workout over time. An optional period is shaded (e.g. "stuck"). Tap a point for its details. */
export function LineChart({
  points,
  label,
  unit,
  shadeFrom = null,
  shadeLabel,
}: {
  points: ChartPoint[];
  label: string;
  unit: string;
  shadeFrom?: string | null;
  shadeLabel?: string;
}) {
  const W = 320;
  const H = 150;
  const pad = { l: 34, r: 14, t: 14, b: 22 };
  const [active, setActive] = useState<number | null>(null);

  const data = points;
  const t = data.map((p) => new Date(p.date + 'T12:00:00').getTime());
  const t0 = Math.min(...t);
  const t1 = Math.max(...t);
  const wMin = Math.min(...data.map((p) => p.value));
  const wMax = Math.max(...data.map((p) => p.value));
  const span = Math.max(wMax - wMin, 5);
  const yLo = Math.max(0, Math.floor((wMin - span * 0.25) / 2.5) * 2.5);
  const yHi = Math.ceil((wMax + span * 0.25) / 2.5) * 2.5;
  // RTL app, but time still runs left to right on the chart, like the dates under it.
  const x = (ms: number) => pad.l + (t1 === t0 ? 0.5 : (ms - t0) / (t1 - t0)) * (W - pad.l - pad.r);
  const y = (w: number) => pad.t + (1 - (w - yLo) / (yHi - yLo)) * (H - pad.t - pad.b);
  const ticks = [yLo, Math.round((yLo + yHi) / 2 / 2.5) * 2.5, yHi];
  const path = data.map((p, i) => `${i ? 'L' : 'M'}${x(t[i]).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const shadeX = shadeFrom ? x(Math.max(t0, new Date(shadeFrom + 'T12:00:00').getTime())) : null;
  const a = active != null ? data[active] : null;

  function nearest(clientX: number, rect: DOMRect) {
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    t.forEach((ms, i) => {
      if (Math.abs(x(ms) - px) < Math.abs(x(t[best]) - px)) best = i;
    });
    setActive(best);
  }

  return (
    <div style={{ position: 'relative' }} dir="ltr">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`${label}, מ-${fmtKg(data[0].value)} עד ${fmtKg(data[data.length - 1].value)} ${unit}`}
        onPointerMove={(e) => nearest(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerDown={(e) => nearest(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setActive(null)}
        style={{ touchAction: 'pan-y', display: 'block' }}
      >
        {shadeX != null && (
          <g>
            <rect x={shadeX} y={pad.t} width={W - pad.r - shadeX} height={H - pad.t - pad.b} fill="var(--warn-soft)" />
            <text x={W - pad.r - 4} y={pad.t + 12} textAnchor="end" fontSize="11" fill="var(--warn)">
              {shadeLabel}
            </text>
          </g>
        )}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line-soft)" strokeWidth="1" />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
              {fmtKg(v)}
            </text>
          </g>
        ))}
        <text x={pad.l} y={H - 6} fontSize="11" fill="var(--muted)">
          {fmtDay(data[0].date)}
        </text>
        <text x={W - pad.r} y={H - 6} fontSize="11" fill="var(--muted)" textAnchor="end">
          {fmtDay(data[data.length - 1].date)}
        </text>
        {a && <line x1={x(t[active!])} x2={x(t[active!])} y1={pad.t} y2={H - pad.b} stroke="var(--muted)" strokeWidth="1" strokeDasharray="3 3" />}
        <path d={path} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((p, i) => (
          <circle key={i} cx={x(t[i])} cy={y(p.value)} r={i === active ? 5 : 4} fill="var(--brand)" stroke="var(--card)" strokeWidth="2" />
        ))}
      </svg>
      {a && (
        <div className="chart-tip" style={{ left: `${(x(t[active!]) / W) * 100}%` }} role="status">
          <b>{fmtDay(a.date)}</b> · {fmtKg(a.value)} {unit}
          {a.detail && (
            <div className="muted" style={{ fontSize: 12 }}>
              {a.detail}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
