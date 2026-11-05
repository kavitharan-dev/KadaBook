import type { Product, Sale } from '../data/types';
import type { ReceiptSettings } from './receiptSettings';
import { PAYMENT_MODE_LABEL, type SaleExtras } from '../data/saleExtras';
import { formatDay, formatRs, formatTime } from './format';

export function buildReceiptText(options: {
  shopName: string;
  sale: Sale;
  settings?: ReceiptSettings;
}) {
  const { shopName, sale, settings } = options;
  const prefix = settings?.invoicePrefix ?? 'INV';
  const invoiceLabel = sale.invoiceNo ? `${prefix}-${sale.invoiceNo}` : 'Bill';
  const brand = (shopName || 'Shop').trim();
  const lines: string[] = [
    '================================',
    brand.toUpperCase(),
  ];
  if (settings?.shopLine?.trim()) lines.push(settings.shopLine.trim());
  lines.push(
    '================================',
    invoiceLabel,
    `${formatDay(sale.createdAt)}  ${formatTime(sale.createdAt)}`,
    '--------------------------------',
  );

  if (sale.items?.length) {
    for (const item of sale.items) {
      const name = (item.name || 'Item').trim();
      lines.push(name);
      lines.push(`  ${item.qty} x ${formatRs(item.unitPrice)} = ${formatRs(item.lineTotal)}`);
    }
    lines.push('--------------------------------');
  } else {
    lines.push('Quick sale');
    lines.push('--------------------------------');
  }

  const extra = sale as Sale & SaleExtras;
  if (extra.discount && extra.discount.amount > 0) {
    lines.push(`Subtotal: ${formatRs(extra.subtotal ?? sale.amount + extra.discount.amount)}`);
    const label = extra.discount.type === 'percent' ? `Discount (${extra.discount.value}%)` : 'Discount';
    lines.push(`${label}: -${formatRs(extra.discount.amount)}`);
  }
  lines.push(`TOTAL: ${formatRs(sale.amount)}`);
  if (extra.paymentMode) lines.push(`Paid by: ${PAYMENT_MODE_LABEL[extra.paymentMode]}`);
  if (extra.customerName) lines.push(`Customer: ${extra.customerName}`);
  if (extra.customerPhone) lines.push(`Phone: ${extra.customerPhone}`);
  lines.push('================================');
  lines.push(settings?.footerLine?.trim() || `Thank you — ${brand}`);
  return lines.join('\n');
}

export function buildReceiptHtml(options: {
  shopName: string;
  sale: Sale;
  settings: ReceiptSettings;
}) {
  const text = buildReceiptText(options);
  const width = options.settings.paperMm === 80 ? 302 : 220;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body { margin: 0; font-family: monospace; }
    .paper { width: ${width}px; padding: 8px; font-size: 12px; line-height: 1.35; white-space: pre-wrap; }
  </style></head><body><div class="paper">${escapeHtml(text)}</div></body></html>`;
}

export function buildLowStockReportText(shopName: string, products: Product[]) {
  const lines = [
    shopName,
    'LOW STOCK REPORT',
    formatDay(Date.now()),
    '------------------------',
  ];
  if (products.length === 0) {
    lines.push('All products above low-stock level.');
  } else {
    for (const p of products) {
      lines.push(`${p.name}`);
      lines.push(`  Stock: ${p.stock} ${p.unit} · Sell: ${formatRs(p.sellingPrice)}`);
    }
  }
  lines.push('------------------------');
  return lines.join('\n');
}

export function saleSummaryLine(sale: Sale) {
  const extra = sale as Sale & SaleExtras;
  let base = 'Quick sale';
  if (sale.items?.length) {
    const count = sale.items.reduce((n, line) => n + line.qty, 0);
    const prefix = sale.kind === 'quick' ? 'Quick · ' : '';
    base = `${prefix}${sale.items.length} line(s) · qty ${count}`;
  }
  const parts = [base];
  if (extra.customerName) parts.push(extra.customerName);
  if (extra.paymentMode && extra.paymentMode !== 'cash') parts.push(PAYMENT_MODE_LABEL[extra.paymentMode]);
  if (extra.discount && extra.discount.amount > 0) parts.push(`-${formatRs(extra.discount.amount)}`);
  return parts.join(' · ');
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
