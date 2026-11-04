import type { BooksMeta } from '../data/types';

/** Local calendar date key YYYY-MM-DD for opening balance. */
export function dayKey(ms: number = Date.now()) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** The branch a day's cash belongs to. Null: the shop has no branches, so shop-wide values apply. */
export type DayBranch = { id: string; isMain: boolean; name?: string } | null;

type DayMeta = Pick<BooksMeta, 'openingBalances' | 'closedDays' | 'branchDays'>;

export function branchDayId(branchId: string, day: string) {
  return `${branchId}_${day}`;
}

function branchRow(meta: Partial<DayMeta>, branch: DayBranch | undefined, key: string) {
  return branch ? meta.branchDays?.[branchDayId(branch.id, key)] : undefined;
}

/** Shop-wide values were written before branches existed, so they belong to the main branch only. */
function readsShopWide(branch: DayBranch | undefined) {
  return !branch || branch.isMain;
}

function readOpening(meta: Partial<DayMeta>, ms: number, branch?: DayBranch): number | undefined {
  const key = dayKey(ms);
  const own = branchRow(meta, branch, key)?.opening;
  if (typeof own === 'number' && Number.isFinite(own)) return own;
  if (!readsShopWide(branch)) return undefined;
  const value = meta.openingBalances?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function openingBalanceForDay(meta: Partial<DayMeta>, ms: number = Date.now(), branch?: DayBranch) {
  return Math.round(readOpening(meta, ms, branch) ?? 0);
}

export function hasOpeningBalanceRecorded(meta: Partial<DayMeta>, ms: number = Date.now(), branch?: DayBranch) {
  return readOpening(meta, ms, branch) !== undefined;
}

export function dayClosedAt(meta: Partial<DayMeta>, ms: number = Date.now(), branch?: DayBranch) {
  const key = dayKey(ms);
  const row = branchRow(meta, branch, key);
  // A branch row that has been closed or resumed is the final word for that day.
  const value = row && row.closedAt !== undefined ? row.closedAt : readsShopWide(branch) ? meta.closedDays?.[key] : undefined;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

export function isDayClosed(meta: Partial<DayMeta>, ms: number = Date.now(), branch?: DayBranch) {
  return dayClosedAt(meta, ms, branch) !== null;
}
