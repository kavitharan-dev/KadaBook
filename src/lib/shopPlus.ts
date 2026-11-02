import type { Books, Customer, Product, Sale, SaleLine } from '../data/types';
import { formatDay, formatRs, isSameDay, startOfDay } from './format';
import { periodRange } from './stats';

export function waMe(phone: string, text: string) {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `94${digits.slice(1)}`;
  else if (digits.length === 9) digits = `94${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function fillReminder(template: string, values: { customer: string; amount: string; shop: string; date: string }) {
  return template
    .replaceAll('{customer}', values.customer)
    .replaceAll('{amount}', values.amount)
    .replaceAll('{shop}', values.shop)
    .replaceAll('{date}', values.date);
}

export const DEFAULT_REMINDER =
  'Hello {customer}, this is {shop}. Your balance is {amount} as of {date}. Please pay when you can. Thank you.';

/** Last 9 digits, so 0771234567, +94771234567 and 94 77 123 4567 are the same customer. */
export function phoneKey(phone?: string) {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.length > 9 ? digits.slice(-9) : digits;
}

export function findCustomerByPhone(customers: Customer[], phone?: string) {
  const key = phoneKey(phone);
  if (key.length < 9) return undefined;
  return customers.find((customer) => phoneKey(customer.phone) === key);
}

/** Rupees left on one credit bill after what was received at the counter. */
export function creditSaleDue(sale: Sale) {
  if (sale.paymentMode !== 'credit') return 0;
  return Math.max(0, sale.amount - (sale.paidAmount ?? 0));
}

export function customerBalance(books: Books, customerId: string) {
  const due = books.sales
    .filter((sale) => sale.customerId === customerId)
    .reduce((sum, sale) => sum + creditSaleDue(sale), 0);
  const paid = books.creditPayments
    .filter((row) => row.customerId === customerId)
    .reduce((sum, row) => sum + row.amount, 0);
  return Math.max(0, due - paid);
}

/** Oldest bills are cleared first. Returns the credit bills fully covered by `collected` rupees. */
export function fifoSettledIds(creditSales: Sale[], collected: number) {
  let left = collected;
  const ids: string[] = [];
  const ordered = creditSales
    .filter((sale) => sale.paymentMode === 'credit')
    .sort((a, b) => a.createdAt - b.createdAt);
  for (const sale of ordered) {
    const due = creditSaleDue(sale);
    if (due > left) break;
    ids.push(sale.id);
    left -= due;
  }
  return ids;
}

export type CreditRow = { customer: Customer; due: number; oldestDays: number };

export function creditRows(books: Books, now = Date.now()): CreditRow[] {
  return books.customers
    .map((customer) => ({
      customer,
      due: customerBalance(books, customer.id),
      oldestDays: oldestUnpaidDays(books, customer.id, now),
    }))
    .filter((row) => row.due > 0)
    .sort((a, b) => b.due - a.due);
}

export function creditTotals(books: Books) {
  const rows = creditRows(books);
  return { total: rows.reduce((sum, row) => sum + row.due, 0), count: rows.length };
}

export type LedgerEntry =
  | { kind: 'bill'; id: string; at: number; label: string; total: number; received: number; due: number }
  | { kind: 'payment'; id: string; at: number; label: string; amount: number; note?: string };

export function creditLedger(books: Books, customerId: string): LedgerEntry[] {
  const bills: LedgerEntry[] = books.sales
    .filter((sale) => sale.customerId === customerId && sale.paymentMode === 'credit')
    .map((sale) => ({
      kind: 'bill' as const,
      id: sale.id,
      at: sale.createdAt,
      label: sale.invoiceNo != null ? `Invoice #${sale.invoiceNo}` : 'Credit sale',
      total: sale.amount,
      received: sale.paidAmount ?? 0,
      due: creditSaleDue(sale),
    }));
  const payments: LedgerEntry[] = books.creditPayments
    .filter((row) => row.customerId === customerId)
    .map((row) => ({
      kind: 'payment' as const,
      id: row.id,
      at: row.createdAt,
      label: `Payment received (${row.method === 'card' ? 'Card' : 'Cash'})`,
      amount: row.amount,
      note: row.note,
    }));
  return [...bills, ...payments].sort((a, b) => b.at - a.at);
}

export function oldestUnpaidDays(books: Books, customerId: string, now = Date.now()) {
  const open = books.sales
    .filter((sale) => sale.customerId === customerId && sale.paymentMode === 'credit' && sale.settled === false)
    .sort((a, b) => a.createdAt - b.createdAt);
  if (!open[0]) return 0;
  return Math.max(0, Math.floor((startOfDay(now) - startOfDay(open[0].createdAt)) / 86400000));
}

export function reorderQty(product: Product) {
  const level = product.reorderLevel ?? 5;
  return Math.max(level, level * 2 - product.stock);
}

const WORDS: Record<string, number> = {
  oru: 1,
  onnu: 1,
  one: 1,
  rendu: 2,
  randu: 2,
  two: 2,
  moonu: 3,
  moondru: 3,
  three: 3,
  naalu: 4,
  naal: 4,
  four: 4,
  anju: 5,
  five: 5,
  aaru: 6,
  six: 6,
  eelu: 7,
  yezhu: 7,
  seven: 7,
  ettu: 8,
  eight: 8,
  onpathu: 9,
  nine: 9,
  pathu: 10,
  ten: 10,
};

