import type { Expense, Sale } from '../data/types';
import { isStockPurchase } from './dayClose';
import { formatDay, formatRs, formatTime, sum } from './format';
import type { ChartBar } from './stats';

export function periodReportTitle(mode: 'daily' | 'weekly' | 'monthly') {
  if (mode === 'daily') return 'DAILY REPORT';
  if (mode === 'weekly') return 'WEEKLY REPORT';
  return 'MONTHLY REPORT';
}

export function buildPeriodReportText(options: {
  shopName: string;
  mode: 'daily' | 'weekly' | 'monthly';
  range: { start: number; end: number };
  sales: Sale[];
  expenses: Expense[];
  bars: ChartBar[];
  expenseLabel: (category: string) => string;
}) {
  const { shopName, mode, range, sales, expenses, bars, expenseLabel } = options;
  const salesTotal = sum(sales);
  const running = expenses.filter((e) => !isStockPurchase(e));
  const expenseTotal = sum(running);
  const purchaseTotal = sum(expenses) - expenseTotal;
  const cost = sales.reduce((total, s) => total + (s.items ?? []).reduce((lines, l) => lines + (l.unitCost ?? 0) * l.qty, 0), 0);
  const profit = Math.round(salesTotal - cost - expenseTotal);

  const periodLine =
    mode === 'daily'
      ? formatDay(range.start)
      : `${formatDay(range.start)} – ${formatDay(range.end - 1)}`;

  const lines: string[] = [
    shopName,
    periodReportTitle(mode),
    periodLine,
    `Printed: ${formatDay(Date.now())}`,
    '========================',
    `Total sales:    ${formatRs(salesTotal)}`,
    `Cost of sales:  ${formatRs(cost)}`,
    `Expenses:       ${formatRs(expenseTotal)}`,
    `Profit:         ${formatRs(profit)}`,
    `Stock bought:   ${formatRs(purchaseTotal)}`,
    `Sales count:    ${sales.length}`,
    `Expense count:  ${expenses.length}`,
    '------------------------',
    'SALES BREAKDOWN',
  ];

  const breakdown = bars.filter((b) => b.value > 0);
  if (breakdown.length === 0) {
    lines.push('(no sales in this period)');
  } else {
    for (const bar of breakdown) {
      const label = bar.label || bar.key;
      lines.push(`${label.padEnd(8)} ${formatRs(bar.value)}`);
    }
  }

  lines.push('------------------------', 'SALES LIST');
  if (sales.length === 0) {
    lines.push('(none)');
  } else {
    const sorted = [...sales].sort((a, b) => b.createdAt - a.createdAt);
    for (const sale of sorted.slice(0, 50)) {
      const inv = sale.invoiceNo ? `#${sale.invoiceNo}` : formatTime(sale.createdAt);
      lines.push(`${inv}  ${formatRs(sale.amount)}  ${formatTime(sale.createdAt)}`);
    }
    if (sales.length > 50) lines.push(`... +${sales.length - 50} more`);
  }

  lines.push('------------------------', 'EXPENSES');
  if (expenses.length === 0) {
    lines.push('(none)');
  } else {
    const sortedExp = [...expenses].sort((a, b) => b.createdAt - a.createdAt);
    for (const exp of sortedExp.slice(0, 40)) {
      lines.push(`${expenseLabel(exp.category)}  ${formatRs(exp.amount)}`);
    }
    if (expenses.length > 40) lines.push(`... +${expenses.length - 40} more`);
  }

  lines.push('========================');
  return lines.join('\n');
}
