export type ShopStatus =
  | 'pending'
  | 'trial'
  | 'active'
  | 'grace'
  | 'expired'
  | 'suspended'
  | 'rejected';

export type AdminRole = 'super_admin' | 'staff';

export type ShopUser = {
  uid: string;
  shopName: string;
  ownerName?: string;
  phone?: string | null;
  email?: string;
  district?: string;
  status: ShopStatus;
  rejectReason?: string;
  createdAt?: number;
  lastActiveAt?: number;
};

export type Subscription = {
  uid: string;
  plan: string;
  startsAt: number;
  expiresAt: number;
  status: 'trial' | 'active' | 'grace' | 'expired';
};

export type Payment = {
  id: string;
  uid: string;
  plan: string;
  amount: number;
  method: 'bank' | 'cash' | 'ezcash';
  reference?: string;
  paidAt: number;
  recordedBy: string;
};

export type Plan = {
  id: string;
  name: string;
  days: number;
  price: number;
};

export type AdminProfile = {
  uid: string;
  name: string;
  email: string;
  role: AdminRole;
  active?: boolean;
};

export type Announcement = {
  id: string;
  title: string;
  message: string;
  titleEn?: string;
  titleTa?: string;
  messageEn?: string;
  messageTa?: string;
  type: 'banner' | 'popup';
  audience: string;
  active: boolean;
  startAt?: number;
  endAt?: number;
  showOnce?: boolean;
  dismissible?: boolean;
  priority?: number;
  viewCount?: number;
  dismissCount?: number;
  createdAt: number;
};

export type TicketMessage = {
  from: 'shop' | 'admin';
  text: string;
  at: number;
  adminId?: string;
};

export type Ticket = {
  id: string;
  uid: string;
  subject: string;
  status: 'open' | 'resolved';
  messages: TicketMessage[];
  updatedAt: number;
};

export type AppConfig = {
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

export type AuditLog = {
  id: string;
  adminId: string;
  action: string;
  targetUid?: string;
  details?: string;
  createdAt: number;
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  maintenance: false,
  minVersion: '1.0.0',
  trialDays: 14,
  graceDays: 7,
  renewWhatsApp: '',
  features: {
    tamil: true,
    sinhala: true,
    reportExport: true,
    signupsOpen: true,
  },
};
