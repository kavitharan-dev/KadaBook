import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
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

const FEATURE_LABELS: Record<AccessFeature, string> = {
  useApp: 'Use app',
  viewReports: 'View reports',
  addSale: 'New sale',
  addExpense: 'Add expense',
  manageProducts: 'Products',
  exportData: 'Export / print',
  editProfile: 'Edit profile',
};

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
      await setShopFeatureOverride(admin.uid, overrideUid.trim(), overrideFeature, false, overrideReason || 'Admin block');
      push('Override saved');
      setOverrideReason('');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Override failed', 'error');
    }
  }

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <PageTitle title="Access control" subtitle="Feature matrix per shop status (enforced in Firestore rules)" />
        {savedFlash ? <span className="text-sm font-semibold text-green-600">Saved</span> : null}
      </div>
      <Card className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase text-muted">
              <th className="px-3 py-2">Status</th>
              {ACCESS_FEATURES.map((f) => (
                <th key={f} className="px-2 py-2">
                  {FEATURE_LABELS[f]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ACCESS_STATUSES.map((status) => (
              <tr key={status} className="border-b border-line/60">
                <td className="px-3 py-2 font-medium capitalize">{status}</td>
                {ACCESS_FEATURES.map((feature) => (
                  <td key={feature} className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
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
        <h3 className="text-sm font-semibold">Block one feature for one shop</h3>
        <form onSubmit={addOverride} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            Shop
            <select
              className="mt-1 block min-w-[200px] rounded-lg border border-line px-3 py-2 text-sm"
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
          <label className="text-sm">
            Feature
            <select
              className="mt-1 block rounded-lg border border-line px-3 py-2 text-sm"
              value={overrideFeature}
              onChange={(e) => setOverrideFeature(e.target.value as AccessFeature)}
            >
              {ACCESS_FEATURES.map((f) => (
                <option key={f} value={f}>
                  {FEATURE_LABELS[f]}
                </option>
              ))}
            </select>
          </label>
          <input
            className="min-w-[180px] flex-1 rounded-lg border border-line px-3 py-2 text-sm"
            placeholder="Reason (shown to admins)"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
          />
          <PrimaryButton type="submit">Block feature</PrimaryButton>
        </form>
        <p className="mt-2 text-xs text-muted">Sets users/&#123;uid&#125;.overrides.feature = false. Clear overrides in Firestore or Users page if needed.</p>
      </Card>
    </div>
  );
}
