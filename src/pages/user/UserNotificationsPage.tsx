import { Bell, Check, Clock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../../services/userApi';
import { Button } from '../../components/common/Button';

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
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950">Care & Appointment Notifications</h1>
          <p className="text-xs text-slate-500">Real-time status updates from hospitals, clinics, and emergency dispatches</p>
        </div>

        {notifications.data?.unreadCount ? (
          <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
            {notifications.data.unreadCount} Unread
          </span>
        ) : null}
      </div>

      {notifications.isLoading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading notifications…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
            <Bell className="h-6 w-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">No Notifications</h2>
          <p className="text-xs text-slate-500 mt-1">You are all caught up! Updates regarding emergency triage and clinic bookings will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((notif) => (
            <div
              key={notif.id}
              className={`rounded-2xl border p-4 sm:p-5 transition shadow-xs flex items-start justify-between gap-4 ${
                notif.status === 'UNREAD'
                  ? 'border-teal-200 bg-teal-50/40'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl shrink-0 ${
                    notif.status === 'UNREAD'
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-950">{notif.title}</h3>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">{notif.message}</p>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(notif.createdAt).toLocaleDateString()} at {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="font-semibold text-teal-800">{notif.type.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </div>

              {notif.status === 'UNREAD' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => markRead.mutate(notif.id)}
                  disabled={markRead.isPending}
                  icon={<Check className="h-3.5 w-3.5" />}
                  className="shrink-0 text-xs"
                >
                  Mark read
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
