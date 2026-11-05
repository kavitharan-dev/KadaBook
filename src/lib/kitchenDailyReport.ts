import type { Books } from '../data/types';
import type { BranchScope, KitchenData } from '../data/kitchenTypes';
import type { AttachedPeriodSummary, DayCloseSummary } from './dayClose';
import { formatTime, isSameDay, startOfDay } from './format';
import { branchReport, isSellable } from './kitchenOps';
import { itemKind } from './stockEngine';

function looksLikeStockPurchase(category: string) {
  const raw = (category ?? '').trim().toLowerCase();
  if (!raw) return false;
  if (raw === 'stock purchase' || raw === 'stock' || raw === 'stocks') return true;
  if (raw === 'supplier payment') return true;
  return raw.includes('stock purchase') || raw.includes('inventory');
}

export type KitchenStockRow = {
  name: string;
  unit: string;
  recv: number;
  sold: number;
  loss: number;
  left: number;
};

export type KitchenDayReportExtras = {
  branchName: string;
  /** Absolute fridge/count loss value (Rs). */
  stockLoss: number;
  /** Cost of goods sold for the day (incl. credit bills). */
  costOfSold: number;
  stockPurchaseNote?: string;
  stockRows: KitchenStockRow[];
};

function money(n: number) {
  return Math.round(Math.abs(n)).toLocaleString('en-IN').padStart(8);
}

function qty(n: number, unit: string) {
  const v = Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  return unit === 'g' || unit === 'ml' ? `${v}${unit}` : v;
}

function padName(name: string, width = 14) {
  const clean = name.length > width ? name.slice(0, width - 1) + '…' : name;
  return clean.padEnd(width);
}

/**
 * Burger-shop daily close text (thermal / WhatsApp), matching owner layout.
 * Credit is shown inside TOTAL SALES for kitchen shops.
 */
export function buildKitchenDayCloseReportText(
  shopName: string,
  summary: DayCloseSummary,
  kitchen: KitchenDayReportExtras,
  closedAt?: number | null,
) {
  const cash = summary.cashSales;
  const card = summary.cardSales;
  const credit = summary.creditSales;
  const totalSales = cash + card + credit;
  const gross = Math.round(totalSales - kitchen.costOfSold);
  const stockLoss = Math.round(kitchen.stockLoss);
  const net = Math.round(gross - stockLoss - summary.operatingExpenses);
  const drawer = summary.expectedCash;
  const dateLine = summary.dateLabel.replace(/^[^,]*,\s*/, '') || summary.dateLabel;

  const lines: string[] = [
    '═══════════════════════════════════════',
    `   DAILY REPORT        ${kitchen.branchName}`,
    `   Date: ${dateLine}`,
    `   ${shopName.trim() || 'Shop'}`,
    '═══════════════════════════════════════',
    '',
    '1) SALES',
    `   Cash sales .................. ${money(cash)}`,
    `   Card sales .................. ${money(card)}`,
    `   Credit sales ................ ${money(credit)}`,
    '   ─────────────────────────────────────',
    `   TOTAL SALES ................. ${money(totalSales)}`,
    '',
    '2) PROFIT',
    `   Total sales ................. ${money(totalSales)}`,
    `   − Cost of items sold ........ ${money(kitchen.costOfSold)}`,
    '   ─────────────────────────────────────',
    `   GROSS PROFIT ................ ${money(gross)}`,
    `   − Stock loss (fridge count) . ${stockLoss ? `−${money(stockLoss).trimStart()}` : money(0)}`,
    `   − Running expenses .......... ${money(summary.operatingExpenses)}`,
    '   ─────────────────────────────────────',
    `   NET PROFIT .................. ${money(net)}`,
    '',
    '3) CASH IN DRAWER',
    `   Opening cash ................ ${money(summary.openingCash)}`,
    `   + Cash sales ................ ${money(cash)}`,
    `   + Credit collected .......... ${money(summary.cashCollected)}`,
    `   − Cash expenses ............. ${money(summary.operatingExpenses)}`,
    `   − Cash stock purchase ....... ${money(summary.stockPurchase)}`,
    '   ─────────────────────────────────────',
    `   CASH IN DRAWER .............. ${money(drawer)}`,
  ];

  if (card > 0) {
    lines.push(`   (Card ${money(card).trim()} drawer-la illa)`);
  }

  lines.push(
    '',
    '4) STOCK PURCHASE (profit-la serkaadhu)',
    `   ${(kitchen.stockPurchaseNote || 'Kitchen stock').slice(0, 28).padEnd(28)} ${money(summary.stockPurchase)}`,
    '',
    '5) STOCK',
    '   Item          Recv  Sold  Loss  Left',
  );

  if (!kitchen.stockRows.length) {
    lines.push('   (no stock movement today)');
  } else {
    for (const row of kitchen.stockRows.slice(0, 40)) {
      const loss = row.loss > 0 ? qty(row.loss, row.unit) : '0';
      lines.push(
        `   ${padName(row.name)} ${qty(row.recv, row.unit).padStart(5)} ${qty(row.sold, row.unit).padStart(5)} ${loss.padStart(5)} ${qty(row.left, row.unit).padStart(5)}`,
      );
    }
  }

  lines.push('', '═══════════════════════════════════════');
  if (closedAt) {
    lines.push(`Closed at ${formatTime(closedAt)}`);
  }
  return lines.join('\n');
}

