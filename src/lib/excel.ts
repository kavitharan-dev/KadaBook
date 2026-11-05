import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import type { Books, ProductInput } from '../data/types';
import type { KitchenData } from '../data/kitchenTypes';
import { MOVE_LABEL } from '../data/kitchenTypes';
import { PAYMENT_MODE_LABEL } from '../data/saleExtras';
import { formatDay, formatTime } from './format';
import { stockLevels } from './kitchenOps';

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

function sheet(rows: Record<string, string | number>[], widths?: number[]) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'No rows' }]);
  if (widths) ws['!cols'] = widths.map((wch) => ({ wch }));
  return ws;
}

/**
 * One workbook with Sales, Items sold, Expenses, Products and (if used) Kitchen sheets,
 * for the chosen date range. Shared with WhatsApp, email, Drive… through the share sheet.
 */
export async function exportBooksToExcel(options: {
  shopName: string;
  books: Books;
  kitchen?: KitchenData;
  start: number;
  end: number;
}) {
  const { shopName, books, kitchen, start, end } = options;
  const inRange = (ts: number) => ts >= start && ts < end;
  const branchName = (id?: string) => kitchen?.branches.find((b) => b.id === id)?.name ?? '';
  const wb = XLSX.utils.book_new();

  const sales = books.sales.filter((s) => inRange(s.createdAt)).sort((a, b) => a.createdAt - b.createdAt);
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      sales.map((s) => ({
        Date: formatDay(s.createdAt),
        Time: formatTime(s.createdAt),
        'Invoice no': s.invoiceNo ?? '',
        Items: s.items?.map((l) => `${l.name} x${l.qty}`).join(', ') ?? 'Quick sale',
        Subtotal: s.subtotal ?? s.amount,
        Discount: s.discount?.amount ?? 0,
        Total: s.amount,
        Payment: PAYMENT_MODE_LABEL[s.paymentMode ?? 'cash'],
        'Received now': s.paymentMode === 'credit' ? s.paidAmount ?? 0 : s.amount,
        Customer: s.customerName ?? '',
        Phone: s.customerPhone ?? '',
        Branch: branchName(s.branchId),
        Note: s.note ?? '',
      })),
      [16, 9, 10, 40, 10, 9, 10, 14, 12, 18, 13, 14, 24],
    ),
    'Sales',
  );

  const itemRows: Record<string, string | number>[] = [];
  for (const s of sales) {
    for (const l of s.items ?? []) {
      itemRows.push({ Date: formatDay(s.createdAt), 'Invoice no': s.invoiceNo ?? '', Item: l.name, Qty: l.qty, Rate: l.unitPrice, Amount: l.lineTotal });
    }
  }
  XLSX.utils.book_append_sheet(wb, sheet(itemRows, [16, 10, 28, 6, 9, 10]), 'Items sold');

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      books.expenses
        .filter((e) => inRange(e.createdAt))
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((e) => ({ Date: formatDay(e.createdAt), Time: formatTime(e.createdAt), Category: e.category, Amount: e.amount, Branch: branchName(e.branchId), Note: e.note ?? '' })),
      [16, 9, 18, 10, 14, 30],
    ),
    'Expenses',
  );

  XLSX.utils.book_append_sheet(wb, sheet(productRows(books), [28, 16, 8, 12, 14, 8, 10, 16]), 'Products');

  if (kitchen?.materials.length) {
    const levels = stockLevels(kitchen, 'all');
    XLSX.utils.book_append_sheet(
      wb,
      sheet(
        kitchen.materials.map((m) => {
          const row: Record<string, string | number> = { Item: m.name, Unit: m.unit, 'Stock (all)': levels[m.id] ?? 0 };
          for (const b of kitchen.branches) row[b.name] = stockLevels(kitchen, b.id)[m.id] ?? 0;
          row['Stock value'] = Math.round(
            Object.values(kitchen.stock)
              .filter((s) => s.itemId === m.id)
              .reduce((sum, s) => sum + Math.max(0, s.qty) * s.avgCost, 0),
          );
          return row;
        }),
      ),
      'Kitchen stock',
    );
    const moveRows: Record<string, string | number>[] = [];
    for (const mv of kitchen.moves.filter((x) => inRange(x.createdAt)).sort((a, b) => a.createdAt - b.createdAt)) {
      for (const [id, q] of Object.entries(mv.qty)) {
        const m = kitchen.materials.find((x) => x.id === id);
        moveRows.push({
          Date: formatDay(mv.createdAt),
          Type: MOVE_LABEL[mv.type],
          Branch: branchName(mv.branchId),
          'Other branch': branchName(mv.otherBranchId),
          Material: m?.name ?? id,
          Qty: q,
          Unit: m?.unit ?? '',
          Value: mv.cost[id] ?? 0,
          Note: mv.note ?? '',
        });
      }
    }
    XLSX.utils.book_append_sheet(wb, sheet(moveRows), 'Stock moves');
  }

  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const safe = shopName.replace(/[^\w-]+/g, '_').slice(0, 30) || 'KadaBook';
  const file = new File(Paths.cache, `${safe}_${fileDate(start)}_to_${fileDate(end - 1)}.xlsx`);
  if (file.exists) file.delete();
  file.create();
  file.write(new Uint8Array(bytes));
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this phone.');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Share Excel report',
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
  });
  return { sales: sales.length };
}

