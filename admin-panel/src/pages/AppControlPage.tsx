import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { Card, PageTitle, PrimaryButton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getDb } from '../lib/firebase';
import { saveAppConfig } from '../lib/shopOps';
import { DEFAULT_APP_CONFIG, type AppConfig } from '../types/models';

export function AppControlPage() {
  const [cfg, setCfg] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [loading, setLoading] = useState(true);
  const { admin } = useAuth();
  const { push } = useToast();

  useEffect(() => {
    return onSnapshot(doc(getDb(), 'appConfig', 'main'), (snap) => {
      if (snap.exists()) {
        setCfg({ ...DEFAULT_APP_CONFIG, ...snap.data(), features: { ...DEFAULT_APP_CONFIG.features, ...snap.data().features } });
      }
      setLoading(false);
    });
  }, []);

  async function save() {
    if (!admin) return;
    try {
      await saveAppConfig(admin.uid, cfg);
      push('App settings saved');
    } catch (e) {
      push(e instanceof Error ? e.message : 'Save failed', 'error');
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading settings…</p>;

  return (
    <div>
      <PageTitle title="App Control" subtitle="Maintenance, versions, features, trial & grace" />
      <Card className="grid max-w-2xl gap-4">
        <label className="flex items-center justify-between text-sm">
          Maintenance mode
          <input type="checkbox" checked={cfg.maintenance} onChange={(e) => setCfg({ ...cfg, maintenance: e.target.checked })} />
        </label>
        <label className="text-sm">
          Minimum app version
          <input
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            value={cfg.minVersion}
            onChange={(e) => setCfg({ ...cfg, minVersion: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Trial days
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            value={cfg.trialDays}
            onChange={(e) => setCfg({ ...cfg, trialDays: Number(e.target.value) })}
          />
        </label>
        <label className="text-sm">
          Grace days
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            value={cfg.graceDays}
            onChange={(e) => setCfg({ ...cfg, graceDays: Number(e.target.value) })}
          />
        </label>
        <label className="text-sm">
          Renewal WhatsApp
          <input
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            value={cfg.renewWhatsApp}
            onChange={(e) => setCfg({ ...cfg, renewWhatsApp: e.target.value })}
          />
        </label>
        <div className="grid gap-2 text-sm">
          {(['tamil', 'sinhala', 'reportExport', 'signupsOpen'] as const).map((key) => (
            <label key={key} className="flex justify-between capitalize">
              {key.replace(/([A-Z])/g, ' $1')}
              <input
                type="checkbox"
                checked={cfg.features[key]}
                onChange={(e) =>
                  setCfg({ ...cfg, features: { ...cfg.features, [key]: e.target.checked } })
                }
              />
            </label>
          ))}
        </div>
        <PrimaryButton onClick={save}>Save settings</PrimaryButton>
      </Card>
    </div>
  );
}