export function parseVoiceBill(text: string, products: Product[]): { lines: SaleLine[]; missing: string[] } {
  const lines: SaleLine[] = [];
  const missing: string[] = [];
  const chunks = text
    .split(/,|\n| nu | and /i)
    .map((part) => part.trim())
    .filter(Boolean);
  for (const chunk of chunks) {
    const bits = chunk.toLowerCase().split(/\s+/);
    const qty = WORDS[bits[0]] ?? (Number(bits[0]) || 1);
    const name = (Number.isFinite(Number(bits[0])) || WORDS[bits[0]] ? bits.slice(1) : bits).join(' ').trim();
    if (!name) continue;
    const product = products.find((item) => item.name.toLowerCase().includes(name) || name.includes(item.name.toLowerCase()));
    if (!product) {
      missing.push(name);
      continue;
    }
    lines.push({
      productId: product.id,
      name: product.name,
      qty,
      unitPrice: product.sellingPrice,
      lineTotal: Math.round(qty * product.sellingPrice),
    });
  }
  return { lines, missing };
}

export function assistantAnswer(question: string, books: Books, shopName: string) {
  const q = question.toLowerCase();
  const now = Date.now();
  if (/restock|stock|குறை|stock|reorder/.test(q)) {
    const low = books.products.filter((product) => product.stock <= (product.reorderLevel ?? 5));
    if (!low.length) return `${shopName}: all products are above the reorder level.`;
    return [`${shopName} restock:`, ...low.map((product) => `${product.name}: have ${product.stock}, order ${reorderQty(product)} ${product.unit}`)].join('\n');
  }
  if (/credit|udhaar|கடன்|ණය/.test(q)) {
    const rows = books.customers
      .map((customer) => ({ name: customer.name, due: customerBalance(books, customer.id) }))
      .filter((row) => row.due > 0);
    const total = rows.reduce((sum, row) => sum + row.due, 0);
    return [`Credit due ${formatRs(total)}`, ...rows.map((row) => `${row.name}: ${formatRs(row.due)}`)].join('\n');
  }
  const range = /week|வாரம்|සති/.test(q) ? periodRange('weekly', now) : periodRange('daily', now);
  const sales = books.sales.filter((sale) => sale.createdAt >= range.start && sale.createdAt < range.end);
  const expenses = books.expenses.filter((row) => row.createdAt >= range.start && row.createdAt < range.end);
  const saleTotal = sales.reduce((sum, sale) => sum + sale.amount, 0);
  const expenseTotal = expenses.reduce((sum, row) => sum + row.amount, 0);
  const counts = new Map<string, number>();
  for (const sale of sales) {
    for (const line of sale.items ?? []) counts.set(line.name, (counts.get(line.name) ?? 0) + line.qty);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return [
    `${shopName} summary ${formatDay(now)}`,
    `Sales ${formatRs(saleTotal)}`,
    `Expenses ${formatRs(expenseTotal)}`,
    `Cash left about ${formatRs(saleTotal - expenseTotal)}`,
    top.length ? `Top: ${top.map(([name, qty]) => `${name} x ${qty}`).join(', ')}` : 'No item sales in this period.',
  ].join('\n');
}

export function salesToCsv(sales: Sale[]) {
  const header = 'invoice,date,amount,payment,customer,note';
  const rows = sales.map((sale) =>
    [sale.invoiceNo ?? '', formatDay(sale.createdAt), sale.amount, sale.paymentMode ?? 'cash', sale.customerName ?? '', sale.note ?? '']
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(','),
  );
  return [header, ...rows].join('\n');
}

export function parseProductCsv(text: string): { rows: Array<{ name: string; sellingPrice: number; purchasePrice: number; stock: number; unit: string; category: string; barcode?: string }>; errors: string[] } {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const errors: string[] = [];
  const rows: Array<{ name: string; sellingPrice: number; purchasePrice: number; stock: number; unit: string; category: string; barcode?: string }> = [];
  lines.forEach((line, index) => {
    if (index === 0 && /name/i.test(line)) return;
    const cells = line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
    const [name, sell, buy, stock, unit, category, barcode] = cells;
    if (!name || !Number(sell)) {
      errors.push(`Row ${index + 1}: name and selling price are required`);
      return;
    }
    rows.push({
      name,
      sellingPrice: Number(sell),
      purchasePrice: Number(buy) || 0,
      stock: Number(stock) || 0,
      unit: unit || 'pcs',
      category: category || 'General',
      barcode: barcode || undefined,
    });
  });
  return { rows, errors };
}

export function expectedCash(books: Books, now = Date.now()) {
  const day = startOfDay(now);
  const key = new Date(now).toISOString().slice(0, 10);
  const opening = books.meta.openingBalances?.[key] ?? 0;
  const cashSales = books.sales
    .filter((sale) => isSameDay(sale.createdAt, now) && (sale.paymentMode ?? 'cash') === 'cash')
    .reduce((sum, sale) => sum + sale.amount, 0);
  const collections = books.creditPayments
    .filter((row) => isSameDay(row.createdAt, now) && row.method === 'cash')
    .reduce((sum, row) => sum + row.amount, 0);
  const creditReceived = books.sales
    .filter((sale) => isSameDay(sale.createdAt, now) && sale.paymentMode === 'credit')
    .reduce((sum, sale) => sum + (sale.paidAmount ?? 0), 0);
  const expenses = books.expenses
    .filter((row) => isSameDay(row.createdAt, now))
    .reduce((sum, row) => sum + row.amount, 0);
  return { opening, cashSales, collections, expenses, creditReceived, expected: opening + cashSales + creditReceived + collections - expenses, day: key, start: day };
}
