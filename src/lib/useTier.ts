import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { useShopGate } from '../context/ShopGateContext';
import { getFirestoreDb } from '../firebase/client';
import {
  ALL_FEATURES,
  BASIC_PRODUCT_LIMIT,
  DEFAULT_FEATURE_PRICE,
  TIER_FEATURES,
  TIER_LABEL,
  isTier,
  isTierFeature,
  minTierFor,
  tierFromPlan,
  type Tier,
  type TierFeature,
} from './tiers';

type PlanMeta = { tier?: Tier; features?: TierFeature[] };
type TierMatrix = Partial<Record<Tier, TierFeature[]>>;
type FeaturePriceMap = Partial<Record<TierFeature, number>>;

const TIERS: Tier[] = ['basic', 'pro', 'premium'];

let planCache: Record<string, PlanMeta> | null = null;
let matrixCache: TierMatrix | null = null;
let priceCache: FeaturePriceMap | null = null;

async function loadPlanMeta(): Promise<Record<string, PlanMeta>> {
  if (planCache) return planCache;
  const snap = await getDocs(collection(getFirestoreDb(), 'plans'));
  const out: Record<string, PlanMeta> = {};
  snap.docs.forEach((d) => {
    const x = d.data() as Record<string, unknown>;
    const tier = isTier(x.tier) ? x.tier : x.tier === 'free' ? 'basic' : undefined;
    const features = Array.isArray(x.features)
      ? (x.features.filter((item) => isTierFeature(item)) as TierFeature[])
      : undefined;
    const meta = { tier, features };
    out[d.id.toLowerCase()] = meta;
    const name = String(x.name ?? x.label ?? x.title ?? '').toLowerCase();
    if (name) out[name] = meta;
  });
  planCache = out;
  return out;
}

async function loadMatrix(): Promise<TierMatrix> {
  if (matrixCache) return matrixCache;
  const snap = await getDoc(doc(getFirestoreDb(), 'appConfig', 'tiers'));
  const raw = (snap.data()?.matrix ?? {}) as Record<string, unknown>;
  const out: TierMatrix = {};
  TIERS.forEach((t) => {
    const row = raw[t] ?? (t === 'basic' ? raw.free : undefined);
    if (Array.isArray(row)) out[t] = row.filter(isTierFeature) as TierFeature[];
  });
  matrixCache = out;
  return out;
}

async function loadFeaturePrices(): Promise<FeaturePriceMap> {
  if (priceCache) return priceCache;
  const snap = await getDoc(doc(getFirestoreDb(), 'appConfig', 'featureCatalog'));
  const raw = (snap.data()?.prices ?? {}) as Record<string, unknown>;
  const out: FeaturePriceMap = { ...DEFAULT_FEATURE_PRICE };
  for (const key of ALL_FEATURES) {
    if (typeof raw[key] === 'number' && Number.isFinite(raw[key])) out[key] = Number(raw[key]);
  }
  priceCache = out;
  return out;
}

function resolveEnabled(
  tier: Tier,
  subscription: ReturnType<typeof useShopGate>['subscription'],
  status: string,
  planMeta: PlanMeta | undefined,
  matrix: TierMatrix | null,
): { unlocked: Set<TierFeature>; grandfather: boolean } {
  // Trial / unconfigured live shops: everything stays on (ticked).
  if (status === 'trial') {
    return { unlocked: new Set(ALL_FEATURES), grandfather: true };
  }
  if (!subscription?.featuresConfigured) {
    return { unlocked: new Set(ALL_FEATURES), grandfather: true };
  }
  if (Array.isArray(subscription.enabledFeatures)) {
    const list = subscription.enabledFeatures.filter(isTierFeature) as TierFeature[];
    return { unlocked: new Set(list), grandfather: false };
  }
  const fromMatrix = matrix?.[tier];
  if (fromMatrix?.length) return { unlocked: new Set(fromMatrix), grandfather: false };
  if (planMeta?.features?.length) return { unlocked: new Set(planMeta.features), grandfather: false };
  return { unlocked: new Set(TIER_FEATURES[tier]), grandfather: false };
}

export function useTier() {
  const { subscription, status, profile } = useShopGate();
  const [meta, setMeta] = useState<Record<string, PlanMeta> | null>(planCache);
  const [matrix, setMatrix] = useState<TierMatrix | null>(matrixCache);
  const [prices, setPrices] = useState<FeaturePriceMap | null>(priceCache);

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
    if (!priceCache) {
      loadFeaturePrices()
        .then((p) => alive && setPrices(p))
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

    const { unlocked, grandfather } = resolveEnabled(tier, subscription, status, planMeta, matrix);
    const has = (feature: TierFeature) => unlocked.has(feature);
    const reportRanges: Array<'daily' | 'weekly' | 'monthly'> = has('fullReports')
      ? ['daily', 'weekly', 'monthly']
      : ['daily'];

    return {
      tier,
      label: TIER_LABEL[tier],
      has,
      grandfather,
      featurePrices: prices ?? DEFAULT_FEATURE_PRICE,
      monthlyTotal: subscription?.monthlyTotal,
      planPrice: subscription?.planPrice,
      neededTier: (feature: TierFeature) => TIER_LABEL[minTierFor(feature)],
      limits: {
        products: has('unlimitedProducts') ? null : BASIC_PRODUCT_LIMIT,
        reportRanges,
      },
    };
  }, [subscription, status, profile?.tierOverride, meta, matrix, prices]);
}
