import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeBooks } from '../lib/booksNormalize';
import { expenseCategoriesForShop, normalizeCustomExpenseCategory } from '../lib/expenseCategories';
import {
  assertBillItems,
  assertStock,
  buildBillSale,
  buildQuickSale,
  billTotal,
  deductStock,
  nextInvoiceNo,
} from '../lib/saleOps';
import { accountIdentity, assertPassword, type AuthService, type Repository } from './repository';
import type { SignUpInput } from './signUpTypes';
import { EMPTY_BOOKS, type Books, type ShopUser } from './types';

type StoredAccount = ShopUser & { passwordHash: string };

const ACCOUNTS = 'kb_accounts';
const SESSION = 'kb_session';

function booksKey(uid: string) {
  return `kb_books_${uid}`;
}

function hash(value: string) {
  let h = 5381;
  for (let i = 0; i < value.length; i += 1) {
    h = ((h << 5) + h) ^ value.charCodeAt(i);
  }
  return String(h >>> 0);
}

function id() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readAccounts(): Promise<StoredAccount[]> {
  const raw = await AsyncStorage.getItem(ACCOUNTS);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as StoredAccount[];
  return Array.isArray(parsed) ? parsed : [];
}

async function writeAccounts(accounts: StoredAccount[]) {
  await AsyncStorage.setItem(ACCOUNTS, JSON.stringify(accounts));
}

const bookListeners = new Map<string, Set<(books: Books) => void>>();
const sessionListeners = new Set<(user: ShopUser | null) => void>();
let sessionTicket = 0;

async function emitSession() {
  const ticket = ++sessionTicket;
  const uid = await AsyncStorage.getItem(SESSION);
  if (ticket !== sessionTicket) return;
  if (!uid) {
    sessionListeners.forEach((listener) => listener(null));
    return;
  }
  const account = (await readAccounts()).find((item) => item.uid === uid);
  if (ticket !== sessionTicket) return;
  sessionListeners.forEach((listener) => listener(account ? publicUser(account) : null));
}

async function readBooks(uid: string): Promise<Books> {
  const raw = await AsyncStorage.getItem(booksKey(uid));
  if (!raw) return EMPTY_BOOKS;
  return normalizeBooks(JSON.parse(raw) as Books);
}

async function writeBooks(uid: string, books: Books) {
  await AsyncStorage.setItem(booksKey(uid), JSON.stringify(books));
  bookListeners.get(uid)?.forEach((listener) => listener(books));
}

function publicUser(account: StoredAccount): ShopUser {
  return {
    uid: account.uid,
    email: account.email,
    shopName: account.shopName,
    phone: account.phone,
  };
}

export const localAuth: AuthService = {
  cloud: false,
  subscribe(onUser) {
    sessionListeners.add(onUser);
    onUser(null);
    void emitSession();
    return () => {
      sessionListeners.delete(onUser);
    };
  },
  async signIn(identity, password) {
    assertPassword(password);
    const { email } = accountIdentity(identity);
    const account = (await readAccounts()).find((item) => item.email === email);
    if (!account || account.passwordHash !== hash(password)) {
      throw new Error('Email or password is incorrect.');
    }
    await AsyncStorage.setItem(SESSION, account.uid);
    await emitSession();
    return publicUser(account);
  },
  async signUp(identity, password, input: SignUpInput) {
    assertPassword(password);
    const name = input.shopName.trim();
    if (!name) throw new Error('Enter your shop name.');
    const { email, phone } = accountIdentity(identity);
    const accounts = await readAccounts();
    if (accounts.some((item) => item.email === email)) {
      throw new Error('An account with that email or phone already exists.');
    }
    const account: StoredAccount = {
      uid: id(),
      email,
      phone,
      shopName: name,
      passwordHash: hash(password),
    };
    accounts.push(account);
    await writeAccounts(accounts);
    await AsyncStorage.setItem(SESSION, account.uid);
    await emitSession();
    return publicUser(account);
  },
  async resetPassword(identity, nextPassword) {
    assertPassword(nextPassword ?? '');
    const { email } = accountIdentity(identity);
    const accounts = await readAccounts();
    const account = accounts.find((item) => item.email === email);
    if (!account) throw new Error('No account with that email or phone on this phone.');
    account.passwordHash = hash(nextPassword ?? '');
    await writeAccounts(accounts);
    return 'Password updated on this phone.';
  },
  async signOut() {
    await AsyncStorage.removeItem(SESSION);
    await emitSession();
  },
};

