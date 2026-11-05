import { useEffect, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { Card, PageTitle, PrimaryButton, Skeleton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCollection } from '../hooks/useCollection';
import { writeAuditLog } from '../lib/audit';
import { CURRENT_PLAN_SEED, isCurrentPlanId } from '../lib/currentPlans';
import { getDb } from '../lib/firebase';
import { mapPlan } from '../lib/mappers';
import { FEATURE_TITLE, type PlanFeature } from '../lib/planFeatures';

export function PlansPage() {
  const { rows, loading } = useCollection('plans', mapPlan);
  const { admin } = useAuth();
  const { push } = useToast();
  const [draft, setDraft] = useState<Record<string, { name: string; days: string; price: string }>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const next: Record<string, { name: string; days: string; price: string }> = {};
    for (const p of rows) {
      if (!isCurrentPlanId(p.id) && !CURRENT_PLAN_SEED.some((s) => s.id === p.id)) continue;
      next[p.id] = { name: p.name, days: String(p.days), price: String(p.price) };
    }
    for (const s of CURRENT_PLAN_SEED) {
      if (!next[s.id]) next[s.id] = { name: s.name, days: String(s.days), price: String(s.price) };
    }
    setDraft(next);
  }, [rows]);

  async function ensureSeed() {
    if (!admin) return;
    setBusy(true);
    try {
      for (const s of CURRENT_PLAN_SEED) {
        await setDoc(
          doc(getDb(), 'plans', s.id),
          {
            name: s.name,
            days: s.days,
            price: s.price,
            tier: s.tier,
            features: s.features,
            active: true,
            updatedAt: Date.now(),
          },
          { merge: true },
        );
      }
      // Quietly hide any non Basic/Standard docs from Payments / APK.
      for (const p of rows) {
        if (isCurrentPlanId(p.id)) continue;
        await setDoc(
          doc(getDb(), 'plans', p.id),
          { active: false, archivedAt: Date.now(), archivedReason: 'old_plan_model' },
          { merge: true },
        );
      }
      await writeAuditLog({
        adminId: admin.uid,
        action: 'seed_plans',
        details: 'basic + standard',
      });
      push('Basic + Standard ready');
    } catch (e) {
      push(e instanceof Error ? e.message : 'Seed failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function savePlan(id: string, features: PlanFeature[], tier: 'basic' | 'pro') {
    if (!admin) return;
    const d = draft[id];
    if (!d) return;
    const price = Math.max(0, Number(d.price) || 0);
    const days = Math.max(1, Number(d.days) || 30);
    setBusy(true);
    try {
      await setDoc(
        doc(getDb(), 'plans', id),
        {
          name: d.name.trim() || id,
          days,
          price,
          tier,
          features,
          active: true,
          updatedAt: Date.now(),
        },
        { merge: true },
      );
      await writeAuditLog({
        adminId: admin.uid,
        action: 'update_plan',
        details: `${d.name} · Rs ${price} / ${days}d`,
      });
      push(`${d.name} saved`);
    } catch (e) {
      push(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  const cards = CURRENT_PLAN_SEED.map((s) => ({
    id: s.id,
    tier: s.tier,
    features: s.features,
    hint: s.id === 'basic' ? 'Quick sale only' : 'Products · sale · reports · expenses',
  }));

  return (
    <div>
      <PageTitle
        title="Plans"
        subtitle="Basic ₹500 + Standard ₹1000 (same as APK). Extra add-ons = Features; per-shop ticks = Manage Shops."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <PrimaryButton onClick={() => void ensureSeed()} disabled={busy}>
          {busy ? 'Working…' : 'Sync Basic + Standard'}
        </PrimaryButton>
      </div>
      {loading && rows.length === 0 ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {cards.map((c) => {
            const d = draft[c.id] ?? { name: c.id, days: '30', price: '0' };
            return (
              <Card key={c.id} className="border-brand/15">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-ink">{d.name || c.id}</h2>
                  <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                    {c.hint}
                  </span>
                </div>
                <label className="mb-2 block text-sm font-medium">
                  Name
                  <input
                    className="mt-1 w-full rounded-2xl border border-line px-3 py-2 text-sm"
                    value={d.name}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [c.id]: { ...d, name: e.target.value } }))}
                  />
                </label>
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <label className="text-sm font-medium">
                    Days
                    <input
                      className="mt-1 w-full rounded-2xl border border-line px-3 py-2 text-sm"
                      type="number"
                      min={1}
                      value={d.days}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [c.id]: { ...d, days: e.target.value } }))}
                    />
                  </label>
                  <label className="text-sm font-medium">
                    Price (Rs)
                    <input
                      className="mt-1 w-full rounded-2xl border border-line px-3 py-2 text-sm"
                      type="number"
                      min={0}
                      value={d.price}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [c.id]: { ...d, price: e.target.value } }))}
                    />
                  </label>
                </div>
                <div className="mb-3 rounded-2xl bg-keypad px-3 py-2 text-xs text-muted">
                  <div className="mb-1 font-semibold text-ink">Included features</div>
                  <ul className="list-inside list-disc">
                    {c.features.map((f) => (
                      <li key={f}>{FEATURE_TITLE[f]}</li>
                    ))}
                  </ul>
                </div>
                <PrimaryButton disabled={busy} onClick={() => void savePlan(c.id, c.features, c.tier)}>
                  Save {d.name || c.id}
                </PrimaryButton>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
