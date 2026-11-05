import { useEffect, useMemo, useState } from 'react';
import { Card, GhostButton, PageTitle, PrimaryButton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCollection } from '../hooks/useCollection';
import { FEATURE_ICONS } from '../lib/featureIcons';
import { formatDate } from '../lib/format';
import { mapShop, mapSub } from '../lib/mappers';
import {
  ALL_FEATURES,
  BASIC_FEATURES,
  DEFAULT_FEATURE_PRICE,
  DEFAULT_PLAN_PRICE,
  FEATURE_TITLE,
  STANDARD_FEATURES,
  TIER_LABEL,
  calcSubscriptionTotal,
  type PlanFeature,
  type PlanTier,
} from '../lib/planFeatures';
import { addSubscription, computeSubscriptionExpiry, type StartMode } from '../lib/shopOps';

const PLAN_CARDS: {
  id: string;
  tier: PlanTier;
  name: string;
  days: number;
  price: number;
  included: PlanFeature[];
  blurb: string;
}[] = [
  {
    id: 'basic',
    tier: 'basic',
    name: 'Basic',
    days: 30,
    price: DEFAULT_PLAN_PRICE.basic,
    included: BASIC_FEATURES,
    blurb: 'Quick sale',
  },
  {
    id: 'standard',
    tier: 'pro',
    name: 'Standard',
    days: 30,
    price: DEFAULT_PLAN_PRICE.pro,
    included: STANDARD_FEATURES,
    blurb: 'Products · sale · reports · expenses',
  },
];

