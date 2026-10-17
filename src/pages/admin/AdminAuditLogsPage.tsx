import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { StatusBadge } from '../../components/common/StatusBadge';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5001/api/v1';

interface AuditLogItem {
  id: string;
  actorId: string | null;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  createdAt: string;
}

const fetchAuditLogs = async (
  page: number,
  entityType: string,
  actorRole: string
): Promise<{ items: AuditLogItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
  const params = new URLSearchParams({ page: String(page), limit: '25' });
  if (entityType) params.set('entityType', entityType);
  if (actorRole) params.set('actorRole', actorRole);
  const res = await fetch(`${API_BASE}/admin/audit-logs?${params}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load audit logs');
  const data = (await res.json()) as {
    data: { items: AuditLogItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
  };
  return data.data;
};

export const AdminAuditLogsPage = () => {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const [actorRole, setActorRole] = useState('');

  const query = useQuery({
    queryKey: ['admin-audit-logs', page, entityType, actorRole],
    queryFn: () => fetchAuditLogs(page, entityType, actorRole),
  });

  const items = query.data?.items ?? [];
  const pagination = query.data?.pagination;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-950">System Audit Log</h1>
          <p className="text-xs text-slate-500">Immutable record of all governance actions and state changes across ResQ 2.0</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-xl border border-slate-200 px-3 text-xs focus:outline-none bg-white text-slate-800"
        >
          <option value="">All Entity Types</option>
          <option value="User">User</option>
          <option value="Hospital">Hospital</option>
          <option value="AmbulanceProvider">Ambulance Provider</option>
          <option value="AmbulanceDriver">Ambulance Driver</option>
          <option value="Ambulance">Ambulance</option>
          <option value="EmergencyRequest">Emergency Request</option>
        </select>
        <select
          value={actorRole}
          onChange={(e) => {
            setActorRole(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-xl border border-slate-200 px-3 text-xs focus:outline-none bg-white text-slate-800"
        >
          <option value="">All Roles</option>
          <option value="ADMIN">Admin</option>
          <option value="SYSTEM">System</option>
          <option value="HOSPITAL">Hospital</option>
          <option value="AMBULANCE_PROVIDER">Ambulance Provider</option>
        </select>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {query.isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading audit logs…
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No audit log entries found</p>
            <p className="text-xs text-slate-400 mt-1">Governance actions will appear here as they occur.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor Role</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity Type</th>
                  <th className="px-4 py-3">Entity ID</th>
                  <th className="px-4 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge variant="neutral" label={log.actorRole} />
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-800">{log.action}</td>
                    <td className="px-4 py-3 text-slate-600">{log.entityType}</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-slate-400">{log.entityId.slice(-8)}</td>
                    <td className="px-4 py-3 text-slate-500">{log.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} entries)
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                icon={<ChevronLeft className="h-3.5 w-3.5" />}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= pagination.totalPages}
                icon={<ChevronRight className="h-3.5 w-3.5" />}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
