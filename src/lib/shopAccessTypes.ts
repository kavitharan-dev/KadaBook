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

export type ShopProfile = {
  shopName: string;
  ownerName?: string;
  phone?: string | null;
  email?: string;
  district?: string;
  /** retail = hide Kitchen & Stock; kitchen = show it. */
  shopType?: 'retail' | 'kitchen';
  status: ShopStatus;
  rejectReason?: string;
  overrides?: Partial<Record<AccessFeature, boolean>>;
  overrideReason?: string;
  /** Admin grant. Wins over the plan tier. */
  tierOverride?: 'basic' | 'pro' | 'premium';
};

export type SubscriptionDoc = {
  plan: string;
  planId?: string;
  planName?: string;
  tier?: 'basic' | 'pro' | 'premium';
  startsAt: number;
  expiresAt: number;
  status: 'trial' | 'active' | 'grace' | 'expired';
  /**
   * When false/missing → all features unlocked (grandfather / not customized yet).
   * When true → only `enabledFeatures` are unlocked.
   */
  featuresConfigured?: boolean;
  /** Active features after admin tick/untick. */
  enabledFeatures?: string[];
  /** Base plan amount (customizable). */
  planPrice?: number;
  /** Per-feature amounts used for this shop (optional overrides). */
  featureAmounts?: Record<string, number>;
  /** planPrice + add-on feature amounts. */
  monthlyTotal?: number;
  /** Optional seat overrides after featuresConfigured (default 2 / 2). */
  staffSeats?: number;
  branchLimit?: number;
};

export type AppConfigMain = {
  maintenance: boolean;
  minVersion: string;
  trialDays: number;
  graceDays: number;
  renewWhatsApp: string;
  features: {
    tamil: boolean;
    sinhala: boolean;
    reportExport: boolean;
    signupsOpen: boolean;
  };
};

export type AnnouncementDoc = {
  id: string;
  titleEn: string;
  titleTa: string;
  messageEn: string;
  messageTa: string;
  type: 'banner' | 'popup';
  audience: 'all' | 'trial' | 'active' | 'expiring' | 'expired' | 'grace' | 'pending';
  active: boolean;
  startAt: number;
  endAt?: number;
  showOnce: boolean;
  dismissible: boolean;
  priority: number;
  viewCount?: number;
  dismissCount?: number;
};