export function AddSubscriptionPanel() {
  const { rows: shops } = useCollection('users', mapShop);
  const { rows: subs } = useCollection('subscriptions', mapSub);
  const { admin } = useAuth();
  const { push } = useToast();
  const [query, setQuery] = useState('');
  const [uid, setUid] = useState('');
  const [planKey, setPlanKey] = useState<'basic' | 'standard'>('standard');
  const [planPrice, setPlanPrice] = useState(String(DEFAULT_PLAN_PRICE.pro));
  const [enabled, setEnabled] = useState<Set<PlanFeature>>(() => new Set(STANDARD_FEATURES));
  const [prices, setPrices] = useState<Record<PlanFeature, number>>({ ...DEFAULT_FEATURE_PRICE });
  const [startMode, setStartMode] = useState<StartMode>('today');
  const [bonusDays, setBonusDays] = useState('0');
  const [method, setMethod] = useState<'bank' | 'cash' | 'ezcash'>('cash');
  const [amount, setAmount] = useState(String(DEFAULT_PLAN_PRICE.pro));
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const plan = PLAN_CARDS.find((p) => p.id === planKey)!;
  const included = plan.included;
  const planAmount = Math.max(0, Number(planPrice) || 0);
  const total = useMemo(
    () => calcSubscriptionTotal(planAmount, [...enabled], prices, included),
    [planAmount, enabled, prices, included],
  );

  useEffect(() => {
    setAmount(String(total));
  }, [total]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const activeish = shops.filter((s) =>
      ['active', 'trial', 'grace', 'expired', 'pending'].includes(s.status),
    );
    if (!q) return activeish.slice(0, 10);
    return activeish
      .filter(
        (s) =>
          s.shopName.toLowerCase().includes(q) ||
          (s.phone ?? '').includes(q) ||
          s.uid.toLowerCase().includes(q),
      )
      .slice(0, 10);
  }, [shops, query]);

  const shop = shops.find((s) => s.uid === uid);
  const currentExp = subs.find((s) => s.uid === uid)?.expiresAt ?? 0;
  const bonus = Math.max(0, Number(bonusDays) || 0);
  const summary = useMemo(
    () =>
      computeSubscriptionExpiry({
        startMode,
        planDays: plan.days,
        bonusDays: bonus,
        currentExpiresAt: currentExp,
      }),
    [plan.days, startMode, bonus, currentExp],
  );

  function pickPlan(key: 'basic' | 'standard') {
    const next = PLAN_CARDS.find((p) => p.id === key)!;
    setPlanKey(key);
    setPlanPrice(String(next.price));
    setEnabled(new Set(next.included));
  }

  function toggle(f: PlanFeature) {
    setEnabled((prev) => {
      const n = new Set(prev);
      if (n.has(f)) n.delete(f);
      else n.add(f);
      return n;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!admin || busy) return;
    if (!uid) {
      push('Select a shop', 'error');
      return;
    }
    const amt = Number(amount);
    if (Number.isNaN(amt) || amt < 0) {
      push('Enter a valid amount', 'error');
      return;
    }
    const enabledFeatures = ALL_FEATURES.filter((f) => enabled.has(f));
    const featureAmounts: Record<string, number> = {};
    for (const f of ALL_FEATURES) featureAmounts[f] = prices[f] ?? DEFAULT_FEATURE_PRICE[f];
    const label = `${shop?.shopName ?? uid} · ${plan.name} · Rs ${total}/mo · expires ${formatDate(summary.expiresAt)}`;
    if (!window.confirm(`Activate subscription?\n\n${label}`)) return;
    setBusy(true);
    try {
      await addSubscription(admin.uid, {
        uid,
        planId: plan.id,
        planName: plan.name,
        planDays: plan.days,
        isTrialPlan: false,
        startMode,
        bonusDays: bonus,
        method,
        amount: amt,
        reference,
        note,
        tier: plan.tier,
        planPrice: planAmount,
        enabledFeatures,
        featureAmounts,
        monthlyTotal: total,
        featuresConfigured: true,
      });
      push(`Activated · ${plan.name} · Rs ${total}/mo`);
      setReference('');
      setNote('');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-8">
      <PageTitle
        title="Add / activate subscription"
        subtitle="Basic or Standard only — tick add-ons — total = plan + features. App unlocks follow the ticks after Save."
      />
      <form onSubmit={submit} className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="grid gap-3">
          <label className="text-sm font-medium">
            Shop (name / phone)
            <input
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setUid('');
              }}
              placeholder="Search…"
            />
          </label>
          {filtered.length > 0 && !uid ? (
            <ul className="max-h-40 overflow-y-auto rounded-lg border border-line text-sm">
              {filtered.map((s) => (
                <li key={s.uid}>
                  <button
                    type="button"
                    className="flex w-full flex-col px-3 py-2 text-left hover:bg-brand-soft"
                    onClick={() => {
                      setUid(s.uid);
                      setQuery(s.shopName);
                    }}
                  >
                    <span className="font-medium">{s.shopName}</span>
                    <span className="text-xs text-muted">
                      {s.status} · {s.phone ?? s.uid}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {uid ? (
            <div className="flex items-center justify-between rounded-lg bg-brand-soft px-3 py-2 text-sm">
              <span>
                Selected: <strong>{shop?.shopName ?? uid}</strong>
              </span>
              <GhostButton type="button" onClick={() => setUid('')}>
                Change
              </GhostButton>
            </div>
          ) : null}

          <div className="text-xs font-bold uppercase tracking-wide text-muted">Plan</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {PLAN_CARDS.map((p) => {
              const on = planKey === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickPlan(p.id as 'basic' | 'standard')}
                  className={`rounded-[14px] border-2 p-3 text-left transition ${
                    on ? 'border-brand bg-brand-soft' : 'border-line bg-white hover:border-brand/40'
                  }`}
                >
                  <div className="font-bold text-ink">{p.name}</div>
                  <div className="text-lg font-bold text-brand">Rs {p.price}</div>
                  <div className="text-xs text-muted">{p.days} days · {p.blurb}</div>
                </button>
              );
            })}
          </div>

          <label className="text-sm font-medium">
            Plan amount (customizable)
            <input
              className="mt-1 w-full max-w-xs rounded-lg border border-line px-3 py-2 text-sm"
              type="number"
              min={0}
              value={planPrice}
              onChange={(e) => setPlanPrice(e.target.value)}
            />
          </label>

          <div className="text-xs font-bold uppercase tracking-wide text-muted">Features (tick add-ons)</div>
          <div className="grid max-h-64 gap-1 overflow-y-auto rounded-xl border border-line p-2 sm:grid-cols-2">
            {ALL_FEATURES.map((f) => {
              const on = enabled.has(f);
              const inPlan = included.includes(f);
              const amt = prices[f] ?? DEFAULT_FEATURE_PRICE[f];
              const Icon = FEATURE_ICONS[f];
              return (
                <label
                  key={f}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm ${
                    on ? 'bg-brand-soft' : 'hover:bg-keypad'
                  }`}
                >
                  <input type="checkbox" checked={on} onChange={() => toggle(f)} />
                  <Icon className="h-4 w-4 shrink-0 text-brand" strokeWidth={2.25} />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{FEATURE_TITLE[f]}</span>
                    <span className="ml-1 text-[10px] text-muted">{inPlan ? 'incl.' : `+${amt}`}</span>
                  </span>
                  {!inPlan ? (
                    <input
                      className="w-16 rounded border border-line px-1 text-xs"
                      type="number"
                      min={0}
                      value={amt}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        setPrices((prev) => ({ ...prev, [f]: Math.max(0, Number(e.target.value) || 0) }))
                      }
                    />
                  ) : null}
                </label>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="text-sm">
              Start
              <select
                className="ml-2 rounded-lg border border-line px-2 py-1.5 text-sm"
                value={startMode}
                onChange={(e) => setStartMode(e.target.value as StartMode)}
              >
                <option value="today">From today</option>
                <option value="extend">Extend from current expiry</option>
              </select>
            </label>
            <label className="text-sm">
              Bonus days
              <input
                className="ml-2 w-20 rounded-lg border border-line px-2 py-1.5 text-sm"
                value={bonusDays}
                onChange={(e) => setBonusDays(e.target.value)}
              />
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm">
              Payment
              <select
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                value={method}
                onChange={(e) => setMethod(e.target.value as typeof method)}
              >
                <option value="bank">Bank</option>
                <option value="cash">Cash</option>
                <option value="ezcash">eZ Cash</option>
              </select>
            </label>
            <label className="text-sm">
              Charge amount (Rs)
              <input
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
          </div>
          <input
            className="rounded-lg border border-line px-3 py-2 text-sm"
            placeholder="Reference / receipt no."
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
          <textarea
            className="min-h-[60px] rounded-lg border border-line px-3 py-2 text-sm"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <PrimaryButton type="submit" disabled={busy}>
            {busy ? 'Saving…' : `Activate · ${TIER_LABEL[plan.tier]} · Rs ${total}/mo`}
          </PrimaryButton>
        </div>
        <aside className="rounded-xl border border-line bg-keypad/80 p-4 text-sm">
          <div className="text-xs font-semibold uppercase text-muted">Summary</div>
          <dl className="mt-3 space-y-2">
            <div>
              <dt className="text-muted">Plan</dt>
              <dd className="font-medium">
                {plan.name} · Rs {planAmount}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Add-ons</dt>
              <dd className="font-medium">Rs {Math.max(0, total - planAmount)}</dd>
            </div>
            <div>
              <dt className="text-muted">Monthly total</dt>
              <dd className="text-lg font-bold text-brand">Rs {total}</dd>
            </div>
            <div>
              <dt className="text-muted">Expires</dt>
              <dd className="font-semibold text-brand">{formatDate(summary.expiresAt)}</dd>
            </div>
            <div>
              <dt className="text-muted">Features on</dt>
              <dd>
                {enabled.size} / {ALL_FEATURES.length}
              </dd>
            </div>
          </dl>
        </aside>
      </form>
    </Card>
  );
}
