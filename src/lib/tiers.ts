/**
 * Plan tiers for KadaBook.
 * Basic Rs 500 / month. Pro Rs 1,000. Premium Rs 1,500.
 * Old Monthly (Rs 600) and Quarterly (Rs 1,600) shops are grandfathered into Pro.
 * Trial shops get Premium so they can try everything. Expired shops stay read-only through the status matrix.
 */
export type Tier = 'basic' | 'pro' | 'premium';

export type TierFeature =
  | 'creditBook'
  | 'barcode'
  | 'discount'
  | 'paymentModes'
  | 'billReturn'
  | 'lowStockAlerts'
  | 'reorderList'
  | 'unlimitedProducts'
  | 'bulkImport'
  | 'fullReports'
  | 'exportData'
  | 'digitalReceipt'
  | 'saleNotes'
  | 'staff'
  | 'kitchenStock'
  | 'branches'
  | 'suppliers'
  | 'vatInvoice'
  | 'batchExpiry'
  | 'cloudBackup'
  | 'aiAssistant'
  | 'voiceBilling'
  | 'loyalty'
  | 'customBranding'
  | 'prioritySupport';

export const BASIC_PRODUCT_LIMIT = 100;
export const FREE_PRODUCT_LIMIT = BASIC_PRODUCT_LIMIT;


/** Every plan feature is open. Plans stay for billing only. */
const ALL_FEATURES: TierFeature[] = [
  'creditBook',
  'barcode',
  'discount',
  'paymentModes',
  'billReturn',
  'lowStockAlerts',
  'reorderList',
  'unlimitedProducts',
  'bulkImport',
  'fullReports',
  'exportData',
  'digitalReceipt',
  'saleNotes',
  'staff',
  'kitchenStock',
  'branches',
  'suppliers',
  'vatInvoice',
  'batchExpiry',
  'cloudBackup',
  'aiAssistant',
  'voiceBilling',
  'loyalty',
  'customBranding',
  'prioritySupport',
];

export const TIER_FEATURES: Record<Tier, TierFeature[]> = {
  basic: ALL_FEATURES,
  pro: ALL_FEATURES,
  premium: ALL_FEATURES,
};

export const TIER_ORDER: Tier[] = ['basic', 'pro', 'premium'];

export const TIER_LABEL: Record<Tier, string> = {
  basic: 'Basic',
  pro: 'Pro',
  premium: 'Premium',
};

export const TIER_PRICE_HINT: Record<Tier, string> = {
  basic: 'Rs 500 / month',
  pro: 'Rs 1,000 / month',
  premium: 'Rs 1,500 / month',
};

export function minTierFor(feature: TierFeature): Tier {
  return TIER_ORDER.find((tier) => TIER_FEATURES[tier].includes(feature)) ?? 'premium';
}

export function tierHas(tier: Tier, feature: TierFeature) {
  return TIER_FEATURES[tier].includes(feature);
}

/** Guess a tier when the plan document has no `tier` field. The old Monthly / Quarterly plans are Pro (grandfathered). */
export function tierFromPlan(plan: string): Tier {
  const name = plan.toLowerCase();
  if (/premium|business/.test(name)) return 'premium';
  if (/\bpro\b/.test(name)) return 'pro';
  if (/month|quarter/.test(name) && !/basic/.test(name)) return 'pro';
  return 'basic';
}

export function isTier(value: unknown): value is Tier {
  return value === 'basic' || value === 'pro' || value === 'premium';
}

export const FEATURE_TITLE: Record<TierFeature, string> = {
  creditBook: 'Customer credit book (udhaar)',
  barcode: 'Barcode scan',
  discount: 'Bill discounts',
  paymentModes: 'Cash / Card / Credit',
  billReturn: 'Bill return and edit',
  lowStockAlerts: 'Low stock alerts',
  reorderList: 'Reorder list',
  unlimitedProducts: 'Unlimited products',
  bulkImport: 'Bulk import (Excel / CSV)',
  fullReports: 'Full reports',
  exportData: 'Export PDF / Excel / WhatsApp',
  digitalReceipt: 'Digital receipt share',
  saleNotes: 'Notes and date change',
  staff: 'Staff logins, roles and audit log',
  kitchenStock: 'Kitchen: raw materials, recipe cost, variance',
  branches: 'Multi-branch sales and stock transfer',
  suppliers: 'Suppliers and payables',
  vatInvoice: 'VAT / A4 tax invoice',
  batchExpiry: 'Batch and expiry',
  cloudBackup: 'Cloud backup and restore',
  aiAssistant: 'AI shop assistant',
  voiceBilling: 'Tamil voice billing',
  loyalty: 'Loyalty points',
  customBranding: 'Custom receipt branding',
  prioritySupport: 'Priority support',
};

export const FEATURE_STATUS: Record<TierFeature, 'live' | 'soon'> = {
  creditBook: 'live',
  barcode: 'live',
  discount: 'live',
  paymentModes: 'live',
  billReturn: 'soon',
  lowStockAlerts: 'live',
  reorderList: 'live',
  unlimitedProducts: 'live',
  bulkImport: 'live',
  fullReports: 'live',
  exportData: 'live',
  digitalReceipt: 'soon',
  saleNotes: 'live',
  staff: 'live',
  kitchenStock: 'live',
  branches: 'live',
  suppliers: 'live',
  vatInvoice: 'soon',
  batchExpiry: 'live',
  cloudBackup: 'live',
  aiAssistant: 'soon',
  voiceBilling: 'soon',
  loyalty: 'soon',
  customBranding: 'soon',
  prioritySupport: 'live',
};

/** Premium is listed once several Premium tools are in the app. */
export const SHOW_PREMIUM_TIER = true;
