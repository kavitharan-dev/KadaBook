import { useMemo, useState } from 'react';
import {
  Card,
  EmptyState,
  GhostButton,
  PageTitle,
  PrimaryButton,
  Skeleton,
  TableWrap,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCollection } from '../hooks/useCollection';
import { mapPayment, mapPlan, mapShop } from '../lib/mappers';
import { recordPayment } from '../lib/shopOps';
import { formatDateTime, formatRs } from '../lib/format';

export function PaymentsPage() {
  const { rows: payments, loading: l1 } = useCollection('payments', mapPayment);
  const { rows: shops } = useCollection('users', mapShop);
  const { rows: plans } = useCollection('plans', mapPlan);
  const { admin } = useAuth();
  const { push } = useToast();
  const [form, setForm] = useState({
    uid: '',
    plan: '',
    amount: '',
    method: 'cash' as 'bank' | 'cash' | 'ezcash',
    reference: '',
  });

  const shopOptions = useMemo(() => shops.filter((s) => s.status !== 'rejected'), [shops]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!admin) return;
    const plan = plans.find((p) => p.id === form.plan || p.name === form.plan);
    const planDays = plan?.days ?? 30;
    try {
      await recordPayment(admin.uid, {
        uid: form.uid,
        plan: plan?.name ?? form.plan,
        amount: Number(form.amount),
        method: form.method,
        reference: form.reference,
        planDays,
      });
      push('Payment recorded & subscription extended');
      setForm({ uid: '', plan: '', amount: '', method: 'cash', reference: '' });
    } catch (err) {
      push(err instanceof Error ? err.message : 'Save failed', 'error');
    }
  }

  function exportCsv() {
    const header = 'id,uid,plan,amount,method,paidAt\n';
    const body = payments
      .map((p) => `${p.id},${p.uid},${p.plan},${p.amount},${p.method},${new Date(p.paidAt).toISOString()}`)
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kadabook-payments.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageTitle title="Payments" subtitle="Record payments and export CSV" />
      <Card className="mb-6">
        <h2 className="text-base font-semibold">Record a payment</h2>
        <form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-2">
          <select
            required
            className="rounded-lg border border-line px-3 py-2 text-sm"
            value={form.uid}
            onChange={(e) => setForm((f) => ({ ...f, uid: e.target.value }))}
          >
            <option value="">Select shop</option>
            {shopOptions.map((s) => (
              <option key={s.uid} value={s.uid}>
                {s.shopName}
              </option>
            ))}
          </select>
          <select
            required
            className="rounded-lg border border-line px-3 py-2 text-sm"
            value={form.plan}
            onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
          >
            <option value="">Plan</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatRs(p.price)} / {p.days}d
              </option>
            ))}
          </select>
          <input
            required
            type="number"
            placeholder="Amount (Rs)"
            className="rounded-lg border border-line px-3 py-2 text-sm"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          />
          <select
            className="rounded-lg border border-line px-3 py-2 text-sm"
            value={form.method}
            onChange={(e) => setForm((f) => ({ ...f, method: e.target.value as typeof f.method }))}
          >
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="ezcash">eZ Cash</option>
          </select>
          <input
            className="md:col-span-2 rounded-lg border border-line px-3 py-2 text-sm"
            placeholder="Reference / receipt no."
            value={form.reference}
            onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
          />
          <PrimaryButton type="submit">Save payment</PrimaryButton>
        </form>
      </Card>
      <div className="mb-3 flex justify-end">
        <GhostButton onClick={exportCsv}>Export CSV</GhostButton>
      </div>
      {l1 ? (
        <Skeleton className="h-40" />
      ) : (
        <TableWrap>
          <table className="min-w-full text-sm">
            <thead className="border-b border-line bg-brand-soft/40 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Shop</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Paid</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState message="No payments recorded." />
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="border-b border-line/70">
                    <td className="px-4 py-3">{shops.find((s) => s.uid === p.uid)?.shopName ?? p.uid}</td>
                    <td className="px-4 py-3">{p.plan}</td>
                    <td className="px-4 py-3">{formatRs(p.amount)}</td>
                    <td className="px-4 py-3 capitalize">{p.method}</td>
                    <td className="px-4 py-3">{formatDateTime(p.paidAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}
