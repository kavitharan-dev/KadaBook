import type { ItemKind, MaterialUnit } from '../data/kitchenTypes';
import type { ProductInput } from '../data/types';

/** Kitchen stock items only — owner may add more later. Nothing else is seeded. */
export type MrChefMaterialSeed = {
  name: string;
  kind: ItemKind;
  unit: MaterialUnit;
  /** Ingredient names for finished items (must already exist in the buy list). */
  recipe?: string[];
};

/**
 * Exact raw / buy list for Mr Chef kitchen shops.
 * Cheese balls, chips and popcorn are direct-sale (sold as bought); the rest are recipe raw.
 */
export const MR_CHEF_MATERIALS: MrChefMaterialSeed[] = [
  { name: 'Burger bun', kind: 'raw', unit: 'pcs' },
  { name: 'Submarine bun', kind: 'raw', unit: 'pcs' },
  { name: 'Chicken burger (patty)', kind: 'raw', unit: 'pcs' },
  { name: 'Crispy burger (patty)', kind: 'raw', unit: 'pcs' },
  { name: 'Vegetable burger (patty)', kind: 'raw', unit: 'pcs' },
  { name: 'Hum burger (patty)', kind: 'raw', unit: 'pcs' },
  { name: 'Chilli cheese', kind: 'raw', unit: 'pcs' },
  { name: 'Cheese balls', kind: 'direct', unit: 'pcs' },
  { name: 'Drumstick', kind: 'raw', unit: 'pcs' },
  { name: 'Hotdog', kind: 'raw', unit: 'pcs' },
  { name: 'Chips potato', kind: 'direct', unit: 'g' },
  { name: 'Popcorn chicken', kind: 'direct', unit: 'g' },
];

/**
 * Finished items + recipes (Make 50 = 50 of each ingredient).
 * Names: Drumstick/Hotdog finished use menu names so they don't clash with raw "Drumstick" / "Hotdog".
 */
export const MR_CHEF_RECIPES: MrChefMaterialSeed[] = [
  { name: 'Chicken Burger', kind: 'finished', unit: 'pcs', recipe: ['Burger bun', 'Chicken burger (patty)'] },
  { name: 'Crispy Burger', kind: 'finished', unit: 'pcs', recipe: ['Burger bun', 'Crispy burger (patty)'] },
  { name: 'Veg Burger', kind: 'finished', unit: 'pcs', recipe: ['Burger bun', 'Vegetable burger (patty)'] },
  { name: 'Hum Burger', kind: 'finished', unit: 'pcs', recipe: ['Burger bun', 'Hum burger (patty)'] },
  { name: 'Drumstick Bun', kind: 'finished', unit: 'pcs', recipe: ['Drumstick', 'Submarine bun'] },
  { name: 'Hot Dog Bun', kind: 'finished', unit: 'pcs', recipe: ['Hotdog', 'Submarine bun'] },
];

