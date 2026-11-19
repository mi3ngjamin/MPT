/** Full currency below $1M. Millions and above use $2.31M so phone cards do not overflow. */
export function moneyTight(value: number | null | undefined, signed = false): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${signPrefix(value, signed)}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${signPrefix(value, signed)}$${(abs / 1_000_000).toFixed(2)}M`;
  return money(value, signed);
}

function signPrefix(value: number, signed: boolean): string {
  if (value < 0) return '−';
  if (signed && value > 0) return '+';
  return '';
}

export function money(value: number | null | undefined, signed = false): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const formatted = value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (signed && value > 0) return `+${formatted}`;
  return formatted;
}

export function qty(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

export function pct(ratio: number | null | undefined, signed = false): string {
  if (ratio == null || !Number.isFinite(ratio)) return '—';
  const value = ratio * 100;
  const text = `${Math.abs(value).toFixed(1)}%`;
  if (value > 0) return signed ? `+${text}` : text;
  if (value < 0) return `−${text}`;
  return `0.0%`;
}

export function price(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: value >= 1000 ? 2 : 4,
  });
}

export function plClass(value: number | null | undefined): string {
  if (value == null || value === 0) return 'text-muted';
  return value > 0 ? 'text-gain' : 'text-loss';
}

export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'unknown time';
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return 'unknown time';
  const minutes = Math.round((now - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
