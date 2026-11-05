import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import { repository, usingCloud } from '../data/services';
import { waitForFirebaseAuth } from '../firebase/client';
import {
  ALL_BRANCHES,
  EMPTY_BOOKS,
  type BillCheckoutInput,
  type Books,
  type DraftInfo,
  type ProductInput,
  type SaleLine,
  type SaleReturn,
} from '../data/types';
import { SIMPLE_SELL_CATALOG } from '../data/simpleSellCatalog';
import { usesKitchenStock } from '../lib/shopType';
import { assertBillItems, billTotal, stampSaleLineCosts } from '../lib/saleOps';
import { branchDayId, dayClosedAt, dayKey, isDayClosed, openingBalanceForDay, type DayBranch } from '../lib/dayKey';
import { formatRs } from '../lib/format';
import { can, type Permission } from '../lib/roles';
import { saleStockLines } from '../lib/stockEngine';
import { customerBalance, findCustomerByPhone } from '../lib/shopPlus';
import {
  cleanExpenseExtras,
  cleanSaleExtras,
  type ExpenseExtras,
  type SaleExtras,
  type SaleExtrasInput,
} from '../data/saleExtras';

const DAY_CLOSED_MESSAGE = 'Today is closed. Tap Resume sales on Home to continue.';

type BooksContextValue = {
  books: Books;
  loading: boolean;
  error: string | null;
  /** The branch this device's opening, close and new entries apply to. Set by KitchenProvider. */
  dayBranch: DayBranch;
  setDayBranch: (branch: DayBranch) => void;
  /** Soft close of dayBranch: new sales blocked until resumeToday. */
  todayClosed: boolean;
  closeToday: () => Promise<void>;
  resumeToday: () => Promise<void>;
  addQuickSale: (amount: number, items?: SaleLine[], extras?: SaleExtrasInput) => Promise<void>;
  checkoutBill: (items: SaleLine[], extras?: SaleExtrasInput) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  /** Bulk import from Excel / CSV. Returns how many were added. */
  importProducts: (rows: ProductInput[]) => Promise<number>;
  /** Adds a line to the shop's audit log, signed with who did it. Never throws. */
  logAudit: (action: string, detail: string) => void;
  /** Note, customer and date change on a saved sale. */
  updateSale: (id: string, patch: { note?: string; customerName?: string; customerPhone?: string; createdAt?: number }) => Promise<void>;
  addExpense: (amount: number, category: string, extra?: ExpenseExtras) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  addProduct: (input: ProductInput) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  updateProduct: (id: string, input: ProductInput) => Promise<void>;
  saveOrder: (items: SaleLine[], info?: DraftInfo) => Promise<void>;
  deleteSavedOrder: (id: string) => Promise<void>;
  setTodayOpeningBalance: (amount: number) => Promise<void>;
  /** Owner only: change today's saved opening balance. */
  editTodayOpeningBalance: (amount: number) => Promise<void>;
  setQuickSaleProfitPercent: (percent: number) => Promise<void>;
  addCustomExpenseCategory: (name: string) => Promise<string>;
  /** Money collected from a customer against their credit balance. */
  collectPayment: (customerId: string, amount: number, method: 'cash' | 'card', note?: string) => Promise<void>;
  /** Refund a bill and put returned item quantities back into stock. */
  addReturn: (input: Omit<SaleReturn, 'id' | 'createdAt'>) => Promise<void>;
  /** Add or increase a supplier payable (kitchen credit purchase). */
  addSupplierPayable: (name: string, amount: number, phone?: string) => Promise<void>;
  /** Record a payment that reduces what you owe a supplier. */
  paySupplier: (supplierId: string, amount: number) => Promise<void>;
  /** Create a supplier with an optional starting balance. */
  addSupplier: (input: { name: string; phone?: string; payable?: number }) => Promise<void>;
};

const BooksContext = createContext<BooksContextValue | null>(null);

function assertAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Enter an amount greater than 0.');
  }
  if (amount >= 100000000) {
    throw new Error('That amount is too large.');
  }
}

export function BooksProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [books, setBooks] = useState<Books>(EMPTY_BOOKS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Bumps at midnight / app resume so todayClosed does not stick after calendar day change. */
  const [calendarDay, setCalendarDay] = useState(() => dayKey());
  const removingSampleProducts = useRef(false);
  const [dayBranch, setDayBranchState] = useState<DayBranch>(null);
  const setDayBranch = useCallback((next: DayBranch) => {
    setDayBranchState((prev) =>
      prev?.id === next?.id && prev?.isMain === next?.isMain && prev?.name === next?.name ? prev : next,
    );
  }, []);

  useEffect(() => {
    const syncDay = () => setCalendarDay(dayKey());
    syncDay();
    const timer = setInterval(syncDay, 60_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncDay();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setBooks(EMPTY_BOOKS);
      setLoading(false);
      removingSampleProducts.current = false;
      return;
    }
    setLoading(true);
    setError(null);
    const loadingCap = setTimeout(() => setLoading(false), 8000);
    let unsub = () => {};
    let cancelled = false;

    (async () => {
      if (usingCloud) {
        try {
          await waitForFirebaseAuth();
        } catch {
          /* continue — watchBooks will surface errors */
        }
      }
      if (cancelled) return;
      const lockedBranch = user.branchId && user.branchId !== ALL_BRANCHES ? user.branchId : undefined;
      unsub = repository.watchBooks(
        user.uid,
        (next) => {
          setBooks(next);
          setLoading(false);
          setError(null);
        },
        (message) => {
          setError(message);
          setLoading(false);
        },
        {
          branchId: lockedBranch,
          staffList: !user.role || user.role === 'owner',
          auditLog: !lockedBranch && can(user, 'viewAudit'),
        },
      );
    })();

    return () => {
      cancelled = true;
      clearTimeout(loadingCap);
      unsub();
    };
  }, [user]);

  // Kitchen shops: remove demo drinks/snacks (Coke, water bottle…) — no more auto-seed.
  useEffect(() => {
    if (!user || loading || removingSampleProducts.current) return;
    if (!usesKitchenStock(user.shopType)) return;
    if (!can(user, 'manageProducts')) return;
    const sampleNames = new Set(SIMPLE_SELL_CATALOG.map((row) => row.name.trim().toLowerCase()));
    const toDelete = books.products.filter((p) => sampleNames.has(p.name.trim().toLowerCase()));
    if (!toDelete.length) return;
    removingSampleProducts.current = true;
    let cancelled = false;
    (async () => {
      for (const product of toDelete) {
        if (cancelled) return;
        try {
          await repository.deleteProduct(user.uid, product.id);
        } catch {
          /* ignore one-row failures */
        }
      }
      removingSampleProducts.current = false;
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, books.products]);

  // Kitchen: Food-category rows must be sellKind menu so Recipes lists them.
  const repairingFoodSellKind = useRef(false);
  useEffect(() => {
    if (!user || loading || repairingFoodSellKind.current) return;
    if (!usesKitchenStock(user.shopType)) return;
    if (!can(user, 'manageProducts')) return;
    const broken = books.products.filter(
      (p) => (p.category ?? '').trim().toLowerCase() === 'food' && p.sellKind !== 'menu',
    );
    if (!broken.length) return;
    repairingFoodSellKind.current = true;
    let cancelled = false;
    (async () => {
      for (const product of broken) {
        if (cancelled) return;
        try {
          await repository.updateProduct(user.uid, product.id, {
            name: product.name,
            sellingPrice: product.sellingPrice,
            purchasePrice: product.purchasePrice,
            stock: product.stock,
            unit: product.unit || 'pcs',
            category: product.category || 'Food',
            barcode: product.barcode,
            reorderLevel: product.reorderLevel,
            batchNo: product.batchNo,
            expiry: product.expiry,
            sellKind: 'menu',
          });
        } catch {
          /* ignore one-row failures */
        }
      }
      repairingFoodSellKind.current = false;
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, books.products]);

  const value = useMemo<BooksContextValue>(() => {
    const uid = user?.uid;
    // Only *this* calendar day counts — yesterday's close never shows Resume.
    const todayClosed = isDayClosed(books.meta, Date.now(), dayBranch);

    function assertDayOpen() {
      if (isDayClosed(books.meta, Date.now(), dayBranch)) throw new Error(DAY_CLOSED_MESSAGE);
    }

    function assertCan(permission: Permission) {
      if (!can(user, permission)) throw new Error('You do not have permission to do this. Ask the shop owner.');
    }

    /** A staff member tied to one branch always works there, whatever the screen sends. */
    const lockedBranchId = user?.branchId && user.branchId !== ALL_BRANCHES ? user.branchId : undefined;
    const entryBranchId = (asked?: string) => lockedBranchId ?? asked ?? dayBranch?.id;

    function saleStamp(clean: SaleExtras): SaleExtras {
      const branchId = entryBranchId(clean.branchId);
      return {
        ...clean,
        ...(branchId ? { branchId } : {}),
        ...(uid && user ? { soldByUid: user.authUid ?? uid, soldByName: user.staffName ?? 'Owner' } : {}),
      };
    }

    /** Writes a day's close mark to the local copy so banners flip before the snapshot lands. */
    function patchClosed(key: string, closedAt: number | null) {
      setBooks((prev) => {
        if (dayBranch) {
          const id = branchDayId(dayBranch.id, key);
          const row = { ...prev.meta.branchDays?.[id], branchId: dayBranch.id, day: key, closedAt };
          return { ...prev, meta: { ...prev.meta, branchDays: { ...(prev.meta.branchDays ?? {}), [id]: row } } };
        }
        const closedDays = { ...(prev.meta.closedDays ?? {}) };
        if (closedAt == null) delete closedDays[key];
        else closedDays[key] = closedAt;
        return { ...prev, meta: { ...prev.meta, closedDays } };
      });
    }

    async function writeClosed(shopUid: string, key: string, closedAt: number | null) {
      if (!dayBranch) {
        await repository.setDayClosed(shopUid, key, closedAt);
        return;
      }
      await repository.setBranchClosed(shopUid, dayBranch.id, key, closedAt);
      // A close from before branches is cleared too, for those allowed to touch the shop-wide marks.
      if (closedAt == null && dayBranch.isMain && !lockedBranchId && books.meta.closedDays?.[key]) {
        await repository.setDayClosed(shopUid, key, null);
      }
    }

    async function writeOpening(shopUid: string, key: string, value: number) {
      if (dayBranch) await repository.setBranchOpening(shopUid, dayBranch.id, key, value);
      else await repository.setOpeningBalance(shopUid, key, value);
    }

    function logAudit(action: string, detail: string) {
      if (!uid || !user) return;
      repository
        .addAudit(uid, {
          action,
          detail,
          actorUid: user.authUid ?? uid,
          actorName: user.staffName ?? 'Owner',
          role: user.role ?? 'owner',
        })
        .catch(() => undefined);
    }
    const saleLabel = (id: string) => {
      const sale = books.sales.find((s) => s.id === id);
      return sale ? `${sale.invoiceNo ? `#${sale.invoiceNo} ` : ''}Rs. ${sale.amount.toLocaleString('en-IN')} (${new Date(sale.createdAt).toLocaleString('en-GB')})` : id;
    };

    /** Links the sale to a customer by phone. A new phone creates the customer on the spot. */
    async function attachCustomer(shopUid: string, typedName: string | undefined, clean: SaleExtras): Promise<SaleExtras> {
      if (!clean.customerPhone) return clean;
      const existing = findCustomerByPhone(books.customers, clean.customerPhone);
      if (existing) {
        return { ...clean, customerId: existing.id, customerName: typedName ? clean.customerName : existing.name };
      }
      const name = clean.customerName ?? `Customer ${clean.customerPhone}`;
      const customerId = await repository.addCustomer(shopUid, { name, phone: clean.customerPhone });
      return { ...clean, customerId, customerName: name };
    }

    return {
      books,
      loading,
      error,
      dayBranch,
      setDayBranch,
      todayClosed,
      async closeToday() {
        if (!uid) return;
        assertCan('closeDay');
        const key = dayKey();
        const closedAt = Date.now();
        const before = dayClosedAt(books.meta, closedAt, dayBranch);
        // Optimistic UI so Home / New Sale banner flip before the snapshot lands.
        patchClosed(key, closedAt);
        try {
          await writeClosed(uid, key, closedAt);
          logAudit('Day closed', dayBranch ? `${key} (${dayBranch.name ?? dayBranch.id})` : key);
        } catch (error) {
          patchClosed(key, before);
          throw error;
        }
      },
      async resumeToday() {
        if (!uid) return;
        assertCan('closeDay');
        const key = dayKey();
        const before = dayClosedAt(books.meta, Date.now(), dayBranch);
        patchClosed(key, null);
        try {
          await writeClosed(uid, key, null);
          logAudit('Day resumed', dayBranch ? `${key} (${dayBranch.name ?? dayBranch.id})` : key);
        } catch (error) {
          patchClosed(key, before);
          throw error;
        }
      },
      async addQuickSale(amount, items, extras) {
        if (!uid) return;
        assertCan('addSale');
        assertDayOpen();
        const rawLines = items?.filter((line) => line.name.trim() && line.unitPrice > 0) ?? [];
        const lines = rawLines.length ? stampSaleLineCosts(rawLines, books.products) : [];
        const subtotal = lines.length ? billTotal(lines) : Math.round(amount);
        assertAmount(subtotal);
        if (lines.length) {
          assertBillItems(lines);
        }
        const clean = await attachCustomer(uid, extras?.customerName?.trim(), cleanSaleExtras(extras, subtotal));
        assertAmount(subtotal);
        await repository.addQuickSale(uid, {
          amount: subtotal,
          items: lines.length ? lines : undefined,
          ...saleStamp(clean),
        });
      },
      async checkoutBill(items, extras) {
        if (!uid) return;
        assertCan('addSale');
        assertDayOpen();
        const stamped = stampSaleLineCosts(items, books.products);
        // The repository works out the bill total; it takes `discount` off that total.
        const clean = await attachCustomer(uid, extras?.customerName?.trim(), cleanSaleExtras(extras, billTotal(stamped)));
        const payload: BillCheckoutInput = { items: stamped, ...saleStamp(clean) };
        const branchId = entryBranchId(clean.branchId);
        const lines = saleStockLines(stamped, books.products);
        await repository.checkoutBill(uid, payload, branchId && lines.length ? { branchId, lines } : undefined);
      },
      logAudit,
      async updateSale(id, patch) {
        if (!uid) return;
        assertCan('editSale');
        const before = books.sales.find((s) => s.id === id);
        const note = patch.note?.trim().slice(0, 120);
        if (patch.createdAt !== undefined && (!Number.isFinite(patch.createdAt) || patch.createdAt > Date.now() + 60_000)) {
          throw new Error('The sale date cannot be in the future.');
        }
        await repository.updateSale(uid, id, {
          note: patch.note === undefined ? undefined : note ?? '',
          customerName: patch.customerName?.trim().slice(0, 60),
          customerPhone: patch.customerPhone?.trim().slice(0, 20),
          createdAt: patch.createdAt,
        });
        const changes = [
          patch.createdAt !== undefined && before && patch.createdAt !== before.createdAt
            ? `date → ${new Date(patch.createdAt).toLocaleDateString('en-GB')}`
            : null,
          patch.note !== undefined && (before?.note ?? '') !== (note ?? '') ? `note "${note ?? ''}"` : null,
          patch.customerPhone !== undefined && (before?.customerPhone ?? '') !== (patch.customerPhone ?? '') ? 'customer' : null,
        ].filter(Boolean);
        if (changes.length) logAudit('Sale edited', `${saleLabel(id)}: ${changes.join(', ')}`);
      },
      async importProducts(rows) {
        if (!uid) return 0;
        assertCan('manageProducts');
        if (!rows.length) throw new Error('No products to import.');
        const count = await repository.importProducts(uid, rows);
        logAudit('Products imported', `${count} products from a file`);
        return count;
      },
      async deleteSale(id) {
        if (!uid) return;
        assertCan('deleteSale');
        const label = saleLabel(id);
        await repository.deleteSale(uid, id);
        logAudit('Sale deleted', label);
      },
      async addExpense(amount, category, extra) {
        if (!uid) return;
        assertCan('addExpense');
        assertAmount(amount);
        const clean = cleanExpenseExtras(extra);
        const branchId = entryBranchId(clean.branchId);
        await repository.addExpense(uid, Math.round(amount), category, { ...clean, ...(branchId ? { branchId } : {}) });
      },
      async deleteExpense(id) {
        if (!uid) return;
        assertCan('addExpense');
        const expense = books.expenses.find((e) => e.id === id);
        await repository.deleteExpense(uid, id);
        logAudit('Expense deleted', expense ? `${expense.category} Rs. ${expense.amount}` : id);
      },
      async addProduct(input) {
        if (!uid) return;
        assertCan('manageProducts');
        const trimmed = input.name.trim();
        if (!trimmed) throw new Error('Enter a product name.');
        if (!Number.isFinite(input.sellingPrice) || input.sellingPrice < 0) {
          throw new Error('Enter a valid selling price.');
        }
        if (!Number.isFinite(input.purchasePrice) || input.purchasePrice < 0) {
          throw new Error('Enter a valid purchase price.');
        }
        if (!Number.isFinite(input.stock) || input.stock < 0) {
          throw new Error('Enter a valid stock quantity.');
        }
        await repository.addProduct(uid, {
          ...input,
          name: trimmed,
          unit: input.unit.trim() || 'pcs',
          category: input.category.trim() || 'General',
          sellKind: input.sellKind === 'menu' ? 'menu' : 'simple',
        });
      },
      async deleteProduct(id) {
        if (!uid) return;
        assertCan('manageProducts');
        const product = books.products.find((x) => x.id === id);
        await repository.deleteProduct(uid, id);
        logAudit('Product deleted', product?.name ?? id);
      },
      async updateProduct(id, input) {
        if (!uid) return;
        assertCan('manageProducts');
        const trimmed = input.name.trim();
        if (!trimmed) throw new Error('Enter a product name.');
        if (!Number.isFinite(input.sellingPrice) || input.sellingPrice < 0) {
          throw new Error('Enter a valid selling price.');
        }
        if (!Number.isFinite(input.purchasePrice) || input.purchasePrice < 0) {
          throw new Error('Enter a valid purchase price.');
        }
        if (!Number.isFinite(input.stock) || input.stock < 0) {
          throw new Error('Enter a valid stock quantity.');
        }
        const before = books.products.find((x) => x.id === id);
        await repository.updateProduct(uid, id, {
          ...input,
          name: trimmed,
          unit: input.unit.trim() || 'pcs',
          category: input.category.trim() || 'General',
          sellKind: input.sellKind === 'menu' ? 'menu' : 'simple',
        });
        const changes = [
          before && before.sellingPrice !== input.sellingPrice ? `price ${before.sellingPrice} → ${input.sellingPrice}` : null,
          before && before.purchasePrice !== input.purchasePrice ? `cost ${before.purchasePrice} → ${input.purchasePrice}` : null,
          before && before.stock !== input.stock ? `stock ${before.stock} → ${input.stock}` : null,
        ].filter(Boolean);
        if (changes.length) logAudit('Product changed', `${trimmed}: ${changes.join(', ')}`);
      },
      async saveOrder(items, info) {
        if (!uid) return;
        assertCan('addSale');
        const branchId = entryBranchId(info?.branchId);
        await repository.saveOrder(uid, items, { ...info, ...(branchId ? { branchId } : {}) });
      },
      async deleteSavedOrder(id) {
        if (!uid) return;
        await repository.deleteSavedOrder(uid, id);
      },
      async setTodayOpeningBalance(amount) {
        if (!uid) return;
        const value = Math.max(0, Math.round(amount));
        await writeOpening(uid, dayKey(), value);
      },
      async editTodayOpeningBalance(amount) {
        if (!uid) return;
        if ((user?.role ?? 'owner') !== 'owner') throw new Error('Only the shop owner can edit the opening balance.');
        const value = Math.max(0, Math.round(amount));
        const before = openingBalanceForDay(books.meta, Date.now(), dayBranch);
        if (value === before) return;
        await writeOpening(uid, dayKey(), value);
        logAudit('Opening balance changed', `${formatRs(before)} → ${formatRs(value)}`);
      },
      async setQuickSaleProfitPercent(percent) {
        if (!uid) return;
        await repository.setQuickSaleProfitPercent(uid, percent);
        logAudit('Quick profit %', `${Math.round(percent)}%`);
      },
      async addCustomExpenseCategory(name) {
        if (!uid) throw new Error('Sign in to add categories.');
        return repository.addCustomExpenseCategory(uid, name);
      },
      async collectPayment(customerId, amount, method, note) {
        if (!uid) return;
        assertCan('collectCredit');
        assertAmount(amount);
        const value = Math.round(amount);
        const due = customerBalance(books, customerId);
        if (value > due) throw new Error(`This customer owes only ${formatRs(due)}.`);
        await repository.addCreditPayment(uid, {
          customerId,
          amount: value,
          method,
          note: note?.trim() || undefined,
          branchId: entryBranchId(),
        }, lockedBranchId);
      },
      async addReturn(input) {
        if (!uid) return;
        assertCan('editSale');
        const refund = Math.round(input.refundAmount);
        assertAmount(refund);
        const sale = books.sales.find((s) => s.id === input.saleId);
        const branchId = entryBranchId(input.branchId ?? sale?.branchId);
        const lines = saleStockLines(input.items, books.products);
        await repository.addReturn(
          uid,
          { ...input, refundAmount: refund, items: input.items, ...(branchId ? { branchId } : {}) },
          branchId && lines.length ? { branchId, lines } : undefined,
        );
        logAudit('Bill returned', `Rs. ${refund} on ${input.saleId}`);
      },
      async addSupplier(input) {
        if (!uid) return;
        const name = input.name.trim();
        if (!name) throw new Error('Enter a supplier name.');
        const payable = Math.round(input.payable ?? 0);
        if (!Number.isFinite(payable) || payable < 0) throw new Error('Enter a valid payable amount.');
        await repository.addSupplier(uid, { name, phone: input.phone, payable });
        logAudit('Supplier added', name);
      },
      async addSupplierPayable(name, amount, phone) {
        if (!uid) return;
        assertAmount(amount);
        await repository.addSupplierPayable(uid, name, Math.round(amount), phone);
        logAudit('Supplier payable', `${name.trim()}: +Rs. ${Math.round(amount)}`);
      },
      async paySupplier(supplierId, amount) {
        if (!uid) return;
        assertAmount(amount);
        const row = books.suppliers.find((s) => s.id === supplierId);
        await repository.paySupplier(uid, supplierId, Math.round(amount));
        logAudit('Supplier paid', `${row?.name ?? supplierId}: Rs. ${Math.round(amount)}`);
      },
    };
  }, [books, calendarDay, dayBranch, error, loading, setDayBranch, user]);

  return <BooksContext.Provider value={value}>{children}</BooksContext.Provider>;
}

export function useBooks() {
  const value = useContext(BooksContext);
  if (!value) throw new Error('useBooks must be used inside BooksProvider');
  return value;
}
