import { useMemo, useState } from 'react';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Card, EmptyState, GhostButton, PageTitle, PrimaryButton, Skeleton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCollection } from '../hooks/useCollection';
import { writeAuditLog } from '../lib/audit';
import { getDb } from '../lib/firebase';
import { mapAnnouncement } from '../lib/mappers';

const AUDIENCES = ['all', 'trial', 'active', 'grace', 'expiring', 'expired', 'pending'] as const;

const PROMOTION = {
  titleEn: 'KadaBook offer',
  titleTa: 'KadaBook சலுகை',
  messageEn:
    'Monthly plan Rs 600, or Quarterly Rs 1,600. Keep sales, expenses, and reports in one app. Message us on WhatsApp to start or renew.',
  messageTa:
    'மாதாந்திர திட்டம் ரூ. 600, அல்லது 3 மாதம் ரூ. 1,600. விற்பனை, செலவு, அறிக்கை ஒரே செயலியில். தொடங்க அல்லது புதுப்பிக்க WhatsApp-ல் தொடர்பு கொள்ளுங்கள்.',
  type: 'popup' as const,
  audience: 'all' as const,
  showOnce: true,
  dismissible: true,
  priority: '100',
};

export function AnnouncementsPage() {
  const { rows, loading } = useCollection('announcements', mapAnnouncement);
  const { admin } = useAuth();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{
    titleEn: string;
    titleTa: string;
    messageEn: string;
    messageTa: string;
    type: 'banner' | 'popup';
    audience: (typeof AUDIENCES)[number];
    startAt: string;
    endAt: string;
    showOnce: boolean;
    dismissible: boolean;
    priority: string;
  }>({
    ...PROMOTION,
    startAt: new Date().toISOString().slice(0, 16),
    endAt: '',
  });

  const preview = useMemo(
    () => ({
      title: form.titleEn || 'Title',
      message: form.messageEn || 'Message preview',
    }),
    [form.titleEn, form.messageEn],
  );

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!admin || busy) return;
    setBusy(true);
    try {
      const startAt = new Date(form.startAt).getTime();
      const endAt = form.endAt ? new Date(form.endAt).getTime() : null;
      await addDoc(collection(getDb(), 'announcements'), {
        titleEn: form.titleEn.trim(),
        titleTa: form.titleTa.trim(),
        messageEn: form.messageEn.trim(),
        messageTa: form.messageTa.trim(),
        type: form.type,
        audience: form.audience,
        active: true,
        startAt,
        endAt,
        showOnce: form.showOnce,
        dismissible: form.dismissible,
        priority: Number(form.priority) || 0,
        viewCount: 0,
        dismissCount: 0,
        createdAt: serverTimestamp(),
      });
      await writeAuditLog({ adminId: admin.uid, action: 'create_announcement', details: form.titleEn });
      push('Announcement created');
      setForm((f) => ({ ...f, titleEn: '', titleTa: '', messageEn: '', messageTa: '' }));
    } catch (err) {
      push(err instanceof Error ? err.message : 'Create failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function publishPromotion() {
    if (!admin || busy) return;
    setBusy(true);
    try {
      const end = new Date();
      end.setDate(end.getDate() + 30);
      await addDoc(collection(getDb(), 'announcements'), {
        ...PROMOTION,
        priority: 100,
        active: true,
        startAt: Date.now(),
        endAt: end.getTime(),
        viewCount: 0,
        dismissCount: 0,
        createdAt: serverTimestamp(),
      });
      await writeAuditLog({ adminId: admin.uid, action: 'create_announcement', details: PROMOTION.titleEn });
      push('Promotion popup is live for 30 days');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Create failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, active: boolean) {
    if (!admin) return;
    await updateDoc(doc(getDb(), 'announcements', id), { active: !active });
    await writeAuditLog({ adminId: admin.uid, action: 'toggle_announcement', details: `${id} → ${!active}` });
  }

  return (
    <div>
      <PageTitle title="Announcements" subtitle="Banner & popup — Tamil / English, audience & schedule" />
      <Card className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-semibold">Promotion popup</div>
          <p className="text-sm text-muted">
            {PROMOTION.titleEn} — Monthly Rs 600 / Quarterly Rs 1,600. Shows once on app open, English or Tamil.
          </p>
        </div>
        <PrimaryButton type="button" disabled={busy} onClick={publishPromotion}>
          {busy ? 'Publishing…' : 'Publish promotion popup'}
        </PrimaryButton>
      </Card>
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <Card>
          <form onSubmit={create} className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                required
                className="rounded-lg border border-line px-3 py-2 text-sm"
                placeholder="Title (English)"
                value={form.titleEn}
                onChange={(e) => setForm((f) => ({ ...f, titleEn: e.target.value }))}
              />
              <input
                className="rounded-lg border border-line px-3 py-2 text-sm"
                placeholder="Title (Tamil)"
                value={form.titleTa}
                onChange={(e) => setForm((f) => ({ ...f, titleTa: e.target.value }))}
              />
            </div>
            <textarea
              required
              className="min-h-[60px] rounded-lg border border-line px-3 py-2 text-sm"
              placeholder="Message (English)"
              value={form.messageEn}
              onChange={(e) => setForm((f) => ({ ...f, messageEn: e.target.value }))}
            />
            <textarea
              className="min-h-[60px] rounded-lg border border-line px-3 py-2 text-sm"
              placeholder="Message (Tamil)"
              value={form.messageTa}
              onChange={(e) => setForm((f) => ({ ...f, messageTa: e.target.value }))}
            />
            <div className="flex flex-wrap gap-3">
              <select
                className="rounded-lg border border-line px-3 py-2 text-sm"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'banner' | 'popup' }))}
              >
                <option value="banner">Banner</option>
                <option value="popup">Popup</option>
              </select>
              <select
                className="rounded-lg border border-line px-3 py-2 text-sm"
                value={form.audience}
                onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value as typeof form.audience }))}
              >
                {AUDIENCES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.showOnce}
                  onChange={(e) => setForm((f) => ({ ...f, showOnce: e.target.checked }))}
                />
                Show once
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.dismissible}
                  onChange={(e) => setForm((f) => ({ ...f, dismissible: e.target.checked }))}
                />
                Dismissible
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="text-sm">
                Start
                <input
                  type="datetime-local"
                  className="ml-2 rounded-lg border border-line px-2 py-1.5 text-sm"
                  value={form.startAt}
                  onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                End (optional)
                <input
                  type="datetime-local"
                  className="ml-2 rounded-lg border border-line px-2 py-1.5 text-sm"
                  value={form.endAt}
                  onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                Priority
                <input
                  className="ml-2 w-16 rounded-lg border border-line px-2 py-1.5 text-sm"
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                />
              </label>
            </div>
            <PrimaryButton type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create'}
            </PrimaryButton>
          </form>
        </Card>
        <div className="flex flex-col items-center gap-2">
          <div className="text-xs font-semibold uppercase text-muted">Phone preview</div>
          <div className="relative h-[420px] w-[220px] rounded-[28px] border-4 border-ink/80 bg-white shadow-xl">
            <div className="absolute inset-x-3 top-3 h-6 rounded-full bg-ink/10" />
            {form.type === 'banner' ? (
              <div className="absolute inset-x-2 top-12 rounded-lg bg-brand px-2 py-2 text-[10px] font-semibold text-white">
                {preview.title}: {preview.message.slice(0, 40)}
              </div>
            ) : (
              <div className="absolute inset-4 top-24 rounded-xl border border-line bg-white p-3 shadow-lg">
                <div className="text-[11px] font-bold">{preview.title}</div>
                <div className="mt-1 text-[10px] text-muted">{preview.message}</div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-8">
        {loading ? (
          <Skeleton className="h-32" />
        ) : rows.length === 0 ? (
          <EmptyState message="No announcements yet." />
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((a) => (
              <Card key={a.id} className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-semibold">{a.titleEn || a.title}</div>
                  <div className="text-sm text-muted">{a.messageEn || a.message}</div>
                  <div className="text-xs text-muted">
                    {a.type} · {a.audience} · {a.active ? 'Live' : 'Off'} · views {a.viewCount ?? 0} · dismiss{' '}
                    {a.dismissCount ?? 0}
                  </div>
                </div>
                <GhostButton onClick={() => toggle(a.id, a.active)}>{a.active ? 'Turn off' : 'Go live'}</GhostButton>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
