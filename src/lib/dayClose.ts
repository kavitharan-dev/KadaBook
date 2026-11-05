import { Linking, Share } from 'react-native';
import type { Books, Expense, Product, Sale, SaleLine } from '../data/types';
import { formatRs, formatTime, isSameDay } from './format';
import { dayKey, openingBalanceForDay } from './dayKey';
import {
  buildKitchenDayCloseReportText,
  type KitchenDayReportExtras,
} from './kitchenDailyReport';
import { printTextReport, type PrintResult } from './printReceipt';

export type { KitchenDayReportExtras, KitchenStockRow } from './kitchenDailyReport';

export const DEFAULT_QUICK_SALE_PROFIT_PERCENT = 10;
export const STOCK_PURCHASE_CATEGORY = 'Stock Purchase';

/**
 * Daily report formulas (V1):
 *
 * cashSales       = productSales + quickSales − (card portion already split)
 *   Actually: product/quick totals exclude credit; card is a slice of non-credit sales.
 * totalSales      = productSales + quickSales          (credit sales excluded)
 * quickProfit     = round(quickSales × quick% / 100)   (default 10%)
 * grossProfit     = productProfit + quickProfit
 * operatingExp    = expenses that are NOT stock purchase
 * stockPurchase   = stock purchases and supplier payments (aliases matched)
 * totalExpenses   = operatingExp + stockPurchase
 * netProfit       = grossProfit − operatingExp         (cost is already in product profit)
 * expectedCash    = openingCash + cashSales + cash collected on credit
 *                   − totalExpenses (all paid in cash)  (card never reaches the drawer)
 */
export type DayCloseSummary = {
  dayKey: string;
  dateLabel: string;
  openingCash: number;
  productSales: number;
  quickSales: number;
  cardSales: number;
  /** Non-credit product + quick (includes card). */
  totalSales: number;
  /** Non-credit cash (not card) sales for drawer. */
  cashSales: number;
  creditSales: number;
  /** Every credit payment taken today, cash and card. */
  creditCollected: number;
  /** The part of it that went into the drawer: cash payments, plus cash taken on credit bills. */
  cashCollected: number;
  stockPurchase: number;
  operatingExpenses: number;
  totalExpenses: number;
  productProfit: number;
  quickProfit: number;
  quickProfitPercent: number;
  grossProfit: number;
  netProfit: number;
  expectedCash: number;
  productSaleCount: number;
  quickSaleCount: number;
  creditSaleCount: number;
  saleCount: number;
  expenseCount: number;
  /** Aliases used by older UI / weekly rollups. */
  opening: number;
  todaySales: number;
  expenses: number;
  cashBalance: number;
  finalProfit: number;
};

function isCreditSale(sale: Sale) {
  return sale.paymentMode === 'credit' || sale.settled === false;
}

function isCardSale(sale: Sale) {
  return sale.paymentMode === 'card';
}

function isProductSale(sale: Sale) {
  return sale.kind === 'bill' || (sale.items?.length ?? 0) > 0;
}

/** Stock Purchase + common aliases (Tamil/English typos shops use). */
export function isStockPurchase(expense: Expense) {
  const raw = (expense.category ?? '').trim().toLowerCase();
  if (!raw) return false;
  if (raw === STOCK_PURCHASE_CATEGORY.toLowerCase()) return true;
  if (raw === 'stock' || raw === 'stocks' || raw === 'stock buy' || raw === 'stockbuy') return true;
  // Paying a supplier settles stock already bought: it is not a running cost either.
  if (raw === 'supplier payment') return true;
  if (raw.includes('stock purchase') || raw.includes('stockpurchase')) return true;
  if (raw.includes('inventory') || raw.includes('goods purchase')) return true;
  return false;
}

export function resolveQuickSaleProfitPercent(meta: { quickSaleProfitPercent?: number } | undefined) {
  const value = meta?.quickSaleProfitPercent;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(100, Math.max(0, Math.round(value)));
  }
  return DEFAULT_QUICK_SALE_PROFIT_PERCENT;
}

function lineSell(line: SaleLine) {
  return Math.round(line.lineTotal) || Math.round(line.unitPrice * line.qty) || 0;
}

/**
 * Prefer unitCost frozen on the sale line; fall back to current product purchasePrice
 * for older bills that pre-date cost snapshots.
 */