export const localRepository: Repository = {
  watchBooks(uid, onData) {
    let active = true;
    const set = bookListeners.get(uid) ?? new Set();
    set.add(onData);
    bookListeners.set(uid, set);
    readBooks(uid).then((books) => {
      if (active) onData(books);
    });
    return () => {
      active = false;
      set.delete(onData);
    };
  },
  async addQuickSale(uid, input) {
    const books = await readBooks(uid);
    const invoiceNo = nextInvoiceNo(books);
    books.sales.unshift({
      id: id(),
      createdAt: Date.now(),
      ...buildQuickSale(input.amount, invoiceNo, input.items),
    });
    await writeBooks(uid, books);
  },
  async checkoutBill(uid, input) {
    assertBillItems(input.items);
    const books = await readBooks(uid);
    assertStock(books, input.items);
    const invoiceNo = nextInvoiceNo(books);
    deductStock(books, input.items);
    books.sales.unshift({
      id: id(),
      createdAt: Date.now(),
      ...buildBillSale(input.items, invoiceNo),
    });
    await writeBooks(uid, books);
  },
  async deleteSale(uid, saleId) {
    const books = await readBooks(uid);
    books.sales = books.sales.filter((sale) => sale.id !== saleId);
    await writeBooks(uid, books);
  },
  async addExpense(uid, amount, category) {
    const books = await readBooks(uid);
    books.expenses.unshift({ id: id(), amount, category, createdAt: Date.now() });
    await writeBooks(uid, books);
  },
  async deleteExpense(uid, expenseId) {
    const books = await readBooks(uid);
    books.expenses = books.expenses.filter((expense) => expense.id !== expenseId);
    await writeBooks(uid, books);
  },
  async addProduct(uid, input) {
    const books = await readBooks(uid);
    books.products.unshift({
      id: id(),
      name: input.name.trim(),
      sellingPrice: Math.round(input.sellingPrice),
      purchasePrice: Math.round(input.purchasePrice),
      stock: input.stock,
      unit: input.unit.trim() || 'pcs',
      category: input.category.trim() || 'General',
      barcode: input.barcode?.trim(),
      createdAt: Date.now(),
    });
    await writeBooks(uid, books);
  },
  async deleteProduct(uid, productId) {
    const books = await readBooks(uid);
    books.products = books.products.filter((product) => product.id !== productId);
    await writeBooks(uid, books);
  },
  async saveOrder(uid, items) {
    assertBillItems(items);
    const books = await readBooks(uid);
    books.savedOrders.unshift({
      id: id(),
      items,
      total: billTotal(items),
      savedAt: Date.now(),
    });
    await writeBooks(uid, books);
  },
  async deleteSavedOrder(uid, orderId) {
    const books = await readBooks(uid);
    books.savedOrders = books.savedOrders.filter((order) => order.id !== orderId);
    await writeBooks(uid, books);
  },
  async updateShopName(uid, shopName) {
    const accounts = await readAccounts();
    const account = accounts.find((item) => item.uid === uid);
    if (!account) return;
    account.shopName = shopName.trim();
    await writeAccounts(accounts);
    await emitSession();
  },
  async setOpeningBalance(uid, dayKey, amount) {
    const books = await readBooks(uid);
    const balances = { ...(books.meta.openingBalances ?? {}), [dayKey]: Math.round(amount) };
    books.meta = { ...books.meta, openingBalances: balances };
    await writeBooks(uid, books);
  },
  async addCustomExpenseCategory(uid, name) {
    const label = normalizeCustomExpenseCategory(name);
    if (!label) throw new Error('Enter a category name.');
    const books = await readBooks(uid);
    const existing = expenseCategoriesForShop(books.meta);
    if (existing.some((item) => item.toLowerCase() === label.toLowerCase())) {
      throw new Error('That category already exists.');
    }
    const custom = [...(books.meta.customExpenseCategories ?? []), label];
    books.meta = { ...books.meta, customExpenseCategories: custom };
    await writeBooks(uid, books);
    return label;
  },
};
