import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { useShopGate } from '../context/ShopGateContext';
import { getFirestoreDb } from '../firebase/client';
import {
  BASIC_PRODUCT_LIMIT,
  TIER_FEATURES,
  TIER_LABEL,
  isTier,
  minTierFor,
  tierFromPlan,
  type Tier,
  type TierFeature,
} from './tiers';

type PlanMeta = { tier?: Tier; features?: TierFeature[] };
type TierMatrix = Partial<Record<Tier, TierFeature[]>>;

const TIERS: Tier[] = ['basic', 'pro', 'premium'];

let planCache: Record<string, PlanMeta> | null = null;
let matrixCache: TierMatrix | null = null;

async function loadPlanMeta(): Promise<Record<string, PlanMeta>> {
  if (planCache) return planCache;
  const snap = await getDocs(collection(getFirestoreDb(), 'plans'));
  const out: Record<string, PlanMeta> = {};
  snap.docs.forEach((d) => {
    const x = d.data() as Record<string, unknown>;
    const tier = isTier(x.tier) ? x.tier : x.tier === 'free' ? 'basic' : undefined;
    const features = Array.isArray(x.features)
      ? (x.features.filter((item) => typeof item === 'string') as TierFeature[])
      : undefined;
    const meta = { tier, features };
    out[d.id.toLowerCase()] = meta;
    const name = String(x.name ?? x.label ?? x.title ?? '').toLowerCase();
    if (name) out[name] = meta;
  });
  planCache = out;
  return out;
}

/** appConfig/tiers: { matrix: { basic: [...], pro: [...], premium: [...] } } */
async function loadMatrix(): Promise<TierMatrix> {
  if (matrixCache) return matrixCache;
  const snap = await getDoc(doc(getFirestoreDb(), 'appConfig', 'tiers'));
  const raw = (snap.data()?.matrix ?? {}) as Record<string, unknown>;
  const out: TierMatrix = {};
  TIERS.forEach((t) => {
    const row = raw[t] ?? (t === 'basic' ? raw.free : undefined);
    if (Array.isArray(row)) out[t] = row as TierFeature[];
  });
  matrixCache = out;
  return out;
}

export function useTier() {
  const { subscription, status, profile } = useShopGate();
  const [meta, setMeta] = useState<Record<string, PlanMeta> | null>(planCache);
  const [matrix, setMatrix] = useState<TierMatrix | null>(matrixCache);

  useEffect(() => {
    let alive = true;
    if (!planCache) {
      loadPlanMeta()
        .then((m) => alive && setMeta(m))
        .catch(() => undefined);
    }
    if (!matrixCache) {
      loadMatrix()
        .then((m) => alive && setMatrix(m))
        .catch(() => undefined);
    }
    return () => {
      alive = false;
    };
  }, []);

  return useMemo(() => {
    const planKey = (subscription?.plan ?? '').toLowerCase();
    const planMeta = meta?.[planKey] ?? meta?.[subscription?.planId?.toLowerCase() ?? ''];
    const fromPlan = isTier(subscription?.tier)
      ? subscription.tier
      : (planMeta?.tier ?? tierFromPlan(subscription?.planName || subscription?.plan || ''));
    let tier: Tier = 'basic';
    if (isTier(profile?.tierOverride)) tier = profile.tierOverride;
    else if (status === 'trial') tier = 'premium';
    else if (status === 'active' || status === 'grace') tier = fromPlan;

    const extra = planMeta?.features ?? [];
    // The admin matrix (appConfig/tiers) wins for features it mentions. Features added after it was
    // saved (e.g. kitchenStock) fall back to the built-in split, so no shop is locked out by an old matrix.
    const inMatrix = (feature: TierFeature) => TIERS.some((t) => matrix?.[t]?.includes(feature));
    const has = (feature: TierFeature) =>
      extra.includes(feature) ||
      (inMatrix(feature) ? !!matrix?.[tier]?.includes(feature) : TIER_FEATURES[tier].includes(feature));
    const reportRanges: Array<'daily' | 'weekly' | 'monthly'> = has('fullReports')
      ? ['daily', 'weekly', 'monthly']
      : ['daily', 'weekly'];
    return {
      tier,
      label: TIER_LABEL[tier],
      has,
      neededTier: (feature: TierFeature) => TIER_LABEL[minTierFor(feature)],
      limits: {
        products: has('unlimitedProducts') ? null : BASIC_PRODUCT_LIMIT,
        reportRanges,
      },
    };
  }, [subscription, status, profile?.tierOverride, meta, matrix]);
}