function fileDate(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function productRows(books: Books) {
  return books.products.map((p) => ({
    Name: p.name,
    Category: p.category,
    Unit: p.unit,
    'Selling price': p.sellingPrice,
    'Purchase price': p.purchasePrice,
    Stock: p.stock,
    'Reorder level': p.reorderLevel ?? '',
    Barcode: p.barcode ?? '',
  }));
}

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

/** Header names people actually use, in English, Tamil and Sinhala, mapped to our fields. */
const HEADER_ALIASES: Record<keyof ProductInput, string[]> = {
  name: ['name', 'product', 'product name', 'item', 'item name', 'பொருள்', 'பெயர்', 'නම', 'භාණ්ඩය'],
  sellingPrice: ['selling price', 'price', 'sell price', 'mrp', 'rate', 'sale price', 'விலை', 'මිල'],
  purchasePrice: ['purchase price', 'cost', 'cost price', 'buy price', 'வாங்கிய விலை', 'ගැනුම් මිල'],
  stock: ['stock', 'qty', 'quantity', 'opening stock', 'இருப்பு', 'තොගය'],
  unit: ['unit', 'uom', 'அலகு', 'ඒකකය'],
  category: ['category', 'type', 'group', 'வகை', 'වර්ගය'],
  barcode: ['barcode', 'bar code', 'code', 'sku'],
  reorderLevel: ['reorder level', 'reorder', 'min stock', 'minimum'],
  batchNo: ['batch', 'batch no'],
  expiry: ['expiry', 'expiry date', 'exp'],
  sellKind: ['sell kind', 'sell type', 'kind', 'menu', 'simple'],
  // Set in the app, never from a file.
  stockItemId: [],
  portionQty: [],
};

export type ImportPreview = {
  fileName: string;
  rows: ProductInput[];
  /** Rows that were skipped, with the reason, so the user can fix the sheet. */
  problems: { row: number; reason: string }[];
  /** Names already in the shop: these are skipped on import so nothing is duplicated. */
  duplicates: string[];
};

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** "Rs. 1,250.50" → 1250.5. Empty or text-only cells are NaN, not 0. */
function toNumber(value: unknown) {
  if (typeof value === 'number') return value;
  const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

/** Opens the file picker and reads products from the first sheet of an .xlsx, .xls or .csv. */
export async function pickProductSheet(existingNames: string[]): Promise<ImportPreview | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'text/comma-separated-values',
      '*/*',
    ],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled || !picked.assets?.[0]) return null;
  const asset = picked.assets[0];
  if (asset.size && asset.size > 5 * 1024 * 1024) throw new Error('That file is over 5 MB. Split it into smaller sheets.');
  const buffer = await new File(asset.uri).arrayBuffer();
  return parseProductSheet(new Uint8Array(buffer), asset.name, existingNames);
}

