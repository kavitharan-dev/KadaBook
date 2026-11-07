import type { Product, Sale } from '../data/types';
import type { ReceiptSettings } from './receiptSettings';
import { PAYMENT_MODE_LABEL, type SaleExtras } from '../data/saleExtras';
import { formatDay, formatRs, formatTime } from './format';

/** Rupees without the "Rs." prefix, for the item columns — matches BillReceipt's `money()`. */
function money(value: number) {
  return Math.round(value).toLocaleString('en-IN');
}

/**
 * Styled HTML receipt for the iOS/web print-or-share path — mirrors BillReceipt.tsx's
 * on-screen layout (logo, dashed dividers, item table, total band, payment chip) instead
 * of dumping plain monospace text, so what you print/share looks like what you saved.
 */
export function buildReceiptHtml(options: {
  shopName: string;
  sale: Sale;
  settings: ReceiptSettings;
  /** Shop logo as a data: URI (from the device-local avatar), shown instead of the letter circle when set. */
  logoDataUri?: string | null;
}) {
  const { sale, settings, logoDataUri } = options;
  const brand = (options.shopName || 'Shop').trim();
  const billNo = sale.invoiceNo ? `${settings.invoicePrefix}-${sale.invoiceNo}` : '—';
  const lines = sale.items?.length
    ? sale.items
    : [{ name: 'Sale amount', qty: 1, unitPrice: sale.subtotal ?? sale.amount, lineTotal: sale.subtotal ?? sale.amount }];
  const qtyTotal = lines.reduce((sum, l) => sum + l.qty, 0);
  const off = sale.discount?.amount ?? 0;
  const subtotal = sale.subtotal ?? sale.amount + off;
  const mode = sale.paymentMode ?? 'cash';
  const paid = mode === 'credit' ? sale.paidAmount ?? 0 : sale.amount;
  const balance = Math.max(0, sale.amount - paid);
  const e = escapeHtml;

  const logoHtml = logoDataUri
    ? `<img src="${e(logoDataUri)}" alt="" />`
    : e((brand.trim()[0] ?? 'K').toUpperCase());

  const itemRows = lines
    .map(
      (line, i) => `
      <tr${i === lines.length - 1 ? ' class="last"' : ''}>
        <td class="col-item">${e(line.name)}</td>
        <td class="col-qty">${line.qty}</td>
        <td class="col-rate muted">${money(line.unitPrice)}</td>
        <td class="col-amt strong">${money(line.lineTotal)}</td>
      </tr>`,
    )
    .join('');

  const discountRows =
    off > 0
      ? `
      <div class="sumRow"><span class="muted">Subtotal</span><span>${e(formatRs(subtotal))}</span></div>
      <div class="sumRow"><span class="sale">${e(
        sale.discount?.type === 'percent' ? `Discount (${sale.discount.value}%)` : 'Discount',
      )}</span><span class="sale">− ${e(formatRs(off))}</span></div>`
      : '';

  const dueHtml =
    balance > 0
      ? `<div class="due"><span>Balance due · credit book</span><strong>${e(formatRs(balance))}</strong></div>`
      : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${e(billNo)}</title><style>
    body { margin: 0; background: #F2F5FB; font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; padding: 24px 12px; }
    .paper { max-width: 380px; margin: 0 auto; background: #FFFFFF; border: 1px solid #D5DBE5; border-radius: 16px; padding: 20px 16px; }
    .header { text-align: center; }
    .logo { width: 52px; height: 52px; border-radius: 26px; background: #1D5FE0; color: #FFFFFF; display: flex; align-items: center; justify-content: center; margin: 0 auto 8px; font-size: 22px; font-weight: 700; overflow: hidden; }
    .logo img { width: 100%; height: 100%; object-fit: cover; }
    .shopName { font-size: 20px; font-weight: 700; color: #111827; margin: 0; }
    .shopLine { font-size: 12px; color: #5B6472; margin: 4px 0 0; }
    .tag { display: inline-block; margin-top: 8px; background: #E8F1FF; color: #1D5FE0; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; padding: 4px 10px; border-radius: 999px; }
    .dash { border-top: 1px dashed #D5DBE5; margin: 14px 0; }
    .infoRow { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
    .infoCell { flex: 1; }
    .infoCell.right { text-align: right; }
    .infoLabel { display: block; font-size: 11px; color: #5B6472; }
    .infoValue { display: block; font-size: 13px; font-weight: 600; color: #111827; }
    table { width: 100%; border-collapse: collapse; }
    thead td { background: #EEF0F4; font-size: 11px; font-weight: 700; color: #111827; padding: 7px 8px; }
    thead td:first-child { border-radius: 8px 0 0 8px; }
    thead td:last-child { border-radius: 0 8px 8px 0; }
    tbody td { font-size: 13px; color: #111827; padding: 8px; border-bottom: 1px solid #E5E7EB; }
    tbody tr.last td { border-bottom: none; }
    .col-item { text-align: left; }
    .col-qty { width: 34px; text-align: center; }
    .col-rate { width: 58px; text-align: right; }
    .col-amt { width: 70px; text-align: right; }
    .muted { color: #5B6472; }
    .strong { font-weight: 600; }
    .sale { color: #14733D; }
    .count { font-size: 11px; color: #5B6472; text-align: right; padding: 6px 8px 0; }
    .sumRow { display: flex; justify-content: space-between; align-items: center; min-height: 22px; padding: 2px; font-size: 13px; }
    .sumRow span:last-child { font-weight: 600; color: #111827; }
    .totalBand { display: flex; justify-content: space-between; align-items: center; background: #111827; color: #FFFFFF; border-radius: 12px; padding: 10px 14px; margin: 8px 0 4px; }
    .totalLabel { font-size: 14px; font-weight: 700; letter-spacing: 1.5px; }
    .totalValue { font-size: 22px; font-weight: 700; }
    .chip { display: inline-block; border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 600; }
    .chip.credit { background: #FDE8E8; color: #D92D3A; }
    .chip.cash { background: #E6F6EC; color: #14733D; }
    .due { display: flex; justify-content: space-between; align-items: center; border: 1px dashed #D92D3A; background: #FDE8E8; color: #D92D3A; border-radius: 10px; padding: 9px 12px; margin-top: 6px; font-size: 12px; }
    .footer { text-align: center; font-size: 13px; font-weight: 600; color: #111827; margin-top: 14px; }
    .powered { text-align: center; font-size: 10px; color: #5B6472; letter-spacing: 0.4px; margin-top: 2px; }
  </style></head><body>
    <div class="paper">
      <div class="header">
        <div class="logo">${logoHtml}</div>
        <p class="shopName">${e(brand)}</p>
        ${settings.shopLine.trim() ? `<p class="shopLine">${e(settings.shopLine.trim())}</p>` : ''}
        <span class="tag">INVOICE</span>
      </div>
      <div class="dash"></div>
      <div class="infoRow">
        <div class="infoCell"><span class="infoLabel">Bill No</span><span class="infoValue">${e(billNo)}</span></div>
        <div class="infoCell right"><span class="infoLabel">Date</span><span class="infoValue">${e(formatDay(sale.createdAt))}</span></div>
      </div>
      <div class="infoRow">
        <div class="infoCell"><span class="infoLabel">Customer</span><span class="infoValue">${e(
          sale.customerName || (sale.customerPhone ? 'Customer' : 'Walk-in'),
        )}</span></div>
        <div class="infoCell right"><span class="infoLabel">Time</span><span class="infoValue">${e(formatTime(sale.createdAt))}</span></div>
      </div>
      ${sale.customerPhone ? `<div class="infoRow"><div class="infoCell"><span class="infoLabel">Phone</span><span class="infoValue">${e(sale.customerPhone)}</span></div></div>` : ''}
      <div class="dash"></div>
      <table>
        <thead><tr><td class="col-item">Item</td><td class="col-qty">Qty</td><td class="col-rate">Rate</td><td class="col-amt">Amount</td></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div class="count">${lines.length} item${lines.length === 1 ? '' : 's'} · Qty ${qtyTotal}</div>
      <div class="dash"></div>
      ${discountRows}
      <div class="totalBand"><span class="totalLabel">TOTAL</span><span class="totalValue">${e(formatRs(sale.amount))}</span></div>
      <div class="sumRow"><span class="muted">Paid by</span><span class="chip ${mode === 'credit' ? 'credit' : 'cash'}">${e(PAYMENT_MODE_LABEL[mode])}</span></div>
      <div class="sumRow"><span class="muted">Received</span><span>${e(formatRs(paid))}</span></div>
      ${dueHtml}
      <div class="dash"></div>
      <p class="footer">${e(settings.footerLine.trim() || 'Thank you!')}</p>
      <p class="powered">Powered by SMART (PVT) LTD</p>
    </div>
  </body></html>`;
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

export function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