/** Build kitchen extras for today's close / daily report print. */
export function buildKitchenDayReportExtras(
  data: KitchenData,
  books: Books,
  scope: BranchScope,
  now = Date.now(),
): KitchenDayReportExtras {
  const start = startOfDay(now);
  const end = start + 86_400_000;
  const report = branchReport(data, books.sales, scope, start, end);
  const branchName =
    scope === 'all' ? 'All branches' : data.branches.find((b) => b.id === scope)?.name ?? 'Branch';

  const costOfSold = Math.round(
    books.sales
      .filter((s) => isSameDay(s.createdAt, now))
      .reduce((sum, s) => sum + (s.items ?? []).reduce((lines, l) => lines + (l.unitCost ?? 0) * l.qty, 0), 0),
  );

  const stockLoss = Math.round(
    report.rows.reduce((sum, row) => {
      if (row.adjustQty >= 0) return sum;
      return sum + Math.abs(row.adjustValue);
    }, 0),
  );

  const purchaseNotes = books.expenses
    .filter((e) => isSameDay(e.createdAt, now) && looksLikeStockPurchase(e.category))
    .map((e) => (e.note || e.category || '').trim())
    .filter(Boolean);
  const stockPurchaseNote = purchaseNotes.length
    ? [...new Set(purchaseNotes)].slice(0, 3).join(', ')
    : 'Kitchen stock';

  const stockRows: KitchenStockRow[] = report.rows
    .filter((r) => isSellable(r.item) || itemKind(r.item) === 'raw')
    .filter((r) => r.received || r.sold || r.adjustQty || r.remaining)
    .map((r) => ({
      name: r.item.name,
      unit: r.item.unit,
      recv: r.received,
      sold: r.sold,
      loss: r.adjustQty < 0 ? Math.abs(r.adjustQty) : 0,
      left: r.remaining,
    }));

  return { branchName, stockLoss, costOfSold, stockPurchaseNote, stockRows };
}

export type KitchenPeriodReportExtras = {
  branchName: string;
  costOfSold: number;
  stockLoss: number;
  stockPurchaseNote?: string;
};

