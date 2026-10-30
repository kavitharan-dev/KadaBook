import type { ShopStatus } from '../types/models';

const STYLES: Record<ShopStatus, string> = {
  pending: 'bg-amber-100 text-amber-900 border-amber-200',
  trial: 'bg-brand-soft text-brand border-brand/20',
  active: 'bg-emerald-50 text-sale border-emerald-200',
  grace: 'bg-orange-50 text-orange-800 border-orange-200',
  expired: 'bg-slate-100 text-slate-600 border-slate-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
  rejected: 'bg-red-50 text-red-800 border-red-200',
};

export function statusBadgeClass(status: ShopStatus) {
  return STYLES[status] ?? STYLES.pending;
}

export function statusLabel(status: ShopStatus) {
  return status.replace('_', ' ');
}
