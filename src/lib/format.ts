export function formatRs(amount: number) {
  return `Rs. ${Math.round(amount).toLocaleString('en-IN')}`;
}

export function formatDay(ts: number) {
  return new Date(ts).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(ts: number) {
  const date = new Date(ts);
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const hours = date.getHours();
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12.toString().padStart(2, '0')}:${minutes} ${suffix}`;
}

export function startOfDay(ts: number) {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function isSameDay(ts: number, day: number) {
  return startOfDay(ts) === startOfDay(day);
}

export function sum(rows: { amount: number }[]) {
  return rows.reduce((total, row) => total + row.amount, 0);
}
