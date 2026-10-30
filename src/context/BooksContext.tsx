import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { repository, usingCloud } from '../data/services';
import { waitForFirebaseAuth } from '../firebase/client';
import { EMPTY_BOOKS, type BillCheckoutInput, type Books, type ProductInput, type SaleLine } from '../data/types';
import { assertBillItems, billTotal } from '../lib/saleOps';
import { dayKey } from '../lib/dayKey';

type BooksContextValue = {
  books: Books;
  loading: boolean;
  error: string | null;
  addQuickSale: (amount: number, items?: SaleLine[]) => Promise<void>;
  checkoutBill: (items: SaleLine[]) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  addExpense: (amount: number, category: string) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  addProduct: (input: ProductInput) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  saveOrder: (items: SaleLine[]) => Promise<void>;
  deleteSavedOrder: (id: string) => Promise<void>;
  setTodayOpeningBalance: (amount: number) => Promise<void>;
  addCustomExpenseCategory: (name: string) => Promise<string>;
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
    return {
      books,
      loading,
      error,
      async addQuickSale(amount, items) {
        if (!uid) return;
        const lines = items?.filter((line) => line.name.trim() && line.unitPrice > 0) ?? [];
        const total = lines.length ? billTotal(lines) : Math.round(amount);
        assertAmount(total);
        if (lines.length) {
          assertBillItems(lines);
        }
        await repository.addQuickSale(uid, {
          amount: total,
          items: lines.length ? lines : undefined,
        });
      },
      async checkoutBill(items) {
        if (!uid) return;
        const payload: BillCheckoutInput = { items };
        await repository.checkoutBill(uid, payload);
      },
      async deleteSale(id) {
        if (!uid) return;
        await repository.deleteSale(uid, id);
      },
      async addExpense(amount, category) {
        if (!uid) return;
        assertAmount(amount);
        await repository.addExpense(uid, Math.round(amount), category);
      },
      async deleteExpense(id) {
        if (!uid) return;
        await repository.deleteExpense(uid, id);
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
        await repository.deleteProduct(uid, id);
      },
      async saveOrder(items) {
        if (!uid) return;
        await repository.saveOrder(uid, items);
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
    };
  }, [books, error, loading, user]);

  return <BooksContext.Provider value={value}>{children}</BooksContext.Provider>;
}

export function useBooks() {
  const value = useContext(BooksContext);
  if (!value) throw new Error('useBooks must be used inside BooksProvider');
  return value;
}
