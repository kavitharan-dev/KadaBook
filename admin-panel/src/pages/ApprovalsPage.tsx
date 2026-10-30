import { useState } from 'react';
import { Card, EmptyState, GhostButton, PageTitle, PrimaryButton, Skeleton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCollection } from '../hooks/useCollection';
import { mapShop } from '../lib/mappers';
import { approveShop, rejectShop } from '../lib/shopOps';
import { formatDateTime } from '../lib/format';

export function ApprovalsPage() {
  const { rows, loading } = useCollection('users', mapShop);
  const pending = rows.filter((s) => s.status === 'pending');
  const { admin } = useAuth();
  const { push } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  async function approve(uid: string) {
    if (!admin) return;
    setBusy(uid);
    try {
      await approveShop(admin.uid, uid);
      push('Shop approved — trial started');
    } catch (e) {
      push(e instanceof Error ? e.message : 'Approve failed', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function reject(uid: string) {
    if (!admin || !reason.trim()) {
      push('Enter a rejection reason', 'error');
      return;
    }
    if (!confirm('Reject this shop registration?')) return;
    setBusy(uid);
    try {
      await rejectShop(admin.uid, uid, reason);
      push('Shop rejected');
      setRejectId(null);
      setReason('');
    } catch (e) {
      push(e instanceof Error ? e.message : 'Reject failed', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageTitle title="Approvals" subtitle="Pending shop registrations — approve starts trial" />
      {loading ? (
        <Skeleton className="h-40" />
      ) : pending.length === 0 ? (
        <Card>
          <EmptyState message="No pending approvals." />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {pending.map((shop) => (
            <Card key={shop.uid} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-semibold">{shop.shopName}</div>
                <div className="text-sm text-muted">
                  {shop.ownerName ?? 'Owner'} · {shop.phone ?? shop.email ?? '—'} · {shop.district ?? '—'}
                </div>
                <div className="text-xs text-muted">Applied {formatDateTime(shop.createdAt || Date.now())}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <PrimaryButton disabled={busy === shop.uid} onClick={() => approve(shop.uid)}>
                  Approve
                </PrimaryButton>
                <GhostButton onClick={() => setRejectId(shop.uid)}>Reject</GhostButton>
              </div>
              {rejectId === shop.uid ? (
                <div className="w-full border-t border-line pt-3 md:col-span-2">
                  <input
                    className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                    placeholder="Rejection reason (required)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="mt-2 flex gap-2">
                    <PrimaryButton disabled={busy === shop.uid} onClick={() => reject(shop.uid)}>
                      Confirm reject
                    </PrimaryButton>
                    <GhostButton onClick={() => setRejectId(null)}>Cancel</GhostButton>
                  </div>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
