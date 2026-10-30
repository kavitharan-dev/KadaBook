import { useMemo, useState } from 'react';
import { EmptyState, PageTitle, Skeleton, TableWrap } from '../components/ui';
import { useCollection } from '../hooks/useCollection';
import { mapAudit } from '../lib/mappers';
import { formatDateTime } from '../lib/format';

export function AuditPage() {
  const { rows, loading } = useCollection('auditLogs', mapAudit);
  const [action, setAction] = useState('');
  const [adminFilter, setAdminFilter] = useState('');

  const filtered = useMemo(() => {
    return rows
      .filter((r) => (action ? r.action.includes(action) : true))
      .filter((r) => (adminFilter ? r.adminId.includes(adminFilter) : true))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [rows, action, adminFilter]);

  return (
    <div>
      <PageTitle title="Audit Log" subtitle="Append-only admin activity (read only)" />
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className="rounded-lg border border-line px-3 py-2 text-sm"
          placeholder="Filter action…"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />
        <input
          className="rounded-lg border border-line px-3 py-2 text-sm"
          placeholder="Filter admin id…"
          value={adminFilter}
          onChange={(e) => setAdminFilter(e.target.value)}
        />
      </div>
      {loading ? (
        <Skeleton className="h-48" />
      ) : (
        <TableWrap>
          <table className="min-w-full text-sm">
            <thead className="border-b border-line bg-brand-soft/40 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState message="No audit entries." />
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-b border-line/70">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.adminId.slice(0, 8)}…</td>
                    <td className="px-4 py-3">{r.action}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.targetUid?.slice(0, 8) ?? '—'}</td>
                    <td className="px-4 py-3 text-muted">{r.details ?? '—'}</td>
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
