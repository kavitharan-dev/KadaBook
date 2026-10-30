import { useMemo, useState } from 'react';
import {
  EmptyState,
  GhostButton,
  PageTitle,
  Skeleton,
  StatusBadge,
  TableWrap,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCollection } from '../hooks/useCollection';
import { mapShop } from '../lib/mappers';
import { setShopStatus } from '../lib/shopOps';
import type { ShopStatus } from '../types/models';

const TABS: (ShopStatus | 'all')[] = ['all', 'pending', 'trial', 'active', 'grace', 'expired', 'suspended', 'rejected'];

export function UsersPage() {
  const { rows, loading } = useCollection('users', mapShop);
  const [tab, setTab] = useState<(typeof TABS)[number]>('all');
  const [q, setQ] = useState('');
  const { admin } = useAuth();
  const { push } = useToast();

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((s) => {
      if (tab !== 'all' && s.status !== tab) return false;
      if (!query) return true;
      return (
        s.shopName.toLowerCase().includes(query) ||
        (s.ownerName ?? '').toLowerCase().includes(query) ||
        (s.phone ?? '').includes(query)
      );
    });
  }, [rows, tab, q]);

  async function toggleSuspend(uid: string, suspend: boolean) {
    if (!admin) return;
    if (!confirm(suspend ? 'Suspend this shop?' : 'Reactivate this shop?')) return;
    try {
      await setShopStatus(admin.uid, uid, suspend ? 'suspended' : 'active');
      push(suspend ? 'Shop suspended' : 'Shop reactivated');
    } catch (e) {
      push(e instanceof Error ? e.message : 'Update failed', 'error');
    }
  }

  return (
    <div>
      <PageTitle title="Users / Shops" subtitle="Search and manage merchant accounts" />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
              tab === t ? 'bg-brand text-white' : 'bg-surface border border-line text-muted'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <input
        className="mb-4 w-full max-w-md rounded-lg border border-line px-3 py-2 text-sm"
        placeholder="Search shop, owner, phone…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {loading ? (
        <Skeleton className="h-48" />
      ) : (
        <TableWrap>
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line bg-brand-soft/40 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Shop</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">District</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState message="No shops match this filter." />
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.uid} className="border-b border-line/70">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{s.shopName}</div>
                      <div className="text-xs text-muted">{s.ownerName ?? s.phone ?? s.uid}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3">{s.district ?? '—'}</td>
                    <td className="px-4 py-3">
                      {s.status === 'suspended' ? (
                        <GhostButton onClick={() => toggleSuspend(s.uid, false)}>Reactivate</GhostButton>
                      ) : (
                        <GhostButton onClick={() => toggleSuspend(s.uid, true)}>Suspend</GhostButton>
                      )}
                    </td>
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
