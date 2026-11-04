import type { SignUpInput } from './signUpTypes';
import type { ExpenseExtras, SaleExtras } from './saleExtras';
import type {
  AuditEntry,
  BillCheckoutInput,
  Books,
  CreditPayment,
  Customer,
  DraftInfo,
  ProductInput,
  QuickSaleInput,
  SaleReturn,
  ShopUser,
  StaffMember,
  Supplier,
} from './types';

export type Repository = {
  watchBooks(
    uid: string,
    onData: (books: Books) => void,
    onError?: (message: string) => void,
  ): () => void;
  addQuickSale(uid: string, input: QuickSaleInput & SaleExtras): Promise<void>;
  checkoutBill(uid: string, input: BillCheckoutInput & SaleExtras): Promise<void>;
  deleteSale(uid: string, id: string): Promise<void>;
  addExpense(uid: string, amount: number, category: string, extra?: ExpenseExtras): Promise<void>;
  deleteExpense(uid: string, id: string): Promise<void>;
  addProduct(uid: string, input: ProductInput): Promise<void>;
  deleteProduct(uid: string, id: string): Promise<void>;
  updateProduct(uid: string, id: string, input: ProductInput): Promise<void>;
  saveOrder(uid: string, items: BillCheckoutInput['items'], info?: DraftInfo): Promise<void>;
  deleteSavedOrder(uid: string, id: string): Promise<void>;
  updateShopName(uid: string, shopName: string): Promise<void>;
  updateShopType(uid: string, shopType: 'retail' | 'kitchen'): Promise<void>;
  setOpeningBalance(uid: string, dayKey: string, amount: number): Promise<void>;
  /** Soft day close. Pass null closedAt to resume (clear the mark). */
  setDayClosed(uid: string, dayKey: string, closedAt: number | null): Promise<void>;
  setQuickSaleProfitPercent(uid: string, percent: number): Promise<void>;
  addCustomExpenseCategory(uid: string, name: string): Promise<string>;
  updateSale(uid: string, id: string, patch: { note?: string; customerName?: string; customerPhone?: string; paymentMode?: SaleExtras['paymentMode']; editedAt?: number; createdAt?: number }): Promise<void>;
  addCustomer(uid: string, input: { name: string; phone: string; note?: string }): Promise<string>;
  addCreditPayment(uid: string, input: Omit<CreditPayment, 'id' | 'createdAt'>): Promise<void>;
  addSupplier(uid: string, input: { name: string; phone?: string; payable: number }): Promise<void>;
  /** Create supplier if needed, or add `amount` to an existing name (case-insensitive). */
  addSupplierPayable(uid: string, name: string, amount: number, phone?: string): Promise<void>;
  /** Reduce payable when you pay a supplier (amount > 0). */
  paySupplier(uid: string, supplierId: string, amount: number): Promise<void>;
  addStaff(uid: string, input: { name: string; role: StaffMember['role'] }): Promise<void>;
  addAudit(uid: string, input: Omit<AuditEntry, 'id' | 'createdAt'> & { actorUid: string }): Promise<void>;
  addReturn(uid: string, input: Omit<SaleReturn, 'id' | 'createdAt'>): Promise<void>;
  importProducts(uid: string, rows: ProductInput[]): Promise<number>;
};

export type AuthService = {
  cloud: boolean;
  subscribe(onUser: (user: ShopUser | null) => void): () => void;
  signIn(identity: string, password: string): Promise<ShopUser>;
  signUp(identity: string, password: string, input: SignUpInput): Promise<ShopUser>;
  resetPassword(identity: string, nextPassword?: string): Promise<string>;
  signOut(): Promise<void>;
};

export function accountIdentity(identity: string): { email: string; phone: string | null } {
  const trimmed = identity.trim();
  if (!trimmed) {
    throw new Error('Enter your email or phone number.');
  }
  if (trimmed.includes('@')) {
    const email = trimmed.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Enter a valid email address.');
    }
    return { email, phone: null };
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) {
    throw new Error('Enter a valid email or phone number.');
  }
  return { email: `${digits}@phone.kadabook.app`, phone: digits };
}

export function isPhoneAuthEmail(email: string) {
  return email.endsWith('@phone.kadabook.app');
}

export function assertPassword(password: string) {
  if (password.length < 6) {
    throw new Error('Use a password of at least 6 characters.');
  }
}

export function displayAccount(user: ShopUser) {
  return user.phone ?? user.email;
}