/** Period kitchen money extras (week / month) for WhatsApp + print. */
export function buildKitchenPeriodReportExtras(
  data: KitchenData,
  books: Books,
  scope: BranchScope,
  range: { start: number; end: number },
): KitchenPeriodReportExtras {
  const report = branchReport(data, books.sales, scope, range.start, range.end);
  const branchName =
    scope === 'all' ? 'All branches' : data.branches.find((b) => b.id === scope)?.name ?? 'Branch';
  const costOfSold = Math.round(
    books.sales
      .filter((s) => s.createdAt >= range.start && s.createdAt < range.end)
      .reduce((sum, s) => sum + (s.items ?? []).reduce((lines, l) => lines + (l.unitCost ?? 0) * l.qty, 0), 0),
  );
  const stockLoss = Math.round(
    report.rows.reduce((sum, row) => (row.adjustQty < 0 ? sum + Math.abs(row.adjustValue) : sum), 0),
  );
  const purchaseNotes = books.expenses
    .filter((e) => e.createdAt >= range.start && e.createdAt < range.end && looksLikeStockPurchase(e.category))
    .map((e) => (e.note || e.category || '').trim())
    .filter(Boolean);
  return {
    branchName,
    costOfSold,
    stockLoss,
    stockPurchaseNote: purchaseNotes.length
      ? [...new Set(purchaseNotes)].slice(0, 3).join(', ')
      : 'Kitchen stock',
  };
}

function shortDay(dayKeyValue: string) {
  return new Date(`${dayKeyValue}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

/**
 * Kitchen weekly / monthly WhatsApp + print — same language as daily close.
 */
export function buildKitchenPeriodReportText(
  shopName: string,
  period: AttachedPeriodSummary,
  kitchen: KitchenPeriodReportExtras,
) {
  const isMonth = /month/i.test(period.title);
  const title = isMonth ? 'MONTHLY REPORT' : 'WEEKLY REPORT';
  const cash = period.days.reduce((sum, d) => sum + d.cashSales, 0);
  const card = period.days.reduce((sum, d) => sum + d.cardSales, 0);
  const credit = period.days.reduce((sum, d) => sum + d.creditSales, 0);
  const totalSales = cash + card + credit;
  const operating = period.weeklyOperating;
  const stockBuy = period.weeklyStockPurchase;
  const gross = Math.round(totalSales - kitchen.costOfSold);
  const net = Math.round(gross - kitchen.stockLoss - operating);

  const lines: string[] = [
    '═══════════════════════════════════════',
    `   ${title.padEnd(16)} ${kitchen.branchName}`,
    `   ${shopName.trim() || 'Shop'}`,
    `   ${period.rangeLabel}`,
    '═══════════════════════════════════════',
    '',
    '1) SALES',
    `   Cash sales .................. ${money(cash)}`,
    `   Card sales .................. ${money(card)}`,
    `   Credit sales ................ ${money(credit)}`,
    '   ─────────────────────────────────────',
    `   TOTAL SALES ................. ${money(totalSales)}`,
    '',
    '2) PROFIT',
    `   Total sales ................. ${money(totalSales)}`,
    `   − Cost of items sold ........ ${money(kitchen.costOfSold)}`,
    '   ─────────────────────────────────────',
    `   GROSS PROFIT ................ ${money(gross)}`,
    `   − Stock loss (fridge count) . ${
      kitchen.stockLoss ? `−${money(kitchen.stockLoss).trimStart()}` : money(0)
    }`,
    `   − Running expenses .......... ${money(operating)}`,
    '   ─────────────────────────────────────',
    `   NET PROFIT .................. ${money(net)}`,
    '',
    '3) STOCK PURCHASE (profit-la serkaadhu)',
    `   ${(kitchen.stockPurchaseNote || 'Kitchen stock').slice(0, 28).padEnd(28)} ${money(stockBuy)}`,
    '',
  ];

  if (isMonth) {
    lines.push('4) BY WEEK', '   Week  Dates               Sales      Net');
    for (const week of period.weeks) {
      const range = `${shortDay(week.startDayKey)}–${shortDay(week.endDayKey)}`;
      lines.push(`   W${week.weekIndex}   ${range.padEnd(18)} ${money(week.sales)}  ${money(week.final)}`);
    }
  } else {
    lines.push('4) BY DAY', '   Day                 Sales      Net');
    for (const day of period.days) {
      const label = shortDay(day.dayKey).padEnd(16);
      const daySales = day.cashSales + day.cardSales + day.creditSales;
      lines.push(`   ${label} ${money(daySales)}  ${money(day.netProfit)}`);
    }
  }

  lines.push('', '═══════════════════════════════════════');
  lines.push(isMonth ? 'Day detail: Reports → Daily / Close day.' : 'Full day: Home → Close day.');
  return lines.join('\n');
}
