import { EXPENSE_CATEGORIES, type BooksMeta } from '../data/types';

const BUILTIN = new Set<string>(EXPENSE_CATEGORIES);

export function expenseCategoriesForShop(meta: BooksMeta): string[] {
  const custom = meta.customExpenseCategories ?? [];
  const seen = new Set<string>(EXPENSE_CATEGORIES);
  const extra = custom.filter((name) => {
    const trimmed = name.trim();
    if (!trimmed || seen.has(trimmed)) return false;
    seen.add(trimmed);
    return true;
  });
  return [...EXPENSE_CATEGORIES, ...extra];
}

export function normalizeCustomExpenseCategory(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, 40);
}

export function isBuiltinExpenseCategory(category: string): boolean {
  return BUILTIN.has(category);
}
