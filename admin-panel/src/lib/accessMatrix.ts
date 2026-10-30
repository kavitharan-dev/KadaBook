export type ShopStatus =
  | 'pending'
  | 'trial'
  | 'active'
  | 'grace'
  | 'expired'
  | 'suspended'
  | 'rejected';

export type AccessFeature =
  | 'useApp'
  | 'viewReports'
  | 'addSale'
  | 'addExpense'
  | 'manageProducts'
  | 'exportData'
  | 'editProfile';

export type AccessMatrix = Record<ShopStatus, Record<AccessFeature, boolean>>;

export const ACCESS_FEATURES: AccessFeature[] = [
  'useApp',
  'viewReports',
  'addSale',
  'addExpense',
  'manageProducts',
  'exportData',
  'editProfile',
];

export const ACCESS_STATUSES: ShopStatus[] = [
  'pending',
  'trial',
  'active',
  'grace',
  'expired',
  'suspended',
];

export const DEFAULT_ACCESS_MATRIX: AccessMatrix = {
  pending: {
    useApp: true,
    viewReports: false,
    addSale: false,
    addExpense: false,
    manageProducts: false,
    exportData: false,
    editProfile: true,
  },
  trial: {
    useApp: true,
    viewReports: true,
    addSale: true,
    addExpense: true,
    manageProducts: true,
    exportData: true,
    editProfile: true,
  },
  active: {
    useApp: true,
    viewReports: true,
    addSale: true,
    addExpense: true,
    manageProducts: true,
    exportData: true,
    editProfile: true,
  },
  grace: {
    useApp: true,
    viewReports: true,
    addSale: true,
    addExpense: true,
    manageProducts: true,
    exportData: true,
    editProfile: true,
  },
  expired: {
    useApp: true,
    viewReports: true,
    addSale: false,
    addExpense: false,
    manageProducts: false,
    exportData: true,
    editProfile: true,
  },
  suspended: {
    useApp: false,
    viewReports: false,
    addSale: false,
    addExpense: false,
    manageProducts: false,
    exportData: false,
    editProfile: false,
  },
  rejected: {
    useApp: false,
    viewReports: false,
    addSale: false,
    addExpense: false,
    manageProducts: false,
    exportData: false,
    editProfile: false,
  },
};

export function mergeAccessMatrix(raw: Partial<AccessMatrix> | undefined): AccessMatrix {
  const base = DEFAULT_ACCESS_MATRIX;
  if (!raw) return base;
  const out = { ...base };
  (Object.keys(base) as ShopStatus[]).forEach((status) => {
    out[status] = { ...base[status], ...(raw[status] ?? {}) };
  });
  return out;
}
