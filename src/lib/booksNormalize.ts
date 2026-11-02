import { EMPTY_BOOKS, type Books, type Product, type Sale } from '../data/types';

function normalizeProduct(raw: Product & { price?: number }): Product {
  const sellingPrice = raw.sellingPrice ?? raw.price ?? 0;
  return {
    id: raw.id,
    name: raw.name,
    sellingPrice,
    purchasePrice: raw.purchasePrice ?? 0,
    stock: raw.stock ?? 0,
    unit: raw.unit ?? 'pcs',
    category: raw.category ?? 'General',
    barcode: raw.barcode,
    reorderLevel: raw.reorderLevel,
    batchNo: raw.batchNo,
    expiry: raw.expiry,
    createdAt: raw.createdAt,
  };
}

function normalizeSale(raw: Sale): Sale {
  return {
    ...raw,
    kind: raw.kind ?? (raw.items?.length ? 'bill' : 'quick'),
    settled: raw.settled ?? true,
  };
}

export function normalizeBooks(raw: Partial<Books> | null | undefined): Books {
  if (!raw) return { ...EMPTY_BOOKS };
  return {
    sales: (raw.sales ?? []).map((sale) => normalizeSale(sale as Sale)),
    expenses: raw.expenses ?? [],
    products: (raw.products ?? []).map((product) => normalizeProduct(product as Product & { price?: number })),
    savedOrders: raw.savedOrders ?? [],
    customers: raw.customers ?? [],
    creditPayments: raw.creditPayments ?? [],
    suppliers: raw.suppliers ?? [],
    staff: raw.staff ?? [],
    returns: raw.returns ?? [],
    audit: raw.audit ?? [],
    meta: {
      nextInvoice: raw.meta?.nextInvoice ?? 1,
      openingBalances: raw.meta?.openingBalances ?? {},
      customExpenseCategories: Array.isArray(raw.meta?.customExpenseCategories)
        ? raw.meta.customExpenseCategories.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [],
    },
  };
}

export function productSellingPrice(product: Product) {
  return product.sellingPrice;
}
