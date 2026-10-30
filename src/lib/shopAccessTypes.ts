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
  status: ShopStatus;
  rejectReason?: string;
  overrides?: Partial<Record<AccessFeature, boolean>>;
  overrideReason?: string;
};

export type SubscriptionDoc = {
  plan: string;
  startsAt: number;
  expiresAt: number;
  status: 'trial' | 'active' | 'grace' | 'expired';
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
