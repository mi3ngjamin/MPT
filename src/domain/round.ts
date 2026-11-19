export const EPS = 1e-8;

export function r8(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1e8) / 1e8;
}

export function nearlyZero(n: number): boolean {
  return Math.abs(n) < EPS;
}