export function productProfitForSale(sale: Sale, products: Product[]) {
  const items = sale.items ?? [];
  if (!items.length) return 0;
  let profit = 0;
  for (const line of items) {
    const qty = Number(line.qty) || 0;
    let costEach = 0;
    if (line.unitCost != null && Number.isFinite(line.unitCost) && line.unitCost >= 0) {
      costEach = line.unitCost;
    } else {
      const product = line.productId ? products.find((row) => row.id === line.productId) : undefined;
      costEach = product ? Math.round(product.purchasePrice) || 0 : 0;
    }
    profit += lineSell(line) - costEach * qty;
  }
  return Math.round(profit);
}

export function buildDayCloseSummary(books: Books, ms: number = Date.now()): DayCloseSummary {
  const daySales = books.sales.filter((sale) => isSameDay(sale.createdAt, ms));
  const dayExpenses = books.expenses.filter((expense) => isSameDay(expense.createdAt, ms));
  const dayCreditPayments = (books.creditPayments ?? []).filter((row) => isSameDay(row.createdAt, ms));
  const openingCash = openingBalanceForDay(books.meta, ms);
  const quickProfitPercent = resolveQuickSaleProfitPercent(books.meta);

  let productSales = 0;
  let quickSales = 0;
  let cardSales = 0;
  let creditSales = 0;
  let productProfit = 0;
  let productSaleCount = 0;
  let quickSaleCount = 0;
  let creditSaleCount = 0;
  let paidOnCreditBills = 0;

  for (const sale of daySales) {
    const amount = Math.round(sale.amount) || 0;
    if (isProductSale(sale)) {
      productProfit += productProfitForSale(sale, books.products);
    }
    if (isCreditSale(sale)) {
      creditSales += amount;
      creditSaleCount += 1;
      paidOnCreditBills += Math.round(sale.paidAmount ?? 0) || 0;
      continue;
    }
    if (isCardSale(sale)) cardSales += amount;
    if (isProductSale(sale)) {
      productSales += amount;
      productSaleCount += 1;
    } else {
      quickSales += amount;
      quickSaleCount += 1;
    }
  }

  let stockPurchase = 0;
  let operatingExpenses = 0;
  for (const expense of dayExpenses) {
    const amount = Math.round(expense.amount) || 0;
    if (isStockPurchase(expense)) stockPurchase += amount;
    else operatingExpenses += amount;
  }
  const totalExpenses = stockPurchase + operatingExpenses;
  const creditCollected = dayCreditPayments.reduce((sum, row) => sum + (Math.round(row.amount) || 0), 0);
  const cashCollected =
    dayCreditPayments.filter((row) => row.method === 'cash').reduce((sum, row) => sum + (Math.round(row.amount) || 0), 0) +
    paidOnCreditBills;

  const totalSales = productSales + quickSales;
  const cashSales = Math.max(0, totalSales - cardSales);
  const quickProfit = Math.round((quickSales * quickProfitPercent) / 100);
  const grossProfit = productProfit + quickProfit;
  const netProfit = grossProfit - operatingExpenses;
  const expectedCash = openingCash + cashSales + cashCollected - totalExpenses;
  const d = new Date(ms);

  return {
    dayKey: dayKey(ms),
    dateLabel: d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }),
    openingCash,
    productSales,
    quickSales,
    cardSales,
    totalSales,
    cashSales,
    creditSales,
    creditCollected,
    cashCollected,
    stockPurchase,
    operatingExpenses,
    totalExpenses,
    productProfit,
    quickProfit,
    quickProfitPercent,
    grossProfit,
    netProfit,
    expectedCash,
    productSaleCount,
    quickSaleCount,
    creditSaleCount,
    saleCount: daySales.length,
    expenseCount: dayExpenses.length,
    opening: openingCash,
    todaySales: totalSales,
    expenses: totalExpenses,
    cashBalance: expectedCash,
    finalProfit: netProfit,
  };
}

function signedProfitLabel(netProfit: number) {
  if (netProfit < 0) return `Net loss             − ${formatRs(Math.abs(netProfit))}`;
  return `Net profit           ${formatRs(netProfit)}`;
}

