import type { SaleExtras } from './saleExtras';

export type SaleLine = {
  productId?: string;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  /** Cost per unit frozen at sale time (for stable day profit). */
  unitCost?: number;
};

export type Sale = {
  id: string;
  amount: number;
  createdAt: number;
  invoiceNo?: number;
  kind?: 'quick' | 'bill';
  items?: SaleLine[];
  settled?: boolean;
} & SaleExtras;

export type Expense = {
  id: string;
  amount: number;
  category: string;
  createdAt: number;
  note?: string;
  branchId?: string;
};

/** simple = bottle/coke (product stock only); menu = food that can use kitchen recipes. */
export type ProductSellKind = 'simple' | 'menu';

export type Product = {
  id: string;
  name: string;
  sellingPrice: number;
  purchasePrice: number;
  stock: number;
  unit: string;
  category: string;
  barcode?: string;
  reorderLevel?: number;
  batchNo?: string;
  expiry?: string;
  /** Missing on old rows → treat as simple unless a kitchen recipe exists. */
  sellKind?: ProductSellKind;
  createdAt: number;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  note?: string;
  points?: number;
  createdAt: number;
};

export type CreditPayment = {
  id: string;
  customerId: string;
  amount: number;
  method: 'cash' | 'card';
  note?: string;
  /** The branch that took the money. Older rows count as the main branch. */
  branchId?: string;
  createdAt: number;
};

export type Supplier = {
  id: string;
  name: string;
  phone?: string;
  payable: number;
  createdAt: number;
};

export type StaffRole = 'owner' | 'manager' | 'cashier';

/** Member value for "not tied to one branch". Missing means the same, for logins made before branches. */
export const ALL_BRANCHES = 'all';

/** Differences from the role template: true adds a permission, false removes it. */
export type PermissionOverrides = Record<string, boolean>;

/** A staff login. `id` is the staff member's own Firebase uid. */
export type StaffMember = {
  id: string;
  name: string;
  role: StaffRole;
  /** Switched-off staff cannot sign in or read the shop. */
  active: boolean;
  /** Phone or email they sign in with, for the owner's list. */
  login?: string;
  /** Branch id, or ALL_BRANCHES. */
  branchId?: string;
  permissions?: PermissionOverrides;
  createdAt: number;
};

export type SaleReturn = {
  id: string;
  saleId: string;
  items: SaleLine[];
  refundAmount: number;
  method: 'cash' | 'card' | 'credit';
  createdAt: number;
};

export type AuditEntry = {
  id: string;
  action: string;
  detail: string;
  actorUid?: string;
  actorName?: string;
  role?: StaffRole;
  createdAt: number;
};

export type SavedOrder = {
  id: string;
  items: SaleLine[];
  total: number;
  savedAt: number;
  /** Drafts: 'quick' holds calculator amounts, otherwise product lines. */
  kind?: 'quick' | 'bill';
  customerName?: string;
  customerPhone?: string;
};

/** What a draft keeps besides its lines. */
export type DraftInfo = Pick<SavedOrder, 'kind' | 'customerName' | 'customerPhone'>;

/** One branch on one day (users/{shop}/branchDays/{branchId}_{day}). */
export type BranchDay = {
  branchId: string;
  day: string;
  opening?: number;
  /** Millis when closed; null once resumed. */
  closedAt?: number | null;
};

export type BooksMeta = {
  nextInvoice: number;
  /** Shop-wide values: the main branch's history, and every day for shops without branches. */
  openingBalances?: Record<string, number>;
  /** `${branchId}_${day}` → that branch's opening and close. Wins over the shop-wide maps. */
  branchDays?: Record<string, BranchDay>;
  /** dayKey → closedAt millis. Soft close; clear entry to resume sales. */
  closedDays?: Record<string, number>;
  /**
   * Assumed margin on quick (amount-only) sales for day profit.
   * Owner-set; default 10 when missing.
   */
  quickSaleProfitPercent?: number;
  /** Shop-specific labels (shown after Stock / Transport / Other). */
  customExpenseCategories?: string[];
};

export type Books = {
  sales: Sale[];
  expenses: Expense[];
  products: Product[];
  savedOrders: SavedOrder[];
  customers: Customer[];
  creditPayments: CreditPayment[];
  suppliers: Supplier[];
  staff: StaffMember[];
  returns: SaleReturn[];
  audit: AuditEntry[];
  meta: BooksMeta;
};

export type ShopType = 'retail' | 'kitchen';

export type ShopUser = {
  /** The shop id (the owner's uid). For staff this is their employer's shop, not their own uid. */
  uid: string;
  email: string;
  shopName: string;
  phone: string | null;
  /** retail hides Kitchen & Stock; kitchen shows it. Missing = treat as kitchen. */
  shopType?: ShopType;
  /** Missing means owner (also for phone-only shops without Firebase). */
  role?: StaffRole;
  /** Staff only: their own Firebase uid and name. */
  authUid?: string;
  staffName?: string;
  /** Staff only: branch id, or ALL_BRANCHES. */
  branchId?: string;
  /** Staff only: differences from the role template. */
  permissions?: PermissionOverrides;
};

export const EMPTY_BOOKS: Books = {
  sales: [],
  expenses: [],
  products: [],
  savedOrders: [],
  customers: [],
  creditPayments: [],
  suppliers: [],
  staff: [],
  returns: [],
  audit: [],
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
  reorderLevel?: number;
  batchNo?: string;
  expiry?: string;
  sellKind?: ProductSellKind;
};

export type QuickSaleInput = {
  amount: number;
  items?: SaleLine[];
};

export type BillCheckoutInput = {
  items: SaleLine[];
};
