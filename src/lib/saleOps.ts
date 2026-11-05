import type { BillCheckoutInput, Books, DraftInfo, Product, Sale, SaleLine } from '../data/types';

export function lineTotal(qty: number, unitPrice: number) {
  return Math.round(qty * unitPrice);
}

/** Freeze purchase cost on each line so day profit stays stable after product edits. */
export function stampSaleLineCosts(items: SaleLine[], products: Product[]): SaleLine[] {
  return items.map((line) => {
    if (line.unitCost != null && Number.isFinite(line.unitCost) && line.unitCost >= 0) {
      return { ...line, unitCost: Math.round(line.unitCost) };
    }
    const product = line.productId ? products.find((row) => row.id === line.productId) : undefined;
    return { ...line, unitCost: product ? Math.round(product.purchasePrice) || 0 : 0 };
  });
}

export function billTotal(items: SaleLine[]) {
  return items.reduce((sum, line) => sum + line.lineTotal, 0);
}

/** One place for the amount the customer pays. Discount is applied here only. */
export function chargedAmount(subtotal: number, discountRs = 0) {
  const base = Math.max(0, Math.round(subtotal));
  const off = Math.min(base, Math.max(0, Math.round(discountRs)));
  return { subtotal: base, discount: off, amount: base - off };
}

/** Only the draft fields that are set (Firestore rejects undefined values). */
export function draftFields(info?: DraftInfo): DraftInfo {
  const out: DraftInfo = {};
  if (info?.kind) out.kind = info.kind;
  if (info?.branchId) out.branchId = info.branchId;
  const name = info?.customerName?.trim().slice(0, 60);
  if (name) out.customerName = name;
  const phone = info?.customerPhone?.trim().slice(0, 20);
  if (phone) out.customerPhone = phone;
  return out;
}

export function assertBillItems(items: SaleLine[]) {
  if (!items.length) throw new Error('Add at least one product to the bill.');
  for (const line of items) {
    if (!line.name.trim()) throw new Error('Product name is missing.');
    if (!Number.isFinite(line.qty) || line.qty <= 0) throw new Error('Enter a valid quantity.');
    if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) throw new Error('Enter a valid price.');
  }
}

export function assertStock(books: Books, items: SaleLine[]) {
  for (const line of items) {
    if (!line.productId) continue;
    const product = books.products.find((p) => p.id === line.productId);
    // Linked products take per-branch stock, and a sale is never blocked by it.
    if (!product || product.stockItemId) continue;
    if (product.stock <= 0) {
      throw new Error(`${product.name} is out of stock.`);
    }
    if (line.qty > product.stock) {
      throw new Error(`${product.name}: only ${product.stock} ${product.unit} in stock.`);
    }
  }
}

export function deductStock(books: Books, items: SaleLine[]) {
  for (const line of items) {
    if (!line.productId) continue;
    const product = books.products.find((p) => p.id === line.productId);
    if (!product || product.stockItemId || product.stock <= 0) continue;
    product.stock = Math.max(0, product.stock - line.qty);
  }
}

export function nextInvoiceNo(books: Books) {
  const no = books.meta.nextInvoice;
  books.meta.nextInvoice = no + 1;
  return no;
}

export function buildQuickSale(
  amount: number,
  invoiceNo: number,
  items?: SaleLine[],
): Omit<Sale, 'id' | 'createdAt'> {
  const rounded = Math.round(amount);
  const base = {
    amount: rounded,
    invoiceNo,
    kind: 'quick' as const,
    settled: true,
  };
  if (items?.length) {
    return { ...base, items };
  }
  return base;
}

export function buildBillSale(items: SaleLine[], invoiceNo: number): Omit<Sale, 'id' | 'createdAt'> {
  return {
    amount: billTotal(items),
    invoiceNo,
    kind: 'bill',
    items,
    settled: true,
  };
}

export type CheckoutPayload = BillCheckoutInput;
