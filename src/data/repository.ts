import type { SignUpInput } from './signUpTypes';
import type {
  BillCheckoutInput,
  Books,
  ProductInput,
  QuickSaleInput,
  ShopUser,
} from './types';

export type Repository = {
  watchBooks(
    uid: string,
    onData: (books: Books) => void,
    onError?: (message: string) => void,
  ): () => void;
  addQuickSale(uid: string, input: QuickSaleInput): Promise<void>;
  checkoutBill(uid: string, input: BillCheckoutInput): Promise<void>;
  deleteSale(uid: string, id: string): Promise<void>;
  addExpense(uid: string, amount: number, category: string): Promise<void>;
  deleteExpense(uid: string, id: string): Promise<void>;
  addProduct(uid: string, input: ProductInput): Promise<void>;
  deleteProduct(uid: string, id: string): Promise<void>;
  saveOrder(uid: string, items: BillCheckoutInput['items']): Promise<void>;
  deleteSavedOrder(uid: string, id: string): Promise<void>;
  updateShopName(uid: string, shopName: string): Promise<void>;
  setOpeningBalance(uid: string, dayKey: string, amount: number): Promise<void>;
  addCustomExpenseCategory(uid: string, name: string): Promise<string>;
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
