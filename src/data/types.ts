export type SaleLine = {
  productId?: string;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

export type Sale = {
  id: string;
  amount: number;
  createdAt: number;
  invoiceNo?: number;
  kind?: 'quick' | 'bill';
  items?: SaleLine[];
  settled?: boolean;
};

export type Expense = {
  id: string;
  amount: number;
  category: string;
  createdAt: number;
};

export type Product = {
  id: string;
  name: string;
  sellingPrice: number;
  purchasePrice: number;
  stock: number;
  unit: string;
  category: string;
  barcode?: string;
  createdAt: number;
};

export type SavedOrder = {
  id: string;
  items: SaleLine[];
  total: number;
  savedAt: number;
};

export type BooksMeta = {
  nextInvoice: number;
  openingBalances?: Record<string, number>;
  /** Shop-specific labels (shown after Stock / Transport / Other). */
  customExpenseCategories?: string[];
};

export type Books = {
  sales: Sale[];
  expenses: Expense[];
  products: Product[];
  savedOrders: SavedOrder[];
  meta: BooksMeta;
};

export type ShopUser = {
  uid: string;
  email: string;
  shopName: string;
  phone: string | null;
};

export const EMPTY_BOOKS: Books = {
  sales: [],
  expenses: [],
  products: [],
  savedOrders: [],
  meta: { nextInvoice: 1, openingBalances: {} },
};

export const EXPENSE_CATEGORIES = ['Stock Purchase', 'Transport', 'Other'] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type ProductInput = {
  name: string;
  sellingPrice: number;
  purchasePrice: number;
  stock: number;
  unit: string;
  category: string;
  barcode?: string;
};

export type QuickSaleInput = {
  amount: number;
  items?: SaleLine[];
};

export type BillCheckoutInput = {
  items: SaleLine[];
};
