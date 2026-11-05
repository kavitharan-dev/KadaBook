import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { X } from 'lucide-react';
import { GhostButton, PrimaryButton } from './ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { writeAuditLog } from '../lib/audit';
import { FEATURE_ICONS } from '../lib/featureIcons';
import { getDb } from '../lib/firebase';
import {
  ALL_FEATURES,
  BASIC_FEATURES,
  DEFAULT_FEATURE_PRICE,
  DEFAULT_PLAN_PRICE,
  FEATURE_TITLE,
  STANDARD_FEATURES,
  TIER_FEATURES,
  TIER_LABEL,
  calcSubscriptionTotal,
  isPlanFeature,
  type PlanFeature,
  type PlanTier,
} from '../lib/planFeatures';
import type { ShopUser } from '../types/models';

type Props = {
  shop: ShopUser;
  onClose: () => void;
};

/**
 * Per-shop feature customize.
 * Live / not configured → all live features shown ticked (current unlock).
 * Save is the only write that sets featuresConfigured.
 */
export function ShopFeaturePanel({ shop, onClose }: Props) {
  const { admin } = useAuth();
  const { push } = useToast();
  const [tier, setTier] = useState<PlanTier>('pro');
  const [planPrice, setPlanPrice] = useState(String(DEFAULT_PLAN_PRICE.pro));
  const [enabled, setEnabled] = useState<Set<PlanFeature>>(new Set(ALL_FEATURES));
  const [prices, setPrices] = useState<Record<PlanFeature, number>>({ ...DEFAULT_FEATURE_PRICE });
  const [catalog, setCatalog] = useState<Record<PlanFeature, number>>({ ...DEFAULT_FEATURE_PRICE });
  const [configured, setConfigured] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const included = TIER_FEATURES[tier === 'premium' ? 'premium' : tier];
  const planAmount = Math.max(0, Number(planPrice) || 0);
  const total = useMemo(
    () => calcSubscriptionTotal(planAmount, [...enabled], prices, included),
    [planAmount, enabled, prices, included],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const [catSnap, subSnap] = await Promise.all([
        getDoc(doc(getDb(), 'appConfig', 'featureCatalog')),
        getDoc(doc(getDb(), 'subscriptions', shop.uid)),
      ]);
      if (!alive) return;
      const raw = (catSnap.data()?.prices ?? {}) as Record<string, unknown>;
      const nextPrices = { ...DEFAULT_FEATURE_PRICE };
      for (const key of ALL_FEATURES) {
        if (typeof raw[key] === 'number') nextPrices[key] = Number(raw[key]);
      }
      setCatalog(nextPrices);

      const d = (subSnap.exists() ? subSnap.data() : {}) as Record<string, unknown>;
      const nextTier: PlanTier =
        d.tier === 'basic' || d.tier === 'pro' || d.tier === 'premium'
          ? d.tier
          : /basic/i.test(String(d.plan ?? ''))
            ? 'basic'
            : 'pro';
      setTier(nextTier);
      setPlanPrice(
        String(
          typeof d.planPrice === 'number'
            ? d.planPrice
            : nextTier === 'basic'
              ? DEFAULT_PLAN_PRICE.basic
              : DEFAULT_PLAN_PRICE.pro,
        ),
      );
      const isConfigured = d.featuresConfigured === true;
      setConfigured(isConfigured);
      if (!isConfigured) {
        // Live shop: show everything ticked (matches app unlock).
        setEnabled(new Set(ALL_FEATURES));
      } else {
        const list = (Array.isArray(d.enabledFeatures) ? d.enabledFeatures : []).filter(isPlanFeature);
        setEnabled(new Set(list.length ? list : TIER_FEATURES[nextTier]));
      }
      const amounts = {
        ...nextPrices,
        ...((d.featureAmounts as Record<PlanFeature, number> | undefined) ?? {}),
      };
      setPrices(amounts);
      setLoaded(true);
    })().catch(() => {
      if (alive) setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [shop.uid]);

  function applyPlan(next: PlanTier) {
    setTier(next);
    setPlanPrice(String(next === 'basic' ? DEFAULT_PLAN_PRICE.basic : DEFAULT_PLAN_PRICE.pro));
    setEnabled((prev) => {
      const n = new Set(prev);
      for (const f of TIER_FEATURES[next]) n.add(f);
      return n;
    });
  }

  function toggle(feature: PlanFeature) {
    setEnabled((prev) => {
      const n = new Set(prev);
      if (n.has(feature)) n.delete(feature);
      else n.add(feature);
      return n;
    });
  }

  async function save() {
    if (!admin || busy) return;
    setBusy(true);
    try {
      const enabledFeatures = ALL_FEATURES.filter((f) => enabled.has(f));
      const featureAmounts: Record<string, number> = {};
      for (const f of ALL_FEATURES) featureAmounts[f] = prices[f] ?? catalog[f] ?? DEFAULT_FEATURE_PRICE[f];
      const monthlyTotal = calcSubscriptionTotal(planAmount, enabledFeatures, featureAmounts, included);
      await setDoc(
        doc(getDb(), 'subscriptions', shop.uid),
        {
          tier,
          plan: TIER_LABEL[tier],
          planName: TIER_LABEL[tier],
          planPrice: planAmount,
          enabledFeatures,
          featureAmounts,
          monthlyTotal,
          featuresConfigured: true,
          staffSeats: 2,
          branchLimit: 2,
        },
        { merge: true },
      );
      await writeAuditLog({
        adminId: admin.uid,
        action: 'configure_shop_features',
        targetUid: shop.uid,
        details: `${TIER_LABEL[tier]} · ${enabledFeatures.length} features · Rs ${monthlyTotal}/mo`,
      });
      push(`Saved ${shop.shopName} · Rs ${monthlyTotal}/mo`);
      setConfigured(true);
      onClose();
    } catch (e) {
      push(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <button type="button" className="flex-1 cursor-default" aria-label="Close" onClick={onClose} />
      <aside className="flex h-full w-full max-w-lg flex-col bg-surface shadow-2xl">
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">{shop.shopName}</h2>
            <p className="text-xs text-muted">{shop.phone ?? shop.uid}</p>
            <p className="mt-1 text-xs font-medium text-brand">
              {configured ? 'Customized pack' : 'Live · all features active until Save'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-keypad">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {!loaded ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : (
            <>
              <div className="rounded-[14px] border border-brand/20 bg-brand-soft px-3 py-2 text-xs text-ink">
                {configured
                  ? 'Ticks = what the app unlocks now. Change + Save updates the APK.'
                  : 'Activated live shop: every feature shown ON (ticked). Untick what you want off, then Save — app follows.'}
              </div>
              <div className="flex flex-wrap gap-2">
                {(['basic', 'pro'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => applyPlan(t)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      tier === t ? 'bg-brand text-white' : 'border border-line bg-white text-ink'
                    }`}
                  >
                    {TIER_LABEL[t]} · Rs {DEFAULT_PLAN_PRICE[t]}
                  </button>
                ))}
              </div>
              <label className="block text-sm font-medium">
                Plan amount (Rs / month)
                <input
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                  type="number"
                  min={0}
                  value={planPrice}
                  onChange={(e) => setPlanPrice(e.target.value)}
                />
              </label>
              <div className="space-y-1">
                {ALL_FEATURES.map((f) => {
                  const on = enabled.has(f);
                  const inPlan = included.includes(f);
                  const amt = prices[f] ?? DEFAULT_FEATURE_PRICE[f];
                  const Icon = FEATURE_ICONS[f];
                  return (
                    <label
                      key={f}
                      className={`flex cursor-pointer items-center gap-3 rounded-[12px] border px-3 py-2.5 text-sm ${
                        on ? 'border-brand/30 bg-brand-soft' : 'border-line bg-white'
                      }`}
                    >
                      <input type="checkbox" checked={on} onChange={() => toggle(f)} />
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-brand shadow-sm">
                        <Icon className="h-4 w-4" strokeWidth={2.25} />
                      </span>
                      <span className="flex-1">
                        <span className="font-semibold text-ink">{FEATURE_TITLE[f]}</span>
                        <span className="mt-0.5 block text-[11px] text-muted">
                          {inPlan ? 'Included in plan' : `Add-on · Rs ${amt}`}
                          {on ? ' · ON' : ' · off'}
                        </span>
                      </span>
                      {!inPlan ? (
                        <input
                          className="w-20 rounded-lg border border-line px-1 py-1 text-xs"
                          type="number"
                          min={0}
                          value={amt}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            setPrices((prev) => ({
                              ...prev,
                              [f]: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                        />
                      ) : (
                        <span className="text-[11px] font-semibold text-muted">incl.</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-line px-5 py-4">
          <div className="mb-3 flex items-end justify-between">
            <div className="text-xs text-muted">
              Plan Rs {planAmount} + add-ons Rs {Math.max(0, total - planAmount)}
            </div>
            <div className="text-lg font-bold text-brand">Rs {total}/mo</div>
          </div>
          <div className="flex gap-2">
            <GhostButton className="flex-1" onClick={onClose}>
              Cancel
            </GhostButton>
            <PrimaryButton className="flex-1" disabled={busy || !loaded} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save features'}
            </PrimaryButton>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Basic includes: {BASIC_FEATURES.map((f) => FEATURE_TITLE[f]).join(', ')}. Standard +{' '}
            {STANDARD_FEATURES.filter((f) => !BASIC_FEATURES.includes(f))
              .map((f) => FEATURE_TITLE[f])
              .join(', ')}
            .
          </p>
        </div>
      </aside>
    </div>
  );
}
