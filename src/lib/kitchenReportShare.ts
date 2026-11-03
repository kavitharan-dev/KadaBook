import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { BranchScope, KitchenData } from '../data/kitchenTypes';
import type { Sale } from '../data/types';
import { formatDay, formatRs } from './format';
import { cogsSummary, formatQty, transferSummary, varianceReport } from './kitchenOps';

export async function shareKitchenReport(options: {
  shopName: string;
  data: KitchenData;
  sales: Sale[];
  scope: BranchScope;
  start: number;
  end: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { shopName, data, sales, scope, start, end } = options;
  const cogs = cogsSummary(data, sales, scope, start, end);
  const variance = varianceReport(data, scope, start, end).filter((v) => v.counted !== null);
  const transfers = transferSummary(data, start, end);
  const scopeName =
    scope === 'all' ? 'All branches' : data.branches.find((b) => b.id === scope)?.name ?? 'Branch';

  const varianceRows = variance
    .map(
      (v) =>
        `<tr>
          <td>${escapeHtml(v.material.name)}</td>
          <td>${formatQty(v.expected, v.material.unit)}</td>
          <td>${formatQty(v.actual ?? 0, v.material.unit)}</td>
          <td>${formatQty(v.variance ?? 0, v.material.unit)} (${formatRs(v.varianceValue ?? 0)})</td>
        </tr>`,
    )
    .join('');

  const transferRows = transfers
    .map((t) => {
      const m = data.materials.find((x) => x.id === t.materialId);
      const from = data.branches.find((b) => b.id === t.fromId)?.name ?? '—';
      const to = data.branches.find((b) => b.id === t.toId)?.name ?? '—';
      return `<tr><td>${escapeHtml(from)} → ${escapeHtml(to)}</td><td>${escapeHtml(m?.name ?? '—')}</td><td>${formatQty(t.qty, m?.unit ?? '')}</td><td>${formatRs(t.value)}</td></tr>`;
    })
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
    <h1>${escapeHtml(shopName)} · Kitchen report</h1>
    <p>${formatDay(start)} – ${formatDay(end - 1)} · ${escapeHtml(scopeName)}</p>
    <h2>Cost of goods sold</h2>
    <div class="row"><span>Opening stock</span><span>${formatRs(cogs.openingValue)}</span></div>
    <div class="row"><span>+ Purchases</span><span>${formatRs(cogs.purchasesValue)}</span></div>
    <div class="row"><span>− Closing stock</span><span>${formatRs(cogs.closingValue)}</span></div>
    <div class="row strong"><span>COGS</span><span>${formatRs(cogs.cogs)}</span></div>
    <div class="row"><span>Sales</span><span>${formatRs(cogs.sales)}</span></div>
    <div class="row strong"><span>Gross profit (${cogs.marginPercent}%)</span><span>${formatRs(cogs.grossProfit)}</span></div>
    <h2>Variance</h2>
    ${
      variance.length
        ? `<table><thead><tr><th>Material</th><th>Expected</th><th>Actual</th><th>Gap</th></tr></thead><tbody>${varianceRows}</tbody></table>`
        : '<p>No stock count in this period.</p>'
    }
    <h2>Transfers</h2>
    ${
      transfers.length
        ? `<table><thead><tr><th>Route</th><th>Material</th><th>Qty</th><th>Value</th></tr></thead><tbody>${transferRows}</tbody></table>`
        : '<p>No transfers in this period.</p>'
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
      await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Share kitchen report' });
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
