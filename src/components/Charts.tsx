import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Slice } from '../domain/assemble';
import { money, moneyTight } from '../lib/format';

export const ALLOCATION_PALETTE = [
  '#2dd4bf',
  '#5eead4',
  '#22d3ee',
  '#38bdf8',
  '#818cf8',
  '#a78bfa',
  '#f0abfc',
  '#cbd5e1',
  '#94a3b8',
];

export function AllocationChart({ data, label }: { data: Slice[]; label: string }) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  if (!data.length || total <= 0) {
    return <p className="px-2 py-10 text-center text-sm text-muted">Nothing to chart yet.</p>;
  }
  const radius = 42;
  const segments = data.reduce<Array<{ label: string; start: number; sweep: number }>>((items, slice) => {
    const sweep = (slice.value / total) * 360;
    const start = items.reduce((sum, item) => sum + item.sweep, -90);
    return [...items, { label: slice.label, start, sweep }];
  }, []);
  return (
    <div>
      <div className="relative mx-auto h-52 w-52">
        <svg viewBox="0 0 120 120" className="h-full w-full" role="img" aria-label={label}>
          {segments.map((segment, index) => {
            const color = ALLOCATION_PALETTE[index % ALLOCATION_PALETTE.length];
            if (segment.sweep >= 359.9) {
              return <circle key={segment.label} cx="60" cy="60" r={radius} fill="none" stroke={color} strokeWidth="14" />;
            }
            return (
              <path
                key={segment.label}
                d={ringSegment(60, 60, radius, segment.start, segment.sweep)}
                fill="none"
                stroke={color}
                strokeWidth="14"
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-wide text-muted">Total</span>
          <span className="num text-base font-semibold">{moneyTight(total)}</span>
        </div>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {data.map((slice, index) => (
          <li key={slice.label} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-muted">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ALLOCATION_PALETTE[index % ALLOCATION_PALETTE.length] }} />
              <span className="truncate">{slice.label}</span>
            </span>
            <span className="num shrink-0">{moneyTight(slice.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ringSegment(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number): string {
  const start = (startDeg * Math.PI) / 180;
  const end = ((startDeg + sweepDeg) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  const large = sweepDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

export function Sparkline({ points, label = 'Net worth trend' }: { points: { date: string; value: number }[]; label?: string }) {
  if (points.length < 2) {
    return <p className="text-xs text-muted">Not enough points for a trend yet.</p>;
  }
  const width = 320;
  const height = 72;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - ((point.value - min) / span) * (height - 8) - 4;
    return [x, y] as const;
  });
  const line = coords.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-16 w-full" role="img" aria-label={label}>
      <path d={area} fill="rgb(20 184 166 / 0.16)" />
      <path d={line} fill="none" stroke="#14b8a6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function BalanceChart({ points, floor }: { points: { date: string; balance: number }[]; floor: number | null }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points}>
          <XAxis dataKey="date" hide />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip formatter={(value) => money(Number(value ?? 0))} labelFormatter={(item) => String(item)} />
          <Area type="monotone" dataKey="balance" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.18} strokeWidth={2} isAnimationActive={false} />
          {floor != null ? (
            <Area type="monotone" dataKey={() => floor} stroke="#f5c16c" fill="none" strokeDasharray="4 4" isAnimationActive={false} />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
