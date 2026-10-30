import type { Product, Sale } from '../data/types';
import type { ReceiptSettings } from './receiptSettings';
import { formatDay, formatRs, formatTime } from './format';

export function buildReceiptText(options: {
  shopName: string;
  sale: Sale;
  settings?: ReceiptSettings;
}) {
  const { shopName, sale, settings } = options;
  const prefix = settings?.invoicePrefix ?? 'INV';
  const invoiceLabel = sale.invoiceNo ? `${prefix}-${sale.invoiceNo}` : 'Receipt';
  const lines: string[] = [
    shopName,
    settings?.shopLine?.trim() ? settings.shopLine.trim() : '',
    '------------------------',
    invoiceLabel,
    formatDay(sale.createdAt),
    formatTime(sale.createdAt),
    '------------------------',
  ].filter(Boolean);

  if (sale.items?.length) {
    for (const item of sale.items) {
      lines.push(`${item.name}`);
      lines.push(`  ${item.qty} x ${formatRs(item.unitPrice)} = ${formatRs(item.lineTotal)}`);
    }
    lines.push('------------------------');
  }

  lines.push(`TOTAL: ${formatRs(sale.amount)}`);
  lines.push('');
  lines.push(settings?.footerLine?.trim() || 'Thank you!');
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
  if (sale.items?.length) {
    const count = sale.items.reduce((n, line) => n + line.qty, 0);
    const prefix = sale.kind === 'quick' ? 'Quick · ' : '';
    return `${prefix}${sale.items.length} line(s) · qty ${count}`;
  }
  return 'Quick sale';
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
