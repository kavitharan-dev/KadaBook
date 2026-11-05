import type { Plan } from '../types/models';
import { BASIC_FEATURES, DEFAULT_PLAN_PRICE, STANDARD_FEATURES } from './planFeatures';

/** Only these two are the live subscription model (APK Upgrade Plan). */
export const CURRENT_PLAN_IDS = ['basic', 'standard'] as const;

export type CurrentPlanId = (typeof CURRENT_PLAN_IDS)[number];

export function isCurrentPlanId(id: string): id is CurrentPlanId {
  return (CURRENT_PLAN_IDS as readonly string[]).includes(id);
}

export function isCurrentPlan(p: Plan) {
  if (p.active === false) return false;
  if (isCurrentPlanId(p.id)) return true;
  const name = p.name.toLowerCase();
  return name === 'basic' || name === 'standard';
}

/** Fallback cards if Firestore is empty / not seeded. */
export const CURRENT_PLAN_FALLBACK: Plan[] = [
  {
    id: 'basic',
    name: 'Basic',
    days: 30,
    price: DEFAULT_PLAN_PRICE.basic,
    active: true,
    tier: 'basic',
  },
  {
    id: 'standard',
    name: 'Standard',
    days: 30,
    price: DEFAULT_PLAN_PRICE.pro,
    active: true,
    tier: 'pro',
  },
];

export const CURRENT_PLAN_SEED = [
  {
    id: 'basic' as const,
    name: 'Basic',
    days: 30,
    price: DEFAULT_PLAN_PRICE.basic,
    tier: 'basic' as const,
    features: BASIC_FEATURES,
  },
  {
    id: 'standard' as const,
    name: 'Standard',
    days: 30,
    price: DEFAULT_PLAN_PRICE.pro,
    tier: 'pro' as const,
    features: STANDARD_FEATURES,
  },
];

/** Plans shown in Payments / pickers — Basic + Standard only. */
export function pickCurrentPlans(rows: Plan[]): Plan[] {
  const live = rows.filter(isCurrentPlan);
  if (live.length) {
    // Prefer canonical ids; de-dupe by id.
    const byId = new Map<string, Plan>();
    for (const p of live) byId.set(p.id, p);
    const ordered = CURRENT_PLAN_IDS.map((id) => byId.get(id)).filter(Boolean) as Plan[];
    if (ordered.length) return ordered;
    return [...byId.values()];
  }
  return CURRENT_PLAN_FALLBACK;
}
