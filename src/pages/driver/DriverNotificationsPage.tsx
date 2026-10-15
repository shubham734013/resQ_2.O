import { Bell } from 'lucide-react';

export const DriverNotificationsPage = () => {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-black text-slate-950">Driver Dispatch Notifications</h1>
        <p className="text-xs text-slate-500">Live emergency dispatch pings, hospital pre-alerts, and telemetry status</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-3">
          <Bell className="h-6 w-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900">No New Dispatch Alerts</h2>
        <p className="text-xs text-slate-500 mt-1">Keep your Duty toggle set to ON to receive incoming emergency call offers.</p>
      </div>
    </div>
  );
};
