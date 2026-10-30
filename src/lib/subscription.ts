import AsyncStorage from '@react-native-async-storage/async-storage';

export type PlanId = 'free' | 'monthly' | 'yearly';

export type SubscriptionPlan = {
  id: PlanId;
  priceRs: number;
  label: string;
  period: string;
};

export const PLANS: SubscriptionPlan[] = [
  { id: 'free', priceRs: 0, label: 'Free', period: 'Basic sales & reports' },
  { id: 'monthly', priceRs: 500, label: 'Premium Monthly', period: 'Rs 500 / month' },
  { id: 'yearly', priceRs: 5000, label: 'Premium Yearly', period: 'Rs 5000 / year' },
];

const KEY = 'kb_subscription';

export type SubscriptionState = {
  plan: PlanId;
  activatedAt: number | null;
};

export async function loadSubscription(): Promise<SubscriptionState> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { plan: 'free', activatedAt: null };
  try {
    const parsed = JSON.parse(raw) as SubscriptionState;
    if (parsed.plan === 'monthly' || parsed.plan === 'yearly') {
      return { plan: parsed.plan, activatedAt: parsed.activatedAt ?? Date.now() };
    }
  } catch {
    /* ignore */
  }
  return { plan: 'free', activatedAt: null };
}

export async function saveSubscription(plan: PlanId) {
  await AsyncStorage.setItem(
    KEY,
    JSON.stringify({ plan, activatedAt: plan === 'free' ? null : Date.now() } satisfies SubscriptionState),
  );
}
