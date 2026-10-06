import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const AmbulanceProviderDashboardPage = () => {
  const { user } = useAuth();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Ambulance provider</p>
            <h1 className="text-2xl font-bold text-slate-950">Operations workspace</h1>
          </div>
          <span className="text-sm text-slate-500">{user?.email}</span>
        </div>
        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account status</p><p className="mt-2 text-lg font-bold text-slate-950">{user?.accountStatus}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</p><p className="mt-2 text-lg font-bold text-slate-950">{user?.role}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fleet APIs</p><p className="mt-2 text-lg font-bold text-slate-950">Coming next</p></div>
        </section>
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-950">Provider authentication is ready</h2>
          <p className="mt-1 text-sm text-slate-600">Operational fleet management will connect here in a separate backend feature.</p>
          <Link to="/login" className="mt-5 inline-flex h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">Back to sign in</Link>
        </section>
      </div>
    </main>
  );
};
