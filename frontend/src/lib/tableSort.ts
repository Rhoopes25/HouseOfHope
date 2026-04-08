import type { SortDirection } from '@/hooks/useTableSortState';

export function compareText(a: string, b: string, dir: SortDirection): number {
  const n = a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
  return dir === 'asc' ? n : -n;
}

export const riskRank: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function compareRiskLevel(a: string, b: string, dir: SortDirection): number {
  const ra = riskRank[a] ?? -1;
  const rb = riskRank[b] ?? -1;
  const n = ra - rb;
  return dir === 'asc' ? n : -n;
}

/** Numeric sort for donation value (PHP amount or hours for time). */
export function compareDonationValue(
  a: { type: string; amount?: number; hours?: number },
  b: { type: string; amount?: number; hours?: number },
  dir: SortDirection,
): number {
  const va = a.type === 'time' ? a.hours ?? a.amount ?? 0 : a.amount ?? 0;
  const vb = b.type === 'time' ? b.hours ?? b.amount ?? 0 : b.amount ?? 0;
  const n = va - vb;
  return dir === 'asc' ? n : -n;
}
