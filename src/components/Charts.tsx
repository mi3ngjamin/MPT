import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Area, AreaChart, XAxis, YAxis } from 'recharts';
import { money } from '../lib/format';
import type { Slice } from '../domain/assemble';

const PALETTE = ['#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', '#67e8f9', '#94a3b8'];

export function AllocationChart({ data, label }: { data: Slice[]; label: string }) {
  if (!data.length) {
    return <p className="px-2 py-10 text-center text-sm text-muted">Nothing to chart yet.</p>;
  }
  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" innerRadius={58} outerRadius={84} paddingAngle={2} stroke="none">
            {data.map((slice, index) => (
              <Cell key={slice.label} fill={PALETTE[index % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => money(Number(value ?? 0))} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="mt-2 space-y-1 text-sm">
        {data.map((slice, index) => (
          <li key={slice.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[index % PALETTE.length] }} />
              {slice.label}
            </span>
            <span className="num">{money(slice.value)}</span>
          </li>
        ))}
      </ul>
      <p className="sr-only">{label}</p>
    </div>
  );
}

export function BalanceChart({ points, floor }: { points: { date: string; balance: number }[]; floor: number | null }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={points}>
        <XAxis dataKey="date" hide />
        <YAxis hide domain={['auto', 'auto']} />
        <Tooltip formatter={(value) => money(Number(value ?? 0))} labelFormatter={(label) => String(label)} />
        <Area type="monotone" dataKey="balance" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.18} strokeWidth={2} />
        {floor != null ? <Area type="monotone" dataKey={() => floor} stroke="#f5c16c" fill="none" strokeDasharray="4 4" /> : null}
      </AreaChart>
    </ResponsiveContainer>
  );
}
