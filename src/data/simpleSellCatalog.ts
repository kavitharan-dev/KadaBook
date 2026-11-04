import type { ProductInput } from './types';

/** Ready-to-sell drinks/snacks for kitchen shops (no recipe / no raw materials). */
export const SIMPLE_SELL_CATALOG: ProductInput[] = [
  { name: 'Water Bottle 500ml', sellingPrice: 50, purchasePrice: 30, stock: 50, unit: 'pcs', category: 'Drinks', sellKind: 'simple' },
  { name: 'Water Bottle 1L', sellingPrice: 80, purchasePrice: 50, stock: 40, unit: 'pcs', category: 'Drinks', sellKind: 'simple' },
  { name: 'Coke 250ml', sellingPrice: 100, purchasePrice: 70, stock: 40, unit: 'pcs', category: 'Drinks', sellKind: 'simple' },
  { name: 'Coke 1.5L', sellingPrice: 350, purchasePrice: 250, stock: 20, unit: 'pcs', category: 'Drinks', sellKind: 'simple' },
  { name: 'Sprite 250ml', sellingPrice: 100, purchasePrice: 70, stock: 40, unit: 'pcs', category: 'Drinks', sellKind: 'simple' },
  { name: 'Fanta 250ml', sellingPrice: 100, purchasePrice: 70, stock: 40, unit: 'pcs', category: 'Drinks', sellKind: 'simple' },
  { name: 'Mineral Water Glass', sellingPrice: 20, purchasePrice: 5, stock: 100, unit: 'pcs', category: 'Drinks', sellKind: 'simple' },
  { name: 'Chips Pack', sellingPrice: 80, purchasePrice: 50, stock: 30, unit: 'pcs', category: 'Snacks', sellKind: 'simple' },
  { name: 'Biscuits Pack', sellingPrice: 60, purchasePrice: 40, stock: 30, unit: 'pcs', category: 'Snacks', sellKind: 'simple' },
  { name: 'Ice Cream Cup', sellingPrice: 150, purchasePrice: 100, stock: 25, unit: 'pcs', category: 'Snacks', sellKind: 'simple' },
];