export function buildDayCloseReportText(
  shopName: string,
  summary: DayCloseSummary,
  closedAt?: number | null,
  kitchen?: KitchenDayReportExtras | null,
) {
  if (kitchen) {
    return buildKitchenDayCloseReportText(shopName, summary, kitchen, closedAt);
  }
  const generated = new Date();
  const lines = [
    'KadaBook — Daily report',
    `${shopName.trim() || 'Shop'} · ${summary.dateLabel}`,
    '',
    '— Sales —',
    `Product sales        ${formatRs(summary.productSales)}`,
    `Quick sales          ${formatRs(summary.quickSales)}`,
    `Total sales          ${formatRs(summary.totalSales)}`,
    `  (of which card     ${formatRs(summary.cardSales)})`,
    `Cash sales (drawer)  ${formatRs(summary.cashSales)}`,
    '',
    '— Credit (not included above) —',
    `Credit sales         ${formatRs(summary.creditSales)}`,
    `Credit collected     ${formatRs(summary.creditCollected)}`,
    '',
    '— Expenses —',
    `Running expenses     ${formatRs(summary.operatingExpenses)}`,
    `Stock purchases      ${formatRs(summary.stockPurchase)}`,
    '  (stock is not taken off profit: its cost is in product profit)',
    '',
    '— Profit —',
    `Product profit       ${formatRs(summary.productProfit)}`,
    `Quick profit (${summary.quickProfitPercent}%)  ${formatRs(summary.quickProfit)}`,
    `Gross profit         ${formatRs(summary.grossProfit)}`,
    `Running expenses   − ${formatRs(summary.operatingExpenses)}`,
    '------------------------',
    signedProfitLabel(summary.netProfit),
    '',
    '— Cash —',
    `Opening cash         ${formatRs(summary.openingCash)}`,
    `+ Cash sales         ${formatRs(summary.cashSales)}`,
    `+ Cash collected     ${formatRs(summary.cashCollected)}`,
    `− Cash expenses      ${formatRs(summary.operatingExpenses)}`,
    `− Cash purchases     ${formatRs(summary.stockPurchase)}`,
    '------------------------',
    `Cash in drawer       ${formatRs(summary.expectedCash)}`,
    '',
    `${summary.saleCount} sales (${summary.productSaleCount} product · ${summary.quickSaleCount} quick · ${summary.creditSaleCount} credit) · ${summary.expenseCount} expenses`,
    `Generated: ${generated.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${formatTime(generated.getTime())}`,
  ];
  if (closedAt) {
    lines.push(`Closed at ${new Date(closedAt).toLocaleString('en-GB')}`);
  }
  return lines.join('\n');
}

export async function printDayCloseReport(
  shopName: string,
  summary: DayCloseSummary,
  closedAt?: number | null,
  kitchen?: KitchenDayReportExtras | null,
): Promise<PrintResult> {
  const title = `Daily report — ${shopName}`;
  return printTextReport(title, buildDayCloseReportText(shopName, summary, closedAt, kitchen));
}

const DAY_MS = 24 * 60 * 60 * 1000;

