import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  FileSpreadsheet,
  Package,
  Pencil,
  Receipt,
  ShoppingCart,
  Smartphone,
  Store,
  Wallet,
} from 'lucide-react';
import { Card, PageTitle, PrimaryButton, Skeleton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCollection } from '../hooks/useCollection';
import {
  ACCESS_FEATURES,
  ACCESS_STATUSES,
  DEFAULT_ACCESS_MATRIX,
  mergeAccessMatrix,
  type AccessFeature,
  type AccessMatrix,
} from '../lib/accessMatrix';
import { getDb } from '../lib/firebase';
import { mapShop } from '../lib/mappers';
import { saveAccessMatrix, setShopFeatureOverride } from '../lib/shopOps';

const FEATURE_META: Record<
  AccessFeature,
  { label: string; hint: string; Icon: typeof Smartphone }
> = {
  useApp: { label: 'Open app', hint: 'Can sign in', Icon: Smartphone },
  viewReports: { label: 'Reports', hint: 'Day / month', Icon: Receipt },
  addSale: { label: 'New sale', hint: 'Quick / bill', Icon: ShoppingCart },
  addExpense: { label: 'Expenses', hint: 'Add spend', Icon: Wallet },
  manageProducts: { label: 'Products', hint: 'Catalog', Icon: Package },
  exportData: { label: 'Excel', hint: 'Export / print', Icon: FileSpreadsheet },
  editProfile: { label: 'Profile', hint: 'Shop edit', Icon: Pencil },
};

/**
 * Status gates (trial / active / expired…) — NOT Basic/Standard plan ticks.
 * Plan features live under Manage Shops.
 */
export function AccessControlPage() {
  const { admin } = useAuth();
  const { push } = useToast();
  const { rows: shops } = useCollection('users', mapShop);
  const [matrix, setMatrix] = useState<AccessMatrix>(DEFAULT_ACCESS_MATRIX);
  const [loading, setLoading] = useState(true);
  const [savedFlash, setSavedFlash] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [overrideUid, setOverrideUid] = useState('');
  const [overrideFeature, setOverrideFeature] = useState<AccessFeature>('addSale');
  const [overrideReason, setOverrideReason] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(doc(getDb(), 'appConfig', 'access'), (snap) => {
      const raw = snap.data()?.matrix as Partial<AccessMatrix> | undefined;
      setMatrix(mergeAccessMatrix(raw));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const scheduleSave = useCallback(
    (next: AccessMatrix) => {
      if (!admin) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await saveAccessMatrix(admin.uid, next);
          setSavedFlash(true);
          setTimeout(() => setSavedFlash(false), 2000);
        } catch (e) {
          push(e instanceof Error ? e.message : 'Save failed', 'error');
        }
      }, 600);
    },
    [admin, push],
  );

  function toggle(status: (typeof ACCESS_STATUSES)[number], feature: AccessFeature) {
    const next: AccessMatrix = {
      ...matrix,
      [status]: { ...matrix[status], [feature]: !matrix[status][feature] },
    };
    setMatrix(next);
    scheduleSave(next);
  }

  async function addOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!admin || !overrideUid.trim()) return;
    try {
      await setShopFeatureOverride(
        admin.uid,
        overrideUid.trim(),
        overrideFeature,
        false,
        overrideReason || 'Admin block',
      );
      push('Override saved');
      setOverrideReason('');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Override failed', 'error');
    }
  }

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          title="Access by status"
          subtitle="What a shop can do while trial / active / expired / suspended — not Basic vs Standard."
        />
        {savedFlash ? <span className="text-sm font-bold text-sale">Saved</span> : null}
      </div>

      <Card className="mb-4 border-brand/20 bg-brand-soft text-sm text-ink">
        <p className="font-semibold text-brand">Two different controls</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-[13px]">
          <li>
            <strong>This page</strong> = subscription <em>status</em> gates (can they open sale / reports?).
          </li>
          <li>
            <strong>Basic / Standard + feature ticks</strong> ={' '}
            <Link to="/users" className="font-bold text-brand underline">
              Manage Shops
            </Link>{' '}
            → click shop → Save. (Also Plans / Features / Subscriptions.)
          </li>
        </ul>
      </Card>

      <Card className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="sticky left-0 bg-surface px-3 py-3 font-bold uppercase tracking-wide">Status</th>
              {ACCESS_FEATURES.map((f) => {
                const meta = FEATURE_META[f];
                const Icon = meta.Icon;
                return (
                  <th key={f} className="min-w-[88px] px-2 py-3 text-center">
                    <div className="mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
                      <Icon className="h-4 w-4" strokeWidth={2.25} />
                    </div>
                    <div className="font-bold text-ink">{meta.label}</div>
                    <div className="text-[10px] font-medium normal-case">{meta.hint}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ACCESS_STATUSES.map((status) => (
              <tr key={status} className="border-b border-line/60 hover:bg-brand-soft/40">
                <td className="sticky left-0 bg-surface px-3 py-3 font-bold capitalize text-ink">{status}</td>
                {ACCESS_FEATURES.map((feature) => (
                  <td key={feature} className="px-2 py-3 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand"
                      checked={matrix[status][feature]}
                      onChange={() => toggle(status, feature)}
                      aria-label={`${status} ${feature}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="mt-6">
        <div className="mb-1 flex items-center gap-2">
          <Store className="h-4 w-4 text-brand" />
          <h3 className="text-sm font-bold text-ink">Block one feature for one shop</h3>
        </div>
        <p className="text-xs text-muted">Emergency override (status matrix still applies).</p>
        <form onSubmit={addOverride} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold">
            Shop
            <select
              className="mt-1 block min-w-[200px] rounded-2xl border border-line px-3 py-2 text-sm"
              value={overrideUid}
              onChange={(e) => setOverrideUid(e.target.value)}
            >
              <option value="">Select…</option>
              {shops.map((s) => (
                <option key={s.uid} value={s.uid}>
                  {s.shopName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Feature
            <select
              className="mt-1 block rounded-2xl border border-line px-3 py-2 text-sm"
              value={overrideFeature}
              onChange={(e) => setOverrideFeature(e.target.value as AccessFeature)}
            >
              {ACCESS_FEATURES.map((f) => (
                <option key={f} value={f}>
                  {FEATURE_META[f].label}
                </option>
              ))}
            </select>
          </label>
          <input
            className="min-w-[180px] flex-1 rounded-2xl border border-line px-3 py-2 text-sm"
            placeholder="Reason"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
          />
          <PrimaryButton type="submit">Block feature</PrimaryButton>
        </form>
      </Card>
    </div>
  );
}
