import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { BranchScope, KitchenData } from '../data/kitchenTypes';
import type { Sale } from '../data/types';
import { formatDay, formatRs } from './format';
import { branchReport, formatQty } from './kitchenOps';

export async function shareKitchenReport(options: {
  shopName: string;
  data: KitchenData;
  sales: Sale[];
  scope: BranchScope;
  start: number;
  end: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { shopName, data, sales, scope, start, end } = options;
  const report = branchReport(data, sales, scope, start, end);
  const scopeName =
    scope === 'all' ? 'All branches' : data.branches.find((b) => b.id === scope)?.name ?? 'Branch';

  const rows = report.rows
    .map(
      (r) =>
        `<tr>
          <td>${escapeHtml(r.item.name)}</td>
          <td>${formatQty(r.received, r.item.unit)}</td>
          <td>${formatQty(r.sold, r.item.unit)}</td>
          <td>${formatQty(r.remaining, r.item.unit)}</td>
          <td>${r.adjustQty ? `${formatQty(r.adjustQty, r.item.unit)} (${formatRs(r.adjustValue)})` : '—'}</td>
        </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body{font-family:-apple-system,Segoe UI,sans-serif;padding:24px;color:#111}
    h1{font-size:20px;margin:0 0 4px} h2{font-size:15px;margin:20px 0 8px}
    p{color:#555;font-size:12px;margin:0 0 12px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{border-bottom:1px solid #ddd;padding:6px 4px;text-align:left}
    th{color:#555;font-weight:600}
    .row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px}
    .strong{font-weight:700}
  </style></head><body>
    <h1>${escapeHtml(shopName)} · Branch report</h1>
    <p>${formatDay(start)} – ${formatDay(end - 1)} · ${escapeHtml(scopeName)}</p>
    <h2>Money</h2>
    <div class="row"><span>Sales</span><span>${formatRs(report.sales)}</span></div>
    <div class="row"><span>Cost of what was sold</span><span>${formatRs(report.cost)}</span></div>
    <div class="row strong"><span>Gross profit</span><span>${formatRs(report.grossProfit)}</span></div>
    <div class="row"><span>Adjustments (loss or gain)</span><span>${formatRs(report.adjustValue)}</span></div>
    <h2>Stock</h2>
    ${
      report.rows.length
        ? `<table><thead><tr><th>Item</th><th>Received</th><th>Sold</th><th>Remaining</th><th>Adjustments</th></tr></thead><tbody>${rows}</tbody></table>`
        : '<p>No stock movement in this period.</p>'
    }
  </body></html>`;

  try {
    if (Platform.OS === 'web') {
      const win = (globalThis as { open?: (url: string, target?: string) => Window | null }).open?.('', '_blank');
      if (!win) return { ok: false, message: 'Allow pop-ups to share in the browser.' };
      win.document.write(html);
      win.document.close();
      return { ok: true };
    }
    const file = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Share branch report' });
      return { ok: true };
    }
    await Print.printAsync({ html });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not share the report.' };
  }
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
