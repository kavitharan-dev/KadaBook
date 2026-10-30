export function formatRs(amount: number) {
  return `Rs. ${Math.round(amount).toLocaleString('en-IN')}`;
}

export function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(ms: number) {
  return new Date(ms).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function daysFromNow(days: number) {
  return Date.now() + days * 24 * 60 * 60 * 1000;
}

export function startOfMonth(ms = Date.now()) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}
