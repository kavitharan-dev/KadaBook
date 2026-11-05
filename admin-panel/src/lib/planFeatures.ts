/**
 * Live APK features only — keep in sync with src/lib/tiers.ts
 */
export type PlanTier = 'basic' | 'pro' | 'premium';

export type PlanFeature =
  | 'quickSale'
  | 'products'
  | 'productSale'
  | 'expenses'
  | 'fullReports'
  | 'creditBook'
  | 'barcode'
  | 'discount'
  | 'paymentModes'
  | 'unlimitedProducts'
  | 'exportData'
  | 'staff'
  | 'kitchenStock'
  | 'branches'
  | 'suppliers';

export const ALL_FEATURES: PlanFeature[] = [
  'quickSale',
  'products',
  'productSale',
  'expenses',
  'fullReports',
  'creditBook',
  'barcode',
  'discount',
  'paymentModes',
  'unlimitedProducts',
  'exportData',
  'staff',
  'kitchenStock',
  'branches',
  'suppliers',
];

export const BASIC_FEATURES: PlanFeature[] = ['quickSale'];

export const STANDARD_FEATURES: PlanFeature[] = [
  'quickSale',
  'products',
  'productSale',
  'expenses',
  'fullReports',
];

export const TIER_FEATURES: Record<PlanTier, PlanFeature[]> = {
  basic: BASIC_FEATURES,
  pro: STANDARD_FEATURES,
  premium: ALL_FEATURES,
};

export const TIER_LABEL: Record<PlanTier, string> = {
  basic: 'Basic',
  pro: 'Standard',
  premium: 'Custom (all)',
};

export const DEFAULT_PLAN_PRICE: Record<'basic' | 'pro', number> = {
  basic: 500,
  pro: 1000,
};

export const DEFAULT_FEATURE_PRICE: Record<PlanFeature, number> = {
  quickSale: 0,
  products: 0,
  productSale: 0,
  expenses: 0,
  fullReports: 0,
  creditBook: 200,
  barcode: 150,
  discount: 100,
  paymentModes: 100,
  unlimitedProducts: 200,
  exportData: 200,
  staff: 300,
  kitchenStock: 400,
  branches: 300,
  suppliers: 200,
};

export const FEATURE_TITLE: Record<PlanFeature, string> = {
  quickSale: 'Quick sale',
  products: 'Product add / catalog',
  productSale: 'Product / menu sale',
  expenses: 'Expenses',
  fullReports: 'Reports',
  creditBook: 'Credit book',
  barcode: 'Barcode scan',
  discount: 'Bill discounts',
  paymentModes: 'Cash / Card / Credit pay',
  unlimitedProducts: 'Unlimited products',
  exportData: 'Excel export & import',
  staff: 'Staff roles + audit log',
  kitchenStock: 'Kitchen (buy / send / make)',
  branches: 'Multi-branch (2 included)',
  suppliers: 'Suppliers & payables',
};

export function calcSubscriptionTotal(
  planPrice: number,
  enabled: PlanFeature[],
  prices: Partial<Record<PlanFeature, number>>,
  included: PlanFeature[],
) {
  const includedSet = new Set(included);
  let addons = 0;
  for (const f of enabled) {
    if (includedSet.has(f)) continue;
    addons += Math.max(0, Number(prices[f] ?? DEFAULT_FEATURE_PRICE[f]) || 0);
  }
  return Math.round(Math.max(0, planPrice) + addons);
}

export function isPlanFeature(value: unknown): value is PlanFeature {
  return typeof value === 'string' && (ALL_FEATURES as string[]).includes(value);
}
