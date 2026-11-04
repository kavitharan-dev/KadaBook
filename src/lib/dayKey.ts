/** Local calendar date key YYYY-MM-DD for opening balance. */
export function dayKey(ms: number = Date.now()) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function openingBalanceForDay(meta: { openingBalances?: Record<string, number> }, ms: number = Date.now()) {
  const key = dayKey(ms);
  const value = meta.openingBalances?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0;
}

export function hasOpeningBalanceRecorded(meta: { openingBalances?: Record<string, number> }, ms: number = Date.now()) {
  const key = dayKey(ms);
  return Object.prototype.hasOwnProperty.call(meta.openingBalances ?? {}, key);
}

export function isDayClosed(meta: { closedDays?: Record<string, number> }, ms: number = Date.now()) {
  const key = dayKey(ms);
  const value = meta.closedDays?.[key];
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function dayClosedAt(meta: { closedDays?: Record<string, number> }, ms: number = Date.now()) {
  const key = dayKey(ms);
  const value = meta.closedDays?.[key];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}
