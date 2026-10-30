import { isSameDay, startOfDay, sum } from './format';
import type { Expense, Sale } from '../data/types';

export type ChartBar = { key: string; label: string; value: number };

const DAY = 24 * 60 * 60 * 1000;

export function inRange(ts: number, start: number, end: number) {
  return ts >= start && ts < end;
}

export function periodRange(mode: 'daily' | 'weekly' | 'monthly', now = Date.now()) {
  const today = startOfDay(now);
  if (mode === 'daily') return { start: today, end: today + DAY };
  if (mode === 'weekly') return { start: today - 6 * DAY, end: today + DAY };
  const date = new Date(now);
  const start = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
  return { start, end };
}

export function changePercent(today: number, yesterday: number) {
  if (yesterday === 0) return today > 0 ? 100 : 0;
  return Math.round(((today - yesterday) / yesterday) * 100);
}

export function chartBars(
  sales: Sale[],
  mode: 'daily' | 'weekly' | 'monthly',
  now = Date.now(),
): ChartBar[] {
  if (mode === 'daily') {
    return Array.from({ length: 10 }, (_, index) => {
      const hour = 8 + index;
      const value = sum(
        sales.filter((sale) => {
          const date = new Date(sale.createdAt);
          return isSameDay(sale.createdAt, now) && date.getHours() === hour;
        }),
      );
      const labelHour = hour % 12 || 12;
      const suffix = hour >= 12 ? 'PM' : 'AM';
      const show = hour % 2 === 0;
      return { key: String(hour), label: show ? `${labelHour}${suffix}` : '', value };
    });
  }

  if (mode === 'weekly') {
    const today = startOfDay(now);
    return Array.from({ length: 7 }, (_, index) => {
      const day = today - (6 - index) * DAY;
      const value = sum(sales.filter((sale) => isSameDay(sale.createdAt, day)));
      const label = new Date(day).toLocaleDateString('en-GB', { weekday: 'short' });
      return { key: String(day), label, value };
    });
  }

  const { start, end } = periodRange('monthly', now);
  const bars: ChartBar[] = [];
  let cursor = start;
  let week = 1;
  while (cursor < end) {
    const next = Math.min(cursor + 7 * DAY, end);
    const value = sum(sales.filter((sale) => inRange(sale.createdAt, cursor, next)));
    bars.push({ key: String(cursor), label: `W${week}`, value });
    cursor = next;
    week += 1;
  }
  return bars;
}

export function periodExpenses(expenses: Expense[], mode: 'daily' | 'weekly' | 'monthly', now = Date.now()) {
  const { start, end } = periodRange(mode, now);
  return expenses.filter((expense) => inRange(expense.createdAt, start, end));
}
