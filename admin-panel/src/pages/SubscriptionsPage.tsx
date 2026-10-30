import { useState } from 'react';
import { AddSubscriptionPanel } from '../components/AddSubscriptionPanel';
import { Card, EmptyState, GhostButton, PageTitle, PrimaryButton, Skeleton, TableWrap } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCollection } from '../hooks/useCollection';
import { mapShop, mapSub } from '../lib/mappers';
import { extendSubscription } from '../lib/shopOps';
import { formatDate } from '../lib/format';

export function SubscriptionsPage() {
  const { rows: subs, loading: l1 } = useCollection('subscriptions', mapSub);
  const { rows: shops, loading: l2 } = useCollection('users', mapShop);
  const { admin } = useAuth();
  const { push } = useToast();
  const [days, setDays] = useState('30');

  const shopName = (uid: string) => shops.find((s) => s.uid === uid)?.shopName ?? uid;

  async function extend(uid: string, free: boolean) {
    if (!admin) return;
    const n = Number(days);
    if (!n || n <= 0) {
      push('Enter valid days', 'error');
      return;
    }
    try {
      await extendSubscription(admin.uid, uid, n, free);
      push(free ? `Added ${n} free days` : `Extended ${n} days`);
    } catch (e) {
      push(e instanceof Error ? e.message : 'Extend failed', 'error');
    }
  }

  return (
    <div>
      <AddSubscriptionPanel />
      <PageTitle title="Subscriptions" subtitle="Trial → active → grace → expired (data kept on expiry)" />
      <div className="mb-4 flex items-end gap-2">
        <label className="text-sm">
          Days to add
          <input
            className="ml-2 w-24 rounded-lg border border-line px-2 py-1.5 text-sm"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </label>
      </div>
      {l1 || l2 ? (
        <Skeleton className="h-48" />
      ) : (
        <TableWrap>
          <table className="min-w-full text-sm">
            <thead className="border-b border-line bg-brand-soft/40 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Shop</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subs.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState message="No subscriptions yet." />
                  </td>
                </tr>
              ) : (
                subs.map((s) => (
                  <tr key={s.uid} className="border-b border-line/70">
                    <td className="px-4 py-3 font-medium">{shopName(s.uid)}</td>
                    <td className="px-4 py-3">{s.plan}</td>
                    <td className="px-4 py-3 capitalize">{s.status}</td>
                    <td className="px-4 py-3">{formatDate(s.expiresAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <PrimaryButton onClick={() => extend(s.uid, false)}>Extend</PrimaryButton>
                        <GhostButton onClick={() => extend(s.uid, true)}>+ Free days</GhostButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableWrap>
      )}
      <Card className="mt-4 text-sm text-muted">
        Plans are managed under Firestore <code className="text-ink">plans/</code> (name, days, price). Payments
        page activates plans when recording a payment.
      </Card>
    </div>
  );
}
