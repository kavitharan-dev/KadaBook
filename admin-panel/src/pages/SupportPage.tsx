import { useState } from 'react';
import { arrayUnion, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Card, EmptyState, GhostButton, PageTitle, PrimaryButton, Skeleton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCollection } from '../hooks/useCollection';
import { writeAuditLog } from '../lib/audit';
import { getDb } from '../lib/firebase';
import { mapTicket } from '../lib/mappers';

export function SupportPage() {
  const { rows, loading } = useCollection('tickets', mapTicket);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const { admin } = useAuth();
  const { push } = useToast();

  async function sendReply(id: string) {
    if (!admin || !reply.trim()) return;
    await updateDoc(doc(getDb(), 'tickets', id), {
      messages: arrayUnion({
        from: 'admin',
        text: reply.trim(),
        at: Date.now(),
        adminId: admin.uid,
      }),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog({ adminId: admin.uid, action: 'ticket_reply', details: id });
    setReply('');
    push('Reply sent');
  }

  async function resolve(id: string) {
    if (!admin) return;
    await updateDoc(doc(getDb(), 'tickets', id), { status: 'resolved', updatedAt: serverTimestamp() });
    await writeAuditLog({ adminId: admin.uid, action: 'ticket_resolved', details: id });
    push('Ticket resolved');
  }

  return (
    <div>
      <PageTitle title="Support" subtitle="Shop tickets and replies" />
      {loading ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <EmptyState message="No support tickets." />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((t) => (
            <Card key={t.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{t.subject}</div>
                  <div className="text-xs text-muted">
                    {t.uid} · {t.status} · {t.messages.length} message(s)
                  </div>
                </div>
                <div className="flex gap-2">
                  <GhostButton onClick={() => setOpenId(openId === t.id ? null : t.id)}>Open</GhostButton>
                  {t.status === 'open' ? <PrimaryButton onClick={() => resolve(t.id)}>Resolve</PrimaryButton> : null}
                </div>
              </div>
              {openId === t.id ? (
                <div className="mt-3 border-t border-line pt-3 text-sm">
                  {t.messages.map((m, i) => (
                    <p key={i} className="mb-2 rounded-lg bg-muted-bg px-3 py-2">
                      <strong>{m.from}</strong>: {m.text}
                    </p>
                  ))}
                  <textarea
                    className="w-full rounded-lg border border-line px-3 py-2"
                    placeholder="Reply…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                  <PrimaryButton className="mt-2" onClick={() => sendReply(t.id)}>
                    Send reply
                  </PrimaryButton>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
