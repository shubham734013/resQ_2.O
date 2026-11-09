import { Bell, Check, Clock, Radio } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../../services/userApi';

export const UserNotificationsPage = () => {
  const queryClient = useQueryClient();

  const notifications = useQuery({
    queryKey: ['user-notifications'],
    queryFn: () => userApi.notifications(false),
    refetchInterval: 10000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => userApi.markNotificationRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user-notifications'] });
    },
  });

  const items = notifications.data?.items ?? [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6 font-sans">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono mb-2">
            <Radio className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
            <span>Care Telemetry Pings</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-light text-zinc-100 tracking-tight">
            Care & Appointment Notifications
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Real-time status updates from hospitals, clinics, and emergency dispatches.
          </p>
        </div>

        {notifications.data?.unreadCount ? (
          <span className="text-xs font-mono font-bold text-rose-300 bg-rose-500/10 px-3.5 py-1.5 rounded-full border border-rose-500/20 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rose-400 animate-ping" />
            {notifications.data.unreadCount} Unread
          </span>
        ) : null}
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      {notifications.isLoading ? (
        <div className="py-16 text-center text-sm font-mono text-zinc-500 space-y-3">
          <div className="w-7 h-7 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Loading notification telemetry…</p>
        </div>
      ) : items.length === 0 ? (
        /* Empty State */
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center shadow-2xl space-y-6">
          <div className="bg-rose-500/10 text-rose-400 p-5 rounded-2xl border border-rose-500/20 inline-flex items-center justify-center shadow-lg shadow-rose-950/40">
            <Bell className="h-7 w-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-light text-zinc-100 tracking-tight">No Notifications</h2>
            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
              You are all caught up! Updates regarding emergency triage, paramedic transit, and clinic bookings will appear here.
            </p>
          </div>
        </div>
      ) : (
        /* Populated Notifications */
        <div className="space-y-3.5">
          {items.map((notif) => (
            <div
              key={notif.id}
              className={`bg-white/[0.03] backdrop-blur-xl rounded-2xl border p-5 transition-all shadow-xl flex items-start justify-between gap-4 ${
                notif.status === 'UNREAD'
                  ? 'border-rose-500/30 bg-rose-500/[0.03] shadow-rose-950/30'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl shrink-0 ${
                    notif.status === 'UNREAD'
                      ? 'bg-rose-500/20 border border-rose-500/30 text-rose-300'
                      : 'bg-white/[0.04] border border-white/10 text-zinc-400'
                  }`}
                >
                  <Bell className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-zinc-100">{notif.title}</h3>
                  <p className="text-xs text-zinc-300 leading-relaxed">{notif.message}</p>
                  <div className="mt-2.5 flex items-center gap-3 text-[11px] font-mono text-zinc-500 flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-zinc-500" />
                      {new Date(notif.createdAt).toLocaleDateString()} at{' '}
                      {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-zinc-600">•</span>
                    <span className="font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                      {notif.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>

              {notif.status === 'UNREAD' && (
                <button
                  type="button"
                  onClick={() => markRead.mutate(notif.id)}
                  disabled={markRead.isPending}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-mono text-zinc-300 hover:text-white transition cursor-pointer disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Mark read</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
