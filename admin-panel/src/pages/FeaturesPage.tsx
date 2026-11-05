import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Card, PageTitle, PrimaryButton, Skeleton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getDb } from '../lib/firebase';
import { writeAuditLog } from '../lib/audit';
import { FEATURE_ICONS } from '../lib/featureIcons';
import {
  ALL_FEATURES,
  DEFAULT_FEATURE_PRICE,
  FEATURE_TITLE,
  type PlanFeature,
} from '../lib/planFeatures';

export function FeaturesPage() {
  const { admin } = useAuth();
  const { push } = useToast();
  const [prices, setPrices] = useState<Record<PlanFeature, number>>({ ...DEFAULT_FEATURE_PRICE });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getDoc(doc(getDb(), 'appConfig', 'featureCatalog'))
      .then((snap) => {
        if (!alive) return;
        const raw = (snap.data()?.prices ?? {}) as Record<string, unknown>;
        const next = { ...DEFAULT_FEATURE_PRICE };
        for (const key of ALL_FEATURES) {
          if (typeof raw[key] === 'number' && Number.isFinite(raw[key])) next[key] = Number(raw[key]);
        }
        setPrices(next);
      })
      .catch(() => undefined)
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  async function save() {
    if (!admin || busy) return;
    setBusy(true);
    try {
      await setDoc(doc(getDb(), 'appConfig', 'featureCatalog'), { prices, updatedAt: Date.now() }, { merge: true });
      await writeAuditLog({ adminId: admin.uid, action: 'update_feature_catalog', details: 'feature prices' });
      push('Feature prices saved');
    } catch (e) {
      push(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageTitle
        title="Features & prices"
        subtitle="Add-on price list for Basic/Standard (live APK features only). Saving prices never locks a shop."
      />
      <Card className="mb-4 border-sale/30 bg-sale-wash text-sm text-ink">
        <strong className="text-sale">Safe:</strong> Prices only. Per-shop ON/OFF ticks ={' '}
        <strong>Manage Shops</strong> → click shop → Save. Status gates (trial/expired) ={' '}
        <strong>Access Control</strong>.
      </Card>
      {loading ? (
        <Skeleton className="h-64" />
      ) : (
        <Card>
          <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ALL_FEATURES.map((key) => {
              const Icon = FEATURE_ICONS[key];
              return (
                <label
                  key={key}
                  className="flex items-start gap-3 rounded-[14px] border border-line bg-white px-3 py-3 text-sm shadow-sm"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">{FEATURE_TITLE[key]}</span>
                    <span className="mt-1 flex items-center gap-2 text-muted">
                      <span className="text-xs">Rs</span>
                      <input
                        className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brand"
                        type="number"
                        min={0}
                        value={prices[key]}
                        onChange={(e) =>
                          setPrices((prev) => ({
                            ...prev,
                            [key]: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                      />
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <PrimaryButton onClick={() => void save()} disabled={busy}>
            {busy ? 'Saving…' : 'Save feature prices'}
          </PrimaryButton>
        </Card>
      )}
    </div>
  );
}
