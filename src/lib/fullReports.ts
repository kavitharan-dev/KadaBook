import type { Expense, Product, Sale } from '../data/types';
import { isStockPurchase } from './dayClose';

export type ItemRow = {
  key: string;
  name: string;
  qty: number;
  revenue: number;
  /** Cost of what was sold: the cost frozen on the bill line, else the product's purchase price. */
  cost: number;
  profit: number;
  marginPercent: number;
  costKnown: boolean;
};

/**
 * Per-item sales for bills with items. The bill discount is shared across its lines
 * by value, so item revenue adds up to what was actually charged.
 */
export function itemReport(sales: Sale[], products: Product[]): ItemRow[] {
  const rows = new Map<string, ItemRow>();
  for (const sale of sales) {
    if (!sale.items?.length) continue;
    const gross = sale.items.reduce((sum, l) => sum + l.lineTotal, 0);
    const factor = gross > 0 ? sale.amount / gross : 1;
    for (const line of sale.items) {
      const key = line.productId ?? `name:${line.name.toLowerCase()}`;
      const product = line.productId ? products.find((p) => p.id === line.productId) : undefined;
      const unitCost = line.unitCost ?? product?.purchasePrice ?? 0;
      const row = rows.get(key) ?? {
        key,
        name: product?.name ?? line.name,
        qty: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        marginPercent: 0,
        costKnown: unitCost > 0,
      };
      row.qty += line.qty;
      row.revenue += line.lineTotal * factor;
      row.cost += unitCost * line.qty;
      rows.set(key, row);
    }
  }
  return [...rows.values()].map((r) => {
    const revenue = Math.round(r.revenue);
    const cost = Math.round(r.cost);
    const profit = revenue - cost;
    return { ...r, revenue, cost, profit, marginPercent: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0 };
  });
}

export function expenseBreakdown(expenses: Expense[]) {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const by = new Map<string, number>();
  for (const e of expenses) by.set(e.category, (by.get(e.category) ?? 0) + e.amount);
  return [...by.entries()]
    .map(([category, amount]) => ({ category, amount, percent: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

/** `expenses` are running costs; `purchases` are stock bought, shown apart and never taken off profit. */
export type MonthRow = { key: string; label: string; sales: number; expenses: number; purchases: number; profit: number; bills: number };

/** The last `count` calendar months, newest first. */
export function monthlyReport(sales: Sale[], expenses: Expense[], count = 6, now = Date.now()): MonthRow[] {
  const d = new Date(now);
  const out: MonthRow[] = [];
  for (let i = 0; i < count; i += 1) {
    const start = new Date(d.getFullYear(), d.getMonth() - i, 1).getTime();
    const end = new Date(d.getFullYear(), d.getMonth() - i + 1, 1).getTime();
    const inMonth = <T extends { createdAt: number }>(rows: T[]) => rows.filter((r) => r.createdAt >= start && r.createdAt < end);
    const s = inMonth(sales);
    const e = inMonth(expenses);
    const salesTotal = s.reduce((sum, r) => sum + r.amount, 0);
    const running = e.filter((r) => !isStockPurchase(r));
    const expenseTotal = running.reduce((sum, r) => sum + r.amount, 0);
    const cost = s.reduce((sum, r) => sum + (r.items ?? []).reduce((lines, l) => lines + (l.unitCost ?? 0) * l.qty, 0), 0);
    out.push({
      key: `${new Date(start).getFullYear()}-${new Date(start).getMonth()}`,
      label: new Date(start).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
      sales: salesTotal,
      expenses: expenseTotal,
      purchases: e.reduce((sum, r) => sum + r.amount, 0) - expenseTotal,
      profit: Math.round(salesTotal - cost - expenseTotal),
      bills: s.length,
    });
  }
  return out;
}