/** Sell products for kitchen shops only (MR. CHEF menu + drinks). */
export const MR_CHEF_PRODUCTS: ProductInput[] = [
  // Burgers
  { name: 'Chicken Burger', sellingPrice: 400, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Burger', sellKind: 'menu' },
  { name: 'Hum Burger', sellingPrice: 450, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Burger', sellKind: 'menu' },
  { name: 'Chilli Cheese Burger', sellingPrice: 550, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Burger', sellKind: 'menu' },
  { name: 'Special Burger', sellingPrice: 580, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Burger', sellKind: 'menu' },
  { name: 'Crispy Chicken Burger', sellingPrice: 680, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Burger', sellKind: 'menu' },
  { name: 'Double Decker Burger', sellingPrice: 700, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Burger', sellKind: 'menu' },
  { name: 'Vegetable Burger', sellingPrice: 450, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Burger', sellKind: 'menu' },
  { name: 'Beef Burger', sellingPrice: 620, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Burger', sellKind: 'menu' },
  // Submarine
  { name: 'Chicken Submarine', sellingPrice: 350, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Submarine', sellKind: 'menu' },
  { name: 'Tandoori Submarine', sellingPrice: 380, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Submarine', sellKind: 'menu' },
  { name: 'Crispy Chicken Submarine', sellingPrice: 380, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Submarine', sellKind: 'menu' },
  { name: 'Devilled Chicken Submarine', sellingPrice: 380, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Submarine', sellKind: 'menu' },
  { name: 'Devilled Beef Submarine', sellingPrice: 420, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Submarine', sellKind: 'menu' },
  { name: 'Mini Kievs Bun', sellingPrice: 350, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Submarine', sellKind: 'menu' },
  { name: 'Hot Dog Bun', sellingPrice: 350, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Submarine', sellKind: 'menu' },
  { name: 'Drumstick Bun', sellingPrice: 300, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Submarine', sellKind: 'menu' },
  // Sides
  { name: 'French Fries - Small', sellingPrice: 450, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Sides', sellKind: 'menu' },
  { name: 'French Fries - Large', sellingPrice: 900, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Sides', sellKind: 'menu' },
  { name: 'Cheese Balls', sellingPrice: 400, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Sides', sellKind: 'menu' },
  { name: 'Popcorn Chicken', sellingPrice: 400, purchasePrice: 0, stock: 0, unit: 'g', category: 'Sides', sellKind: 'menu' },
  { name: 'Nuggets', sellingPrice: 400, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Sides', sellKind: 'menu' },
  { name: 'Spring Potato', sellingPrice: 250, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Sides', sellKind: 'menu' },
  // Fresh Juice
  { name: 'Lime Juice', sellingPrice: 250, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Fresh Juice', sellKind: 'menu' },
  { name: 'Mango Juice', sellingPrice: 300, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Fresh Juice', sellKind: 'menu' },
  { name: 'Watermelon Juice', sellingPrice: 250, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Fresh Juice', sellKind: 'menu' },
  { name: 'Avocado Juice', sellingPrice: 300, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Fresh Juice', sellKind: 'menu' },
  // Lassi
  { name: 'Sweet Lassi', sellingPrice: 300, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Lassi', sellKind: 'menu' },
  { name: 'Mango Lassi', sellingPrice: 450, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Lassi', sellKind: 'menu' },
  { name: 'Strawberry Lassi', sellingPrice: 400, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Lassi', sellKind: 'menu' },
  { name: 'Chocolate Lassi', sellingPrice: 400, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Lassi', sellKind: 'menu' },
  // Milk Shake
  { name: 'Badam Shake', sellingPrice: 300, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Milk Shake', sellKind: 'menu' },
  { name: 'Chocolate Shake', sellingPrice: 400, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Milk Shake', sellKind: 'menu' },
  { name: 'Faluda Shake', sellingPrice: 300, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Milk Shake', sellKind: 'menu' },
  { name: 'Vanilla Shake', sellingPrice: 300, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Milk Shake', sellKind: 'menu' },
  { name: 'Strawberry Shake', sellingPrice: 350, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Milk Shake', sellKind: 'menu' },
  { name: 'Mango Shake', sellingPrice: 350, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Milk Shake', sellKind: 'menu' },
  { name: 'Avocado Shake', sellingPrice: 350, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Milk Shake', sellKind: 'menu' },
  { name: 'Milo Shake', sellingPrice: 350, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Milk Shake', sellKind: 'menu' },
  { name: 'Iced Coffee', sellingPrice: 300, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Milk Shake', sellKind: 'menu' },
  // Popping Bubble
  { name: 'Strawberry Bubble', sellingPrice: 600, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Popping Bubble', sellKind: 'menu' },
  { name: 'Chocolate Bubble', sellingPrice: 650, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Popping Bubble', sellKind: 'menu' },
  { name: 'Mango Bubble', sellingPrice: 550, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Popping Bubble', sellKind: 'menu' },
  { name: 'Coffee Bubble', sellingPrice: 550, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Popping Bubble', sellKind: 'menu' },
  { name: 'Passion Fruit Bubble', sellingPrice: 550, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Popping Bubble', sellKind: 'menu' },
  // Mojito
  { name: 'Double Flavour Mojito', sellingPrice: 300, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Mojito', sellKind: 'menu' },
  { name: 'Apple Mojito', sellingPrice: 450, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Mojito', sellKind: 'menu' },
  { name: 'Orange Mojito', sellingPrice: 450, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Mojito', sellKind: 'menu' },
  { name: 'Mango Mojito', sellingPrice: 450, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Mojito', sellKind: 'menu' },
  { name: 'Grape Mojito', sellingPrice: 450, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Mojito', sellKind: 'menu' },
  { name: 'Passion Fruit Mojito', sellingPrice: 400, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Mojito', sellKind: 'menu' },
  // Hot Drinks
  { name: 'Tea', sellingPrice: 120, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Hot Drinks', sellKind: 'menu' },
  { name: 'Coffee', sellingPrice: 120, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Hot Drinks', sellKind: 'menu' },
  { name: 'Milo', sellingPrice: 150, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Hot Drinks', sellKind: 'menu' },
  { name: 'Hot Chocolate', sellingPrice: 150, purchasePrice: 0, stock: 0, unit: 'pcs', category: 'Hot Drinks', sellKind: 'menu' },
];

/** Product display name → kitchen stock item (finished or direct). */
export const MR_CHEF_PRODUCT_STOCK_LINKS: Record<string, string> = {
  'Chicken Burger': 'Chicken Burger',
  'Crispy Chicken Burger': 'Crispy Burger',
  'Vegetable Burger': 'Veg Burger',
  'Hum Burger': 'Hum Burger',
  'Drumstick Bun': 'Drumstick Bun',
  'Hot Dog Bun': 'Hot Dog Bun',
  'Cheese Balls': 'Cheese balls',
  'Popcorn Chicken': 'Popcorn chicken',
};
