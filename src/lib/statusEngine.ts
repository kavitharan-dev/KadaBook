import type { AnnouncementDoc, AppConfigMain, ShopProfile, ShopStatus, SubscriptionDoc } from './shopAccessTypes';

export function millis(v: unknown): number {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && 'toMillis' in v) {
    return (v as { toMillis: () => number }).toMillis();
  }
  return 0;
}

export function effectiveStatus(
  profile: Pick<ShopProfile, 'status'>,
  sub: SubscriptionDoc | null,
  graceDays: number,
  now = Date.now(),
): ShopStatus {
  const stored = profile.status;
  if (stored === 'pending' || stored === 'rejected' || stored === 'suspended') {
    return stored;
  }
  if (!sub || !sub.expiresAt) {
    return stored === 'trial' ? 'trial' : 'expired';
  }
  const expiresAt = sub.expiresAt;
  const graceEnd = expiresAt + graceDays * 86400000;
  if (now <= expiresAt) {
    return sub.status === 'trial' || sub.plan === 'trial' ? 'trial' : 'active';
  }
  if (now <= graceEnd) return 'grace';
  return 'expired';
}

export function trialDaysLeft(sub: SubscriptionDoc | null, now = Date.now()) {
  if (!sub?.expiresAt) return 0;
  return Math.max(0, Math.ceil((sub.expiresAt - now) / 86400000));
}

export function graceDaysLeft(sub: SubscriptionDoc | null, graceDays: number, now = Date.now()) {
  if (!sub?.expiresAt) return 0;
  const graceEnd = sub.expiresAt + graceDays * 86400000;
  return Math.max(0, Math.ceil((graceEnd - now) / 86400000));
}

export function expiringWithinDays(sub: SubscriptionDoc | null, days: number, now = Date.now()) {
  if (!sub?.expiresAt) return false;
  return sub.expiresAt > now && sub.expiresAt <= now + days * 86400000;
}

export function compareAppVersion(current: string, minimum: string) {
  const parse = (v: string) => v.split('.').map((n) => parseInt(n, 10) || 0);
  const a = parse(current);
  const b = parse(minimum);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function audienceMatches(
  audience: AnnouncementDoc['audience'],
  status: ShopStatus,
  sub: SubscriptionDoc | null,
  graceDays: number,
  now = Date.now(),
): boolean {
  if (audience === 'all') return true;
  if (audience === 'trial') return status === 'trial';
  if (audience === 'active') return status === 'active';
  if (audience === 'grace') return status === 'grace';
  if (audience === 'expired') return status === 'expired';
  if (audience === 'expiring') return expiringWithinDays(sub, 7, now);
  if (audience === 'pending') return status === 'pending';
  return false;
}

export const DEFAULT_APP_CONFIG: AppConfigMain = {
  maintenance: false,
  minVersion: '1.0.0',
  trialDays: 14,
  graceDays: 7,
  renewWhatsApp: '',
  features: { tamil: true, sinhala: true, reportExport: true, signupsOpen: true },
};