function shortDayLabel(dayKeyValue: string) {
  return new Date(`${dayKeyValue}T12:00:00`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
}

/** Compact one line for weekly attach (full detail stays on Daily / Close day). */
export function buildDayCloseLineText(summary: DayCloseSummary) {
  const shortDate = new Date(`${summary.dayKey}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
  return `${shortDate}  sales ${formatRs(summary.totalSales)}  net ${formatRs(summary.netProfit)}`;
}

export type WeekChunkSummary = {
  weekIndex: number;
  startDayKey: string;
  endDayKey: string;
  sales: number;
  final: number;
  expenses: number;
};

/** Split month days into 7-day weeks from month start (last week may be shorter). */
export function chunkDaysIntoWeeks(days: DayCloseSummary[]): WeekChunkSummary[] {
  const chunks: WeekChunkSummary[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const slice = days.slice(i, i + 7);
    const first = slice[0];
    const last = slice[slice.length - 1];
    chunks.push({
      weekIndex: chunks.length + 1,
      startDayKey: first.dayKey,
      endDayKey: last.dayKey,
      sales: slice.reduce((sum, day) => sum + day.totalSales, 0),
      final: slice.reduce((sum, day) => sum + day.netProfit, 0),
      expenses: slice.reduce((sum, day) => sum + day.totalExpenses, 0),
    });
  }
  return chunks;
}

export function buildWeekChunkLineText(week: WeekChunkSummary) {
  const range = `${shortDayLabel(week.startDayKey)}–${shortDayLabel(week.endDayKey)}`;
  return `W${week.weekIndex} ${range}  sales ${formatRs(week.sales)}  net ${formatRs(week.final)}`;
}

export type AttachedPeriodSummary = {
  title: string;
  rangeLabel: string;
  days: DayCloseSummary[];
  weeks: WeekChunkSummary[];
  weeklySales: number;
  weeklyFinal: number;
  weeklyExpenses: number;
  weeklyProductProfit: number;
  weeklyQuickProfit: number;
  weeklyOperating: number;
  weeklyStockPurchase: number;
  weeklyGross: number;
};

/** Attach one daily summary per calendar day in [start, end). */
export function buildAttachedPeriodSummary(
  books: Books,
  range: { start: number; end: number },
  title: string,
): AttachedPeriodSummary {
  const days: DayCloseSummary[] = [];
  for (let ts = range.start; ts < range.end; ts += DAY_MS) {
    days.push(buildDayCloseSummary(books, ts));
  }
  const weeklySales = days.reduce((sum, day) => sum + day.totalSales, 0);
  const weeklyFinal = days.reduce((sum, day) => sum + day.netProfit, 0);
  const weeklyExpenses = days.reduce((sum, day) => sum + day.totalExpenses, 0);
  const weeklyProductProfit = days.reduce((sum, day) => sum + day.productProfit, 0);
  const weeklyQuickProfit = days.reduce((sum, day) => sum + day.quickProfit, 0);
  const weeklyOperating = days.reduce((sum, day) => sum + day.operatingExpenses, 0);
  const weeklyStockPurchase = days.reduce((sum, day) => sum + day.stockPurchase, 0);
  const weeklyGross = days.reduce((sum, day) => sum + day.grossProfit, 0);
  const rangeLabel =
    days.length === 0
      ? ''
      : days.length === 1
        ? days[0].dateLabel
        : `${days[0].dateLabel} → ${days[days.length - 1].dateLabel}`;
  return {
    title,
    rangeLabel,
    days,
    weeks: chunkDaysIntoWeeks(days),
    weeklySales,
    weeklyFinal,
    weeklyExpenses,
    weeklyProductProfit,
    weeklyQuickProfit,
    weeklyOperating,
    weeklyStockPurchase,
    weeklyGross,
  };
}

export function buildAttachedPeriodReportText(shopName: string, period: AttachedPeriodSummary) {
  const isWeek = /week/i.test(period.title);
  const isMonth = /month/i.test(period.title);
  const salesLabel = isWeek ? 'WEEKLY SALES' : isMonth ? 'MONTHLY SALES' : 'PERIOD SALES';
  const finalLabel = isWeek ? 'WEEKLY NET' : isMonth ? 'MONTHLY NET' : 'PERIOD NET';
  const lines = [
    'KadaBook — ' + period.title,
    shopName.trim() || 'Shop',
    period.rangeLabel,
    '',
  ];

  if (isMonth) {
    lines.push('Week   Date range          Sales / Net', '--------------------------------');
    for (const week of period.weeks) {
      lines.push(buildWeekChunkLineText(week));
    }
  } else {
    lines.push('Day                  Sales        Net', '--------------------------------');
    for (const day of period.days) {
      lines.push(buildDayCloseLineText(day));
    }
  }

  lines.push(
    '========================',
    `${salesLabel.padEnd(20)}${formatRs(period.weeklySales)}`,
    `Gross profit sum    ${formatRs(period.weeklyGross)}`,
    `Running expenses    ${formatRs(period.weeklyOperating)}`,
    `Stock purchases     ${formatRs(period.weeklyStockPurchase)}`,
    '------------------------',
    `${finalLabel.padEnd(20)}${formatRs(period.weeklyFinal)}`,
    `  (gross − running expenses; stock purchases not in net)`,
    '========================',
    '',
    isMonth
      ? 'Week detail: Reports → Weekly. Day detail: Close day / Daily.'
      : 'Full day detail: Home → Close day, or Reports → Daily.',
  );
  return lines.join('\n');
}

export async function shareDayCloseWhatsApp(text: string): Promise<PrintResult> {
  const encoded = encodeURIComponent(text);
  const appUrl = `whatsapp://send?text=${encoded}`;
  try {
    const can = await Linking.canOpenURL(appUrl);
    if (can) {
      await Linking.openURL(appUrl);
      return { ok: true };
    }
  } catch {
    /* fall through */
  }
  try {
    const webUrl = `https://wa.me/?text=${encoded}`;
    await Linking.openURL(webUrl);
    return { ok: true };
  } catch {
    /* fall through to share sheet */
  }
  try {
    await Share.share({ message: text });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not share to WhatsApp.',
    };
  }
}
