import type { Timestamp } from 'firebase/firestore';
import type { Payment, ShopUser, Subscription, Ticket, Announcement, AuditLog, Plan, AdminProfile } from '../types/models';

export function ts(v: unknown): number {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && 'toMillis' in v) return (v as Timestamp).toMillis();
  return 0;
}

export function mapShop(id: string, d: Record<string, unknown>): ShopUser {
  return {
    uid: id,
    shopName: String(d.shopName ?? 'Shop'),
    ownerName: d.ownerName ? String(d.ownerName) : undefined,
    phone: d.phone ? String(d.phone) : null,
    email: d.email ? String(d.email) : undefined,
    district: d.district ? String(d.district) : undefined,
    status: (d.status as ShopUser['status']) ?? 'pending',
    rejectReason: d.rejectReason ? String(d.rejectReason) : undefined,
    createdAt: ts(d.createdAt),
    lastActiveAt: ts(d.lastActiveAt),
  };
}

export function mapPayment(id: string, d: Record<string, unknown>): Payment {
  return {
    id,
    uid: String(d.uid),
    plan: String(d.plan),
    amount: Number(d.amount) || 0,
    method: (d.method as Payment['method']) ?? 'cash',
    reference: d.reference ? String(d.reference) : undefined,
    paidAt: ts(d.paidAt),
    recordedBy: String(d.recordedBy),
  };
}

export function mapSub(id: string, d: Record<string, unknown>): Subscription {
  return {
    uid: id,
    plan: String(d.plan),
    startsAt: ts(d.startsAt),
    expiresAt: ts(d.expiresAt),
    status: (d.status as Subscription['status']) ?? 'trial',
    featuresConfigured: d.featuresConfigured === true,
    enabledFeatures: Array.isArray(d.enabledFeatures)
      ? d.enabledFeatures.filter((x): x is string => typeof x === 'string')
      : undefined,
    planPrice: typeof d.planPrice === 'number' ? d.planPrice : undefined,
    monthlyTotal: typeof d.monthlyTotal === 'number' ? d.monthlyTotal : undefined,
    tier: d.tier === 'basic' || d.tier === 'pro' || d.tier === 'premium' ? d.tier : undefined,
  };
}

export function mapTicket(id: string, d: Record<string, unknown>): Ticket {
  return {
    id,
    uid: String(d.uid),
    subject: String(d.subject),
    status: d.status === 'resolved' ? 'resolved' : 'open',
    messages: Array.isArray(d.messages) ? (d.messages as Ticket['messages']) : [],
    updatedAt: ts(d.updatedAt),
  };
}

export function mapAnnouncement(id: string, d: Record<string, unknown>): Announcement {
  return {
    id,
    title: String(d.titleEn ?? d.title ?? ''),
    message: String(d.messageEn ?? d.message ?? ''),
    titleEn: d.titleEn ? String(d.titleEn) : undefined,
    titleTa: d.titleTa ? String(d.titleTa) : undefined,
    messageEn: d.messageEn ? String(d.messageEn) : undefined,
    messageTa: d.messageTa ? String(d.messageTa) : undefined,
    type: d.type === 'popup' ? 'popup' : 'banner',
    audience: String(d.audience ?? 'all'),
    active: Boolean(d.active),
    startAt: d.startAt ? ts(d.startAt) : undefined,
    endAt: d.endAt ? ts(d.endAt) : undefined,
    showOnce: Boolean(d.showOnce),
    dismissible: d.dismissible !== false,
    priority: Number(d.priority) || 0,
    viewCount: Number(d.viewCount) || 0,
    dismissCount: Number(d.dismissCount) || 0,
    createdAt: ts(d.createdAt),
  };
}

export function mapAudit(id: string, d: Record<string, unknown>): AuditLog {
  return {
    id,
    adminId: String(d.adminId),
    action: String(d.action),
    targetUid: d.targetUid ? String(d.targetUid) : undefined,
    details: d.details ? String(d.details) : undefined,
    createdAt: ts(d.createdAt),
  };
}

export function mapPlan(id: string, d: Record<string, unknown>): Plan {
  return {
    id,
    name: String(d.name ?? id),
    days: Number(d.days) || 30,
    price: Number(d.price) || 0,
    active: d.active !== false,
    tier: d.tier === 'basic' || d.tier === 'pro' || d.tier === 'premium' ? d.tier : undefined,
  };
}

export function mapAdmin(id: string, d: Record<string, unknown>): AdminProfile {
  return {
    uid: id,
    name: String(d.name),
    email: String(d.email),
    role: d.role === 'staff' ? 'staff' : 'super_admin',
    active: d.active !== false,
  };
}
