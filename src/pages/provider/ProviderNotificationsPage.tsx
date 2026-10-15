import { Bell } from 'lucide-react';

export const ProviderNotificationsPage = () => {
  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-black text-slate-950">Provider Operational Notifications</h1>
        <p className="text-xs text-slate-500">Fleet dispatches, driver duty status alerts, and state emergency broadcasts</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3">
          <Bell className="h-6 w-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900">No Pending Fleet Alerts</h2>
        <p className="text-xs text-slate-500 mt-1">All ambulances are operating normally within designated geographic service polygons.</p>
      </div>
    </div>
  );
};