export function parseProductSheet(bytes: Uint8Array, fileName: string, existingNames: string[]): ImportPreview {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(bytes, { type: 'array' });
  } catch {
    throw new Error('Could not read that file. Save it as .xlsx or .csv and try again.');
  }
  const first = wb.SheetNames[0];
  if (!first) throw new Error('The file has no sheets.');
  const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[first], { header: 1, blankrows: false, defval: '' });
  if (grid.length < 2) throw new Error('The sheet needs a header row and at least one product.');

  const header = (grid[0] as unknown[]).map(norm);
  const col = {} as Record<keyof ProductInput, number>;
  (Object.keys(HEADER_ALIASES) as (keyof ProductInput)[]).forEach((field) => {
    col[field] = header.findIndex((h) => HEADER_ALIASES[field].includes(h));
  });
  if (col.name < 0) throw new Error('No "Name" column found. The first row must have column names like Name, Price, Stock.');
  if (col.sellingPrice < 0) throw new Error('No "Selling price" (or "Price") column found.');

  const existing = new Set(existingNames.map(norm));
  const seen = new Set<string>();
  const rows: ProductInput[] = [];
  const problems: ImportPreview['problems'] = [];
  const duplicates: string[] = [];
  const cell = (r: unknown[], field: keyof ProductInput) => (col[field] >= 0 ? r[col[field]] : undefined);

  grid.slice(1, 2001).forEach((raw: unknown, i: number) => {
    const r = (Array.isArray(raw) ? raw : []) as unknown[];
    const rowNo = i + 2;
    const name = String(cell(r, 'name') ?? '').trim().slice(0, 100);
    if (!name) return;
    const price = toNumber(cell(r, 'sellingPrice'));
    if (!Number.isFinite(price) || price < 0) {
      problems.push({ row: rowNo, reason: `${name}: price is not a number` });
      return;
    }
    if (existing.has(norm(name)) || seen.has(norm(name))) {
      duplicates.push(name);
      return;
    }
    seen.add(norm(name));
    const cost = toNumber(cell(r, 'purchasePrice'));
    const stock = toNumber(cell(r, 'stock'));
    const reorder = toNumber(cell(r, 'reorderLevel'));
    const kindRaw = norm(cell(r, 'sellKind'));
    rows.push({
      name,
      sellingPrice: Math.round(price),
      purchasePrice: Number.isFinite(cost) && cost >= 0 ? Math.round(cost) : 0,
      stock: Number.isFinite(stock) && stock >= 0 ? stock : 0,
      unit: String(cell(r, 'unit') ?? '').trim().slice(0, 12) || 'pcs',
      category: String(cell(r, 'category') ?? '').trim().slice(0, 40) || 'General',
      barcode: String(cell(r, 'barcode') ?? '').trim().slice(0, 40) || undefined,
      reorderLevel: Number.isFinite(reorder) && reorder >= 0 ? reorder : undefined,
      sellKind: kindRaw.includes('menu') || kindRaw.includes('food') ? 'menu' : 'simple',
    });
  });
  if (grid.length > 2001) problems.push({ row: 2002, reason: 'Only the first 2000 rows are imported at a time.' });
  return { fileName, rows, problems, duplicates };
}

/** A ready-to-fill template with the right column names. */
export async function shareProductTemplate() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        { Name: 'Chicken Burger', 'Selling price': 950, 'Purchase price': 0, Stock: 0, Unit: 'pcs', Category: 'Burgers', Barcode: '', 'Reorder level': '' },
        { Name: 'Coke 400ml', 'Selling price': 250, 'Purchase price': 180, Stock: 48, Unit: 'pcs', Category: 'Drinks', Barcode: '', 'Reorder level': 12 },
      ],
      [24, 13, 14, 8, 8, 14, 14, 13],
    ),
    'Products',
  );
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const file = new File(Paths.cache, 'KadaBook_products_template.xlsx');
  if (file.exists) file.delete();
  file.create();
  file.write(new Uint8Array(bytes));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Products template',
  });
}
