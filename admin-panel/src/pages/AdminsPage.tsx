import { useState } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { Card, EmptyState, GhostButton, PageTitle, PrimaryButton, Skeleton, TableWrap } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCollection } from '../hooks/useCollection';
import { writeAuditLog } from '../lib/audit';
import { getDb } from '../lib/firebase';
import { mapAdmin } from '../lib/mappers';
import type { AdminRole } from '../types/models';

export function AdminsPage() {
  const { rows, loading } = useCollection('admins', mapAdmin);
  const { admin } = useAuth();
  const { push } = useToast();
  const [form, setForm] = useState({ uid: '', name: '', email: '', role: 'staff' as AdminRole });

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!admin) return;
    await setDoc(doc(getDb(), 'admins', form.uid.trim()), {
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      active: true,
    });
    await writeAuditLog({ adminId: admin.uid, action: 'invite_admin', details: form.email });
    push('Admin profile saved — user must exist in Firebase Auth with this UID');
    setForm({ uid: '', name: '', email: '', role: 'staff' });
  }

  async function deactivate(uid: string) {
    if (!admin) return;
    if (!confirm('Deactivate this admin?')) return;
    await updateDoc(doc(getDb(), 'admins', uid), { active: false });
    await writeAuditLog({ adminId: admin.uid, action: 'deactivate_admin', details: uid });
    push('Admin deactivated');
  }

  async function setRole(uid: string, role: AdminRole) {
    if (!admin) return;
    await updateDoc(doc(getDb(), 'admins', uid), { role });
    await writeAuditLog({ adminId: admin.uid, action: 'change_admin_role', details: `${uid} → ${role}` });
    push('Role updated');
  }

  return (
    <div>
      <PageTitle title="Admin Roles" subtitle="Invite admins (Auth user + admins doc)" />
      <Card className="mb-6">
        <form onSubmit={invite} className="grid gap-3 md:grid-cols-2">
          <input
            required
            placeholder="Firebase Auth UID"
            className="rounded-lg border border-line px-3 py-2 text-sm md:col-span-2"
            value={form.uid}
            onChange={(e) => setForm((f) => ({ ...f, uid: e.target.value }))}
          />
          <input
            required
            placeholder="Name"
            className="rounded-lg border border-line px-3 py-2 text-sm"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            required
            type="email"
            placeholder="Email"
            className="rounded-lg border border-line px-3 py-2 text-sm"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <select
            className="rounded-lg border border-line px-3 py-2 text-sm"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as AdminRole }))}
          >
            <option value="staff">Staff</option>
            <option value="super_admin">Super admin</option>
          </select>
          <PrimaryButton type="submit">Save admin</PrimaryButton>
        </form>
      </Card>
      {loading ? (
        <Skeleton className="h-32" />
      ) : (
        <TableWrap>
          <table className="min-w-full text-sm">
            <thead className="border-b border-line bg-brand-soft/40 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState message="No admins yet." />
                  </td>
                </tr>
              ) : (
                rows.map((a) => (
                  <tr key={a.uid} className="border-b border-line/70">
                    <td className="px-4 py-3">{a.name}</td>
                    <td className="px-4 py-3">{a.email}</td>
                    <td className="px-4 py-3">
                      <select
                        className="rounded border border-line px-2 py-1 text-xs"
                        value={a.role}
                        onChange={(e) => setRole(a.uid, e.target.value as AdminRole)}
                        disabled={a.uid === admin?.uid}
                      >
                        <option value="staff">Staff</option>
                        <option value="super_admin">Super admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {a.active === false ? (
                        <span className="text-muted">Inactive</span>
                      ) : (
                        <GhostButton disabled={a.uid === admin?.uid} onClick={() => deactivate(a.uid)}>
                          Deactivate
                        </GhostButton>
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
