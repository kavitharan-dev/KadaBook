import type { Product } from '../data/types';
import type { Recipe } from '../data/kitchenTypes';

export type SellKind = 'simple' | 'menu';

export function normalizeSellKind(value: unknown): SellKind {
  return value === 'menu' ? 'menu' : 'simple';
}

/** Menu = food with kitchen recipe path; Simple = bottle/coke style sell-only. */
export function effectiveSellKind(
  product: Pick<Product, 'id' | 'sellKind' | 'category'>,
  recipes: Array<Pick<Recipe, 'productId'>>,
): SellKind {
  if (product.sellKind === 'menu') return 'menu';
  // Category "Food" wins over a mistaken simple flag (kitchen Add food default).
  if ((product.category ?? '').trim().toLowerCase() === 'food') return 'menu';
  if (product.sellKind === 'simple') return 'simple';
  return recipes.some((r) => r.productId === product.id) ? 'menu' : 'simple';
}

export function hasRecipe(productId: string, recipes: Array<Pick<Recipe, 'productId'>>): boolean {
  return recipes.some((r) => r.productId === productId);
}

export function sellKindLabel(kind: SellKind) {
  return kind === 'menu' ? 'Menu / Food' : 'Simple sell';
}
