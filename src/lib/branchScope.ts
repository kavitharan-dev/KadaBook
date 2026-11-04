import type { Branch, BranchScope } from '../data/kitchenTypes';
import type { Books, Sale } from '../data/types';
import { saleBranch } from './kitchenOps';

function mainBranchId(branches: Branch[]) {
  return branches.find((b) => b.isMain)?.id ?? branches[0]?.id ?? '';
}

/** Day → opening cash for one branch: its own rows on top of the shop-wide history (main branch only). */
function branchOpenings(books: Books, branch: Branch, mainId: string) {
  const out: Record<string, number> = branch.id === mainId ? { ...(books.meta.openingBalances ?? {}) } : {};
  for (const row of Object.values(books.meta.branchDays ?? {})) {
    if (row.branchId === branch.id && typeof row.opening === 'number') out[row.day] = row.opening;
  }
  return out;
}

/**
 * The books as one branch (or all of them added up) sees them. Reports read `meta.openingBalances`,
 * so it is rewritten here and they need no branch logic of their own.
 */
export function scopeBooks(books: Books, scope: BranchScope, branches: Branch[]): Books {
  if (!branches.length) return books;
  const mainId = mainBranchId(branches);
  const inScope = (branchId: string | undefined) => scope === 'all' || (branchId ?? mainId) === scope;
  const openingBalances: Record<string, number> = {};
  for (const branch of branches) {
    if (scope !== 'all' && branch.id !== scope) continue;
    for (const [day, amount] of Object.entries(branchOpenings(books, branch, mainId))) {
      openingBalances[day] = (openingBalances[day] ?? 0) + amount;
    }
  }
  return {
    ...books,
    sales: books.sales.filter((sale) => inScope(saleBranch(sale, branches))),
    expenses: books.expenses.filter((expense) => inScope(expense.branchId)),
    creditPayments: books.creditPayments.filter((row) => inScope(row.branchId)),
    meta: { ...books.meta, openingBalances },
  };
}

export type CashierSales = { key: string; name: string; total: number; count: number };
export type BranchSales = { branchId: string; name: string; total: number; cashiers: CashierSales[] };

/** Key for sales made before the cashier was saved on each sale. */
export const UNKNOWN_CASHIER = 'unknown';

/** Who sold how much, per branch. A shop with no branches comes back as one unnamed row. */
export function salesByBranchAndCashier(sales: Sale[], branches: Branch[]): BranchSales[] {
  const rows = new Map<string, BranchSales>(
    branches.map((b) => [b.id, { branchId: b.id, name: b.name, total: 0, cashiers: [] }]),
  );
  for (const sale of sales) {
    const branchId = saleBranch(sale, branches);
    const row = rows.get(branchId) ?? { branchId, name: '', total: 0, cashiers: [] };
    rows.set(branchId, row);
    const key = sale.soldByUid ?? UNKNOWN_CASHIER;
    let cashier = row.cashiers.find((c) => c.key === key);
    if (!cashier) {
      cashier = { key, name: sale.soldByName ?? '', total: 0, count: 0 };
      row.cashiers.push(cashier);
    }
    cashier.total += sale.amount;
    cashier.count += 1;
    row.total += sale.amount;
  }
  const list = [...rows.values()];
  for (const row of list) row.cashiers.sort((a, b) => b.total - a.total);
  return list;
}
