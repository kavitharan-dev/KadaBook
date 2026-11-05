import { useMemo, useState } from 'react';
import { ShopFeaturePanel } from '../components/ShopFeaturePanel';
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
import { mapShop, mapSub } from '../lib/mappers';
import { setShopStatus } from '../lib/shopOps';
import type { ShopStatus, ShopUser } from '../types/models';

/** Activated shops first — trial / active / grace. */
const ACTIVATED: ShopStatus[] = ['active', 'trial', 'grace'];
const TABS: (ShopStatus | 'activated' | 'all')[] = [
  'activated',
  'all',
  'pending',
  'trial',
  'active',
  'grace',
  'expired',
  'suspended',
  'rejected',
];

export function UsersPage() {
  const { rows, loading } = useCollection('users', mapShop);
  const { rows: subs } = useCollection('subscriptions', mapSub);
  const [tab, setTab] = useState<(typeof TABS)[number]>('activated');
  const [q, setQ] = useState('');
  const [editShop, setEditShop] = useState<ShopUser | null>(null);
  const { admin } = useAuth();
  const { push } = useToast();

  const subByUid = useMemo(() => {
    const m = new Map<string, (typeof subs)[0]>();
    for (const s of subs) m.set(s.uid, s);
    return m;
  }, [subs]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows
      .filter((s) => {
        if (tab === 'activated') {
          if (!ACTIVATED.includes(s.status)) return false;
        } else if (tab !== 'all' && s.status !== tab) return false;
        if (!query) return true;
        return (
          s.shopName.toLowerCase().includes(query) ||
          (s.ownerName ?? '').toLowerCase().includes(query) ||
          (s.phone ?? '').includes(query)
        );
      })
      .sort((a, b) => a.shopName.localeCompare(b.shopName));
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

  function featureHint(uid: string) {
    const sub = subByUid.get(uid);
    if (!sub?.featuresConfigured) return 'All ON (live)';
    return `${sub.enabledFeatures?.length ?? 0} features`;
  }

  return (
    <div>
      <PageTitle
        title="Manage Shops"
        subtitle="Activated shops listed first. Click a shop → see currently ON features (ticked). Customize + Save → app unlocks update."
      />
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
            {t === 'activated' ? 'Activated' : t}
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
            <thead className="border-b border-line bg-brand-soft text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Shop</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Features</th>
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
                  <tr key={s.uid} className="border-b border-line/70 hover:bg-brand-soft/50">
                    <td className="px-4 py-3">
                      <button type="button" className="text-left" onClick={() => setEditShop(s)}>
                        <div className="font-semibold text-brand hover:underline">{s.shopName}</div>
                        <div className="text-xs text-muted">{s.ownerName ?? s.phone ?? s.uid}</div>
                        <div className="mt-0.5 text-[11px] font-medium text-muted">Click → features</div>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-ink">{featureHint(s.uid)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <GhostButton onClick={() => setEditShop(s)}>Features</GhostButton>
                        {s.status === 'suspended' ? (
                          <GhostButton onClick={() => toggleSuspend(s.uid, false)}>Reactivate</GhostButton>
                        ) : (
                          <GhostButton onClick={() => toggleSuspend(s.uid, true)}>Suspend</GhostButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableWrap>
      )}
      {editShop ? <ShopFeaturePanel shop={editShop} onClose={() => setEditShop(null)} /> : null}
    </div>
  );
}
