import type { MaterialUnit } from './kitchenTypes';

export type CatalogItem = {
  name: string;
  unit: MaterialUnit;
  category: string;
};

/** Standard burger / fast-food kitchen raw materials. */
export const RAW_MATERIAL_CATALOG: CatalogItem[] = [
  // 1. Meat & Protein
  { name: 'Boneless Chicken', unit: 'kg', category: 'Meat & Protein' },
  { name: 'Chicken Breast', unit: 'kg', category: 'Meat & Protein' },
  { name: 'Chicken Mince', unit: 'kg', category: 'Meat & Protein' },
  { name: 'Chicken Sausage', unit: 'pcs', category: 'Meat & Protein' },
  { name: 'Beef / Ham', unit: 'kg', category: 'Meat & Protein' },
  { name: 'Eggs', unit: 'pcs', category: 'Meat & Protein' },
  { name: 'Paneer', unit: 'kg', category: 'Meat & Protein' },

  // 2. Bakery & Bread
  { name: 'Burger Bun', unit: 'pcs', category: 'Bakery & Bread' },
  { name: 'Submarine Bun', unit: 'pcs', category: 'Bakery & Bread' },
  { name: 'Hot Dog Bun', unit: 'pcs', category: 'Bakery & Bread' },
  { name: 'Sandwich Bread', unit: 'slices', category: 'Bakery & Bread' },
  { name: 'Shawarma Bread / Pita', unit: 'pcs', category: 'Bakery & Bread' },
  { name: 'Mini Bun', unit: 'pcs', category: 'Bakery & Bread' },
  { name: 'Breadcrumbs', unit: 'kg', category: 'Bakery & Bread' },
  { name: 'All-purpose Flour (Maida)', unit: 'kg', category: 'Bakery & Bread' },
  { name: 'Corn Flour', unit: 'kg', category: 'Bakery & Bread' },

  // 3. Vegetables & Fresh Produce
  { name: 'Potato', unit: 'kg', category: 'Vegetables' },
  { name: 'Tomato', unit: 'kg', category: 'Vegetables' },
  { name: 'Onion', unit: 'kg', category: 'Vegetables' },
  { name: 'Lettuce', unit: 'kg', category: 'Vegetables' },
  { name: 'Cabbage', unit: 'kg', category: 'Vegetables' },
  { name: 'Cucumber', unit: 'kg', category: 'Vegetables' },
  { name: 'Carrot', unit: 'kg', category: 'Vegetables' },
  { name: 'Capsicum', unit: 'kg', category: 'Vegetables' },
  { name: 'Green Chilli', unit: 'kg', category: 'Vegetables' },
  { name: 'Mushroom', unit: 'kg', category: 'Vegetables' },
  { name: 'Garlic', unit: 'kg', category: 'Vegetables' },
  { name: 'Coriander Leaves', unit: 'kg', category: 'Vegetables' },
  { name: 'Lemon', unit: 'pcs', category: 'Vegetables' },

  // 4. Dairy & Cheese
  { name: 'Cheddar Cheese', unit: 'kg', category: 'Dairy & Cheese' },
  { name: 'Mozzarella Cheese', unit: 'kg', category: 'Dairy & Cheese' },
  { name: 'Cheese Slices', unit: 'pcs', category: 'Dairy & Cheese' },
  { name: 'Cheese Spread', unit: 'kg', category: 'Dairy & Cheese' },
  { name: 'Butter', unit: 'kg', category: 'Dairy & Cheese' },
  { name: 'Fresh Milk', unit: 'l', category: 'Dairy & Cheese' },
  { name: 'Mayonnaise', unit: 'kg', category: 'Dairy & Cheese' },

  // 5. Sauces & Condiments
  { name: 'Tomato Ketchup', unit: 'kg', category: 'Sauces' },
  { name: 'Chilli Sauce', unit: 'kg', category: 'Sauces' },
  { name: 'BBQ Sauce', unit: 'kg', category: 'Sauces' },
  { name: 'Garlic Sauce', unit: 'kg', category: 'Sauces' },
  { name: 'Mustard Sauce', unit: 'kg', category: 'Sauces' },
  { name: 'Hot Sauce', unit: 'kg', category: 'Sauces' },
  { name: 'Peri-peri Sauce', unit: 'kg', category: 'Sauces' },
  { name: 'Burger Sauce', unit: 'kg', category: 'Sauces' },
  { name: 'Shawarma Sauce', unit: 'kg', category: 'Sauces' },
  { name: 'Soy Sauce', unit: 'l', category: 'Sauces' },
  { name: 'Vinegar', unit: 'l', category: 'Sauces' },

  // 6. Spices & Seasonings
  { name: 'Salt', unit: 'kg', category: 'Spices' },
  { name: 'Black Pepper Powder', unit: 'kg', category: 'Spices' },
  { name: 'Chilli Powder', unit: 'kg', category: 'Spices' },
  { name: 'Turmeric Powder', unit: 'kg', category: 'Spices' },
  { name: 'Garlic Powder', unit: 'kg', category: 'Spices' },
  { name: 'Onion Powder', unit: 'kg', category: 'Spices' },
  { name: 'Chicken Seasoning', unit: 'kg', category: 'Spices' },
  { name: 'Paprika', unit: 'kg', category: 'Spices' },
  { name: 'Cumin Powder', unit: 'kg', category: 'Spices' },
  { name: 'Coriander Powder', unit: 'kg', category: 'Spices' },
  { name: 'Shawarma Seasoning', unit: 'kg', category: 'Spices' },
  { name: 'Oregano', unit: 'kg', category: 'Spices' },

  // 7. Frozen & Ready-made
  { name: 'Frozen French Fries', unit: 'kg', category: 'Frozen' },
  { name: 'Cheese Balls', unit: 'pcs', category: 'Frozen' },
  { name: 'Spring Potato', unit: 'pcs', category: 'Frozen' },
  { name: 'Frozen Chicken Popcorn', unit: 'kg', category: 'Frozen' },
  { name: 'Chicken Patty', unit: 'pcs', category: 'Frozen' },
  { name: 'Frozen Chicken Nuggets', unit: 'kg', category: 'Frozen' },
  { name: 'Sausages', unit: 'pcs', category: 'Frozen' },

  // 8. Cooking & Preparation
  { name: 'Cooking Oil', unit: 'l', category: 'Cooking' },
  { name: 'Vegetable Oil', unit: 'l', category: 'Cooking' },
  { name: 'Baking Powder', unit: 'kg', category: 'Cooking' },
  { name: 'Yeast', unit: 'kg', category: 'Cooking' },
  { name: 'Sugar', unit: 'kg', category: 'Cooking' },
  { name: 'Cornflakes / Coating Mix', unit: 'kg', category: 'Cooking' },

  // 9. Packaging & Consumables
  { name: 'Burger Box', unit: 'pcs', category: 'Packaging' },
  { name: 'Burger Wrapping Paper', unit: 'pcs', category: 'Packaging' },
  { name: 'Submarine Box', unit: 'pcs', category: 'Packaging' },
  { name: 'French Fries Box', unit: 'pcs', category: 'Packaging' },
  { name: 'Food Container', unit: 'pcs', category: 'Packaging' },
  { name: 'Paper Bag', unit: 'pcs', category: 'Packaging' },
  { name: 'Tissue Paper', unit: 'pcs', category: 'Packaging' },
  { name: 'Disposable Gloves', unit: 'pair', category: 'Packaging' },
  { name: 'Sauce Cups', unit: 'pcs', category: 'Packaging' },
  { name: 'Aluminium Foil', unit: 'roll', category: 'Packaging' },
];

export const CATALOG_CATEGORIES = Array.from(new Set(RAW_MATERIAL_CATALOG.map((i) => i.category)));
