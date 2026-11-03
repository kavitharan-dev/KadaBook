import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { repository, usingCloud } from '../data/services';
import { waitForFirebaseAuth } from '../firebase/client';
import {
  EMPTY_BOOKS,
  type BillCheckoutInput,
  type Books,
  type DraftInfo,
  type ProductInput,
  type SaleLine,
  type SaleReturn,
} from '../data/types';
import { assertBillItems, billTotal } from '../lib/saleOps';
import { dayKey } from '../lib/dayKey';
import { formatRs } from '../lib/format';
import { customerBalance, findCustomerByPhone } from '../lib/shopPlus';
import {
  cleanExpenseExtras,
  cleanSaleExtras,
  type ExpenseExtras,
  type SaleExtras,
  type SaleExtrasInput,
} from '../data/saleExtras';

type BooksContextValue = {
  books: Books;
  loading: boolean;
  error: string | null;
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

  useEffect(() => {
    if (!user) {
      setBooks(EMPTY_BOOKS);
      setLoading(false);
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
      );
    })();

    return () => {
      cancelled = true;
      clearTimeout(loadingCap);
      unsub();
    };
  }, [user]);

  const value = useMemo<BooksContextValue>(() => {
    const uid = user?.uid;

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
      async addQuickSale(amount, items, extras) {
        if (!uid) return;
        const lines = items?.filter((line) => line.name.trim() && line.unitPrice > 0) ?? [];
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
          ...clean,
        });
      },
      async checkoutBill(items, extras) {
        if (!uid) return;
        // The repository works out the bill total; it takes `discount` off that total.
        const clean = await attachCustomer(uid, extras?.customerName?.trim(), cleanSaleExtras(extras, billTotal(items)));
        const payload: BillCheckoutInput = { items, ...clean };
        await repository.checkoutBill(uid, payload);
      },
      logAudit,
      async updateSale(id, patch) {
        if (!uid) return;
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
        if (!rows.length) throw new Error('No products to import.');
        const count = await repository.importProducts(uid, rows);
        logAudit('Products imported', `${count} products from a file`);
        return count;
      },
      async deleteSale(id) {
        if (!uid) return;
        const label = saleLabel(id);
        await repository.deleteSale(uid, id);
        logAudit('Sale deleted', label);
      },
      async addExpense(amount, category, extra) {
        if (!uid) return;
        assertAmount(amount);
        await repository.addExpense(uid, Math.round(amount), category, cleanExpenseExtras(extra));
      },
      async deleteExpense(id) {
        if (!uid) return;
        const expense = books.expenses.find((e) => e.id === id);
        await repository.deleteExpense(uid, id);
        logAudit('Expense deleted', expense ? `${expense.category} Rs. ${expense.amount}` : id);
      },
      async addProduct(input) {
        if (!uid) return;
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
        });
      },
      async deleteProduct(id) {
        if (!uid) return;
        const product = books.products.find((x) => x.id === id);
        await repository.deleteProduct(uid, id);
        logAudit('Product deleted', product?.name ?? id);
      },
      async updateProduct(id, input) {
        if (!uid) return;
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
        await repository.saveOrder(uid, items, info);
      },
      async deleteSavedOrder(id) {
        if (!uid) return;
        await repository.deleteSavedOrder(uid, id);
      },
      async setTodayOpeningBalance(amount) {
        if (!uid) return;
        const value = Math.max(0, Math.round(amount));
        await repository.setOpeningBalance(uid, dayKey(), value);
      },
      async addCustomExpenseCategory(name) {
        if (!uid) throw new Error('Sign in to add categories.');
        return repository.addCustomExpenseCategory(uid, name);
      },
      async collectPayment(customerId, amount, method, note) {
        if (!uid) return;
        assertAmount(amount);
        const value = Math.round(amount);
        const due = customerBalance(books, customerId);
        if (value > due) throw new Error(`This customer owes only ${formatRs(due)}.`);
        await repository.addCreditPayment(uid, { customerId, amount: value, method, note: note?.trim() || undefined });
      },
      async addReturn(input) {
        if (!uid) return;
        const refund = Math.round(input.refundAmount);
        assertAmount(refund);
        await repository.addReturn(uid, { ...input, refundAmount: refund, items: input.items });
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
  }, [books, error, loading, user]);

  return <BooksContext.Provider value={value}>{children}</BooksContext.Provider>;
}

export function useBooks() {
  const value = useContext(BooksContext);
  if (!value) throw new Error('useBooks must be used inside BooksProvider');
  return value;
}
