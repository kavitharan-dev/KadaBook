import type { SubscriptionDoc } from './shopAccessTypes';

/** Included seats when staff / branches add-ons are ON (not grandfathered). */
export const INCLUDED_STAFF_SEATS = 2;
export const INCLUDED_BRANCHES = 2;
/** Without the branches add-on → single location only. */
export const SINGLE_BRANCH = 1;

function featureOn(subscription: SubscriptionDoc, key: string) {
  return Array.isArray(subscription.enabledFeatures) && subscription.enabledFeatures.includes(key);
}

/**
 * Live / trial / not-yet-customized shops keep unlimited seats (safe).
 * After admin Save:
 * - `staff` tick → 2 seats (or staffSeats override)
 * - `branches` tick → 2 branches (or branchLimit override)
 * - `kitchenStock` without `branches` → still 2 (main + sub so Send works)
 * - neither → 1 branch only
 * - no `staff` tick → seats N/A (Staff screen already locked)
 */
export function planLimits(subscription: SubscriptionDoc | null | undefined) {
  if (!subscription?.featuresConfigured) {
    return { staffSeats: null as number | null, branches: null as number | null, grandfather: true };
  }
  const staffOn = featureOn(subscription, 'staff');
  const branchesOn = featureOn(subscription, 'branches');
  const kitchenOn = featureOn(subscription, 'kitchenStock');
  const staffSeats = staffOn
    ? typeof subscription.staffSeats === 'number' && subscription.staffSeats > 0
      ? Math.floor(subscription.staffSeats)
      : INCLUDED_STAFF_SEATS
    : null;
  const branches = branchesOn
    ? typeof subscription.branchLimit === 'number' && subscription.branchLimit > 0
      ? Math.floor(subscription.branchLimit)
      : INCLUDED_BRANCHES
    : kitchenOn
      ? INCLUDED_BRANCHES
      : SINGLE_BRANCH;
  return { staffSeats, branches, grandfather: false };
}

export function staffSeatBlocked(activeStaffCount: number, subscription: SubscriptionDoc | null | undefined) {
  const { staffSeats } = planLimits(subscription);
  if (staffSeats == null) return null;
  if (activeStaffCount < staffSeats) return null;
  return {
    limit: staffSeats,
    message: `Your plan includes ${staffSeats} staff login${staffSeats === 1 ? '' : 's'}. Ask admin to add more seats.`,
  };
}

export function branchBlocked(branchCount: number, subscription: SubscriptionDoc | null | undefined) {
  const { branches } = planLimits(subscription);
  if (branches == null) return null;
  if (branchCount < branches) return null;
  return {
    limit: branches,
    message: `Your plan includes ${branches} branch${branches === 1 ? '' : 'es'}. Ask admin to add more branches.`,
  };
}

export function quotaUpgradeWhatsAppMessage(input: {
  kind: 'staff' | 'branch';
  shopName: string;
  phone: string;
  current: number;
  limit: number;
}) {
  const what = input.kind === 'staff' ? 'staff login seats' : 'branches';
  return [
    `Hi, I need more ${what} on KadaBook.`,
    '',
    `Shop: ${input.shopName}`,
    `Phone: ${input.phone}`,
    `Current ${input.kind === 'staff' ? 'staff' : 'branches'}: ${input.current}`,
    `Plan includes: ${input.limit}`,
    '',
    'Please upgrade / add seats and tell me the extra amount.',
  ].join('\n');
}
