/**
 * Plans: Basic (Rs 500) and Standard (Rs 1,000).
 * Catalog = features that actually exist in the APK (no vapourware).
 * Existing shops without featuresConfigured stay fully unlocked (grandfather).
 */
export type Tier = 'basic' | 'pro' | 'premium';

/** Only features wired in the live app. */
export type TierFeature =
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

export const BASIC_PRODUCT_LIMIT = 100;
export const FREE_PRODUCT_LIMIT = BASIC_PRODUCT_LIMIT;

/** Admin + Upgrade Plan list order. */
export const ALL_FEATURES: TierFeature[] = [
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

export const BASIC_FEATURES: TierFeature[] = ['quickSale'];

export const STANDARD_FEATURES: TierFeature[] = [
  'quickSale',
  'products',
  'productSale',
  'expenses',
  'fullReports',
];

export const TIER_FEATURES: Record<Tier, TierFeature[]> = {
  basic: BASIC_FEATURES,
  pro: STANDARD_FEATURES,
  premium: ALL_FEATURES,
};

export const TIER_ORDER: Tier[] = ['basic', 'pro', 'premium'];

export const TIER_LABEL: Record<Tier, string> = {
  basic: 'Basic',
  pro: 'Standard',
  premium: 'Custom',
};

export const TIER_PRICE_HINT: Record<Tier, string> = {
  basic: 'Rs 500 / month',
  pro: 'Rs 1,000 / month',
  premium: 'Custom',
};

export const DEFAULT_PLAN_PRICE: Record<'basic' | 'pro', number> = {
  basic: 500,
  pro: 1000,
};

export const DEFAULT_FEATURE_PRICE: Record<TierFeature, number> = {
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

export function minTierFor(feature: TierFeature): Tier {
  if (BASIC_FEATURES.includes(feature)) return 'basic';
  if (STANDARD_FEATURES.includes(feature)) return 'pro';
  return 'premium';
}

export function tierHas(tier: Tier, feature: TierFeature) {
  return TIER_FEATURES[tier].includes(feature);
}

export function isPlanIncluded(tier: Tier, feature: TierFeature) {
  return tier === 'premium' ? true : tierHas(tier, feature);
}

export function tierFromPlan(plan: string): Tier {
  const name = plan.toLowerCase();
  if (/premium|business|custom|full/.test(name)) return 'premium';
  if (/\bpro\b|standard|1000/.test(name)) return 'pro';
  if (/month|quarter/.test(name) && !/basic/.test(name)) return 'pro';
  return 'basic';
}

export function isTier(value: unknown): value is Tier {
  return value === 'basic' || value === 'pro' || value === 'premium';
}

export function isTierFeature(value: unknown): value is TierFeature {
  return typeof value === 'string' && (ALL_FEATURES as string[]).includes(value);
}

export const FEATURE_TITLE: Record<TierFeature, string> = {
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

export const FEATURE_STATUS: Record<TierFeature, 'live' | 'soon'> = {
  quickSale: 'live',
  products: 'live',
  productSale: 'live',
  expenses: 'live',
  fullReports: 'live',
  creditBook: 'live',
  barcode: 'live',
  discount: 'live',
  paymentModes: 'live',
  unlimitedProducts: 'live',
  exportData: 'live',
  staff: 'live',
  kitchenStock: 'live',
  branches: 'live',
  suppliers: 'live',
};

export const SHOW_PREMIUM_TIER = true;

export function calcSubscriptionTotal(
  planPrice: number,
  enabled: TierFeature[],
  prices: Partial<Record<TierFeature, number>>,
  included: TierFeature[],
) {
  const includedSet = new Set(included);
  let addons = 0;
  for (const f of enabled) {
    if (includedSet.has(f)) continue;
    addons += Math.max(0, Number(prices[f] ?? DEFAULT_FEATURE_PRICE[f]) || 0);
  }
  return Math.round(Math.max(0, planPrice) + addons);
}
