const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse YYYY-MM-DD as a local calendar date. Never uses UTC midnight. */
export function parseLocalDate(iso: string): Date {
  const m = ISO.exec(iso.trim());
  if (!m) throw new Error(`Invalid date: ${iso}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export function todayLocal(now = new Date()): string {
  return formatLocalDate(now);
}

export function isIsoDate(value: string): boolean {
  if (!ISO.test(value)) return false;
  const d = parseLocalDate(value);
  return formatLocalDate(d) === value;
}

export function addDays(iso: string, days: number): string {
  const d = parseLocalDate(iso);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

export function daysBetween(a: string, b: string): number {
  const ms = parseLocalDate(b).getTime() - parseLocalDate(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function yearOf(iso: string): number {
  return Number(iso.slice(0, 4));
}

export function monthOf(iso: string): number {
  return Number(iso.slice(5, 7));
}

export function dayOf(iso: string): number {
  return Number(iso.slice(8, 10));
}

/** month is 1-12. Day 31 in February becomes the last day of that month. */
export function clampDay(year: number, month: number, day: number): string {
  const last = new Date(year, month, 0).getDate();
  const d = Math.min(Math.max(day, 1), last);
  return formatLocalDate(new Date(year, month - 1, d));
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function addMonths(iso: string, count: number): string {
  const d = parseLocalDate(startOfMonth(iso));
  d.setMonth(d.getMonth() + count);
  return formatLocalDate(d);
}

export function endOfMonth(iso: string): string {
  const d = parseLocalDate(startOfMonth(iso));
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return formatLocalDate(d);
}

/** Accept ISO dates and US slash dates. ISO dates stay on the same calendar day. */
export function normalizeDate(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (ISO.test(raw.slice(0, 10)) && (raw.length === 10 || raw[10] === 'T')) {
    const iso = raw.slice(0, 10);
    return isIsoDate(iso) ? iso : null;
  }
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (slash) {
    const iso = `${slash[3]}-${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}`;
    return isIsoDate(iso) ? iso : null;
  }
  return null;
}
