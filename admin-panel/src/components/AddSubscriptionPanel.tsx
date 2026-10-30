import { useMemo, useState } from 'react';
import { Card, GhostButton, PageTitle, PrimaryButton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCollection } from '../hooks/useCollection';
import { formatDate } from '../lib/format';
import { mapPlan, mapShop, mapSub } from '../lib/mappers';
import { addSubscription, computeSubscriptionExpiry, type StartMode } from '../lib/shopOps';

export function AddSubscriptionPanel() {
  const { rows: shops } = useCollection('users', mapShop);
  const { rows: subs } = useCollection('subscriptions', mapSub);
  const { rows: plans } = useCollection('plans', mapPlan);
  const { admin } = useAuth();
  const { push } = useToast();
  const [query, setQuery] = useState('');
  const [uid, setUid] = useState('');
  const [planId, setPlanId] = useState('');
  const [startMode, setStartMode] = useState<StartMode>('today');
  const [bonusDays, setBonusDays] = useState('0');
  const [method, setMethod] = useState<'bank' | 'cash' | 'ezcash'>('cash');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return shops.slice(0, 8);
    return shops
      .filter(
        (s) =>
          s.shopName.toLowerCase().includes(q) ||
          (s.phone ?? '').includes(q) ||
          s.uid.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [shops, query]);

  const plan = plans.find((p) => p.id === planId);
  const shop = shops.find((s) => s.uid === uid);
  const currentExp = subs.find((s) => s.uid === uid)?.expiresAt ?? 0;
  const bonus = Math.max(0, Number(bonusDays) || 0);
  const summary = useMemo(() => {
    if (!plan) return null;
    return computeSubscriptionExpiry({
      startMode,
      planDays: plan.days,
      bonusDays: bonus,
      currentExpiresAt: currentExp,
    });
  }, [plan, startMode, bonus, currentExp]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!admin || busy) return;
    if (!uid || !plan) {
      push('Select a shop and plan', 'error');
      return;
    }
    const amt = Number(amount);
    if (Number.isNaN(amt) || amt < 0) {
      push('Enter a valid amount', 'error');
      return;
    }
    const isTrial = plan.name.toLowerCase().includes('trial') || plan.price === 0;
    const label = `${shop?.shopName ?? uid} · ${plan.name} · expires ${summary ? formatDate(summary.expiresAt) : '?'}`;
    if (!window.confirm(`Add subscription?\n\n${label}`)) return;
    setBusy(true);
    try {
      await addSubscription(admin.uid, {
        uid,
        planId: plan.id,
        planName: plan.name,
        planDays: plan.days,
        isTrialPlan: isTrial,
        startMode,
        bonusDays: bonus,
        method,
        amount: isTrial ? 0 : amt,
        reference,
        note,
      });
      push('Subscription saved');
      setAmount('');
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
      <PageTitle title="Add subscription" subtitle="One batch write: subscription, user status, payment & audit" />
      <form onSubmit={submit} className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="grid gap-3">
          <label className="text-sm font-medium">
            Shop (name / phone)
            <input
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
            />
          </label>
          {filtered.length > 0 && !uid ? (
            <ul className="max-h-40 overflow-y-auto rounded-lg border border-line text-sm">
              {filtered.map((s) => (
                <li key={s.uid}>
                  <button
                    type="button"
                    className="flex w-full flex-col px-3 py-2 text-left hover:bg-brand-soft/40"
                    onClick={() => {
                      setUid(s.uid);
                      setQuery(s.shopName);
                    }}
                  >
                    <span className="font-medium">{s.shopName}</span>
                    <span className="text-xs text-muted">{s.phone ?? s.uid}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {uid ? (
            <div className="flex items-center justify-between rounded-lg bg-brand-soft/30 px-3 py-2 text-sm">
              <span>
                Selected: <strong>{shop?.shopName ?? uid}</strong>
              </span>
              <GhostButton type="button" onClick={() => setUid('')}>
                Change
              </GhostButton>
            </div>
          ) : null}
          <label className="text-sm font-medium">
            Plan
            <select
              required
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
              value={planId}
              onChange={(e) => {
                setPlanId(e.target.value);
                const p = plans.find((x) => x.id === e.target.value);
                if (p) setAmount(String(p.price));
              }}
            >
              <option value="">Choose plan…</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.days} days · Rs {p.price}
                </option>
              ))}
            </select>
          </label>
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
              Amount (Rs)
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
            {busy ? 'Saving…' : 'Save subscription'}
          </PrimaryButton>
        </div>
        <aside className="rounded-xl border border-line bg-muted-bg/80 p-4 text-sm">
          <div className="text-xs font-semibold uppercase text-muted">Summary</div>
          {plan && summary ? (
            <dl className="mt-3 space-y-2">
              <div>
                <dt className="text-muted">Starts</dt>
                <dd className="font-medium">{formatDate(summary.startsAt)}</dd>
              </div>
              <div>
                <dt className="text-muted">Expires</dt>
                <dd className="font-semibold text-brand">{formatDate(summary.expiresAt)}</dd>
              </div>
              <div>
                <dt className="text-muted">Duration</dt>
                <dd>
                  {plan.days} + {bonus} bonus days
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-muted">Pick a plan to preview expiry.</p>
          )}
        </aside>
      </form>
    </Card>
  );
}
