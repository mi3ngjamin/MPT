import { chartMonthLabel } from '../domain/budget';

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
  dashed?: boolean;
}

export function MultiLineChart({
  labels,
  series,
  onSelect,
  valueLabel,
}: {
  labels: string[];
  series: ChartSeries[];
  onSelect?: (index: number) => void;
  valueLabel?: (value: number) => string;
}) {
  const finite = series.flatMap((item) => item.values.filter((value): value is number => value != null && Number.isFinite(value)));
  if (!labels.length || !finite.length) {
    return <p className="px-2 py-10 text-center text-sm text-muted">Nothing to chart yet.</p>;
  }
  const width = 640;
  const height = 220;
  const pad = { l: 52, r: 40, t: 12, b: 28 };
  const min = Math.min(0, ...finite);
  const max = Math.max(0, ...finite);
  const span = max - min || 1;
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const xAt = (index: number) => pad.l + (labels.length === 1 ? innerW / 2 : (index / (labels.length - 1)) * innerW);
  const yAt = (value: number) => pad.t + ((max - value) / span) * innerH;
  const zero = yAt(0);
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label="Budget trend">
        <line x1={pad.l} x2={width - pad.r} y1={zero} y2={zero} stroke="currentColor" strokeOpacity="0.2" />
        {series.map((item) => (
          <polyline
            key={item.key}
            fill="none"
            stroke={item.color}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={item.dashed ? '5 4' : undefined}
            points={item.values
              .map((value, index) => (value == null ? null : `${xAt(index).toFixed(1)},${yAt(value).toFixed(1)}`))
              .filter((point): point is string => point != null)
              .join(' ')}
          />
        ))}
        {labels.map((label, index) =>
          index % Math.ceil(labels.length / 6) === 0 ? (
            <text key={label} x={xAt(index)} y={height - 8} textAnchor="middle" fill="currentColor" opacity="0.55" fontSize="11">
              {chartMonthLabel(label)}
            </text>
          ) : null,
        )}
        {onSelect
          ? labels.map((label, index) => (
              <rect
                key={`${label}-hit`}
                x={xAt(index) - innerW / Math.max(labels.length, 1) / 2}
                y={pad.t}
                width={innerW / Math.max(labels.length, 1)}
                height={innerH}
                fill="transparent"
                onClick={() => onSelect(index)}
              >
                <title>{`${label}${valueLabel && series[0]?.values[index] != null ? `: ${valueLabel(series[0].values[index] as number)}` : ''}`}</title>
              </rect>
            ))
          : null}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
        {series.map((item) => (
          <li key={item.key} className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full" style={{ background: item.color, opacity: item.dashed ? 0.7 : 1 }} />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FlowBar({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((sum, slice) => sum + Math.max(slice.value, 0), 0);
  if (total <= 0) return <p className="text-sm text-muted">No outflows in this period.</p>;
  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full bg-panel-2" role="img" aria-label="Where money went">
        {slices.map((slice) => (
          <div key={slice.label} style={{ width: `${(Math.max(slice.value, 0) / total) * 100}%`, background: slice.color }} title={`${slice.label} ${slice.value.toFixed(2)}`} />
        ))}
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {slices.map((slice) => (
          <li key={slice.label} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-muted">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
              <span className="truncate">{slice.label}</span>
            </span>
            <span className="num shrink-0">{slice.value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
