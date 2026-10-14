import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, User, Calendar, ArrowRight, Activity } from 'lucide-react';
import { Button } from '../components/common/Button';
import { useCancelEmergency, useUpdateUserProfile, useUserEmergencies, useUserProfile } from '../hooks/useUser';
import type { UserProfile } from '../services/userApi';

const initialForm = (p: UserProfile) => ({
  name: p.name,
  phone: p.phone ?? '',
  address: p.address ?? '',
  city: p.city ?? '',
  state: p.state ?? '',
  country: p.country ?? '',
  latitude: p.latitude?.toString() ?? '',
  longitude: p.longitude?.toString() ?? '',
});

const ProfileForm = ({ profile, update }: { profile: UserProfile; update: ReturnType<typeof useUpdateUserProfile> }) => {
  const [form, setForm] = useState(() => initialForm(profile));
  const set = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Parameters<typeof update.mutate>[0] = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      country: form.country.trim(),
      ...(form.latitude !== '' ? { latitude: Number(form.latitude) } : {}),
      ...(form.longitude !== '' ? { longitude: Number(form.longitude) } : {}),
    };
    update.mutate(payload);
  };

  return (
    <form onSubmit={submit} className="resq-card rounded-2xl p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
        <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200/70 text-teal-700 flex items-center justify-center font-bold text-lg">
          {profile.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="font-bold text-slate-900 text-base">{profile.name}</h2>
          <p className="text-xs text-slate-500">{profile.email}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(['name', 'phone', 'address', 'city', 'state', 'country', 'latitude', 'longitude'] as const).map((field) => (
          <label key={field} className="text-xs font-semibold text-slate-700 capitalize block space-y-1">
            <span>{field === 'latitude' ? 'Latitude (GPS)' : field === 'longitude' ? 'Longitude (GPS)' : field}</span>
            <input
              value={form[field]}
              onChange={(e) => set(field, e.target.value)}
              type={field === 'latitude' || field === 'longitude' ? 'number' : 'text'}
              step={field === 'latitude' || field === 'longitude' ? 'any' : undefined}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-900 outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100 transition-all font-normal"
            />
          </label>
        ))}
      </div>

      {update.isError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 font-medium">
          {update.error instanceof Error ? update.error.message : 'Profile update failed.'}
        </div>
      )}
      {update.isSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 font-medium">
          Profile updated successfully.
        </div>
      )}

      <div className="pt-2">
        <Button type="submit" variant="primary" disabled={update.isPending} className="font-bold shadow-xs">
          {update.isPending ? 'Saving changes…' : 'Save Profile Changes'}
        </Button>
      </div>
    </form>
  );
};

export const ProfilePage = () => {
  const navigate = useNavigate();
  const q = useUserProfile();
  const emergencies = useUserEmergencies({ page: 1, limit: 10 });
  const cancelEmergency = useCancelEmergency();
  const update = useUpdateUserProfile();

  if (q.isLoading) {
    return (
      <div className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-4">
        <div className="h-6 w-32 bg-slate-200 rounded animate-pulse" />
        <div className="h-64 bg-white rounded-2xl border border-slate-200 animate-pulse" />
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="p-5 rounded-2xl border border-rose-200 bg-rose-50 text-xs text-rose-800 space-y-2">
          <p className="font-semibold">Unable to load profile.</p>
          <Button size="sm" variant="secondary" onClick={() => void q.refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const profile = q.data;
  if (!profile) {
    return (
      <div className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 text-xs text-slate-600">
          Profile is unavailable.
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <header className="space-y-1.5 pb-2 border-b border-slate-200">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200/60 text-teal-800 text-[11px] font-semibold">
          <User className="w-3.5 h-3.5 text-teal-600" />
          <span>Patient Account</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
          User Profile & Emergency History
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Manage your contact information, review scheduled appointments, and monitor past emergency requests.
        </p>
      </header>

      {/* Profile Form */}
      <ProfileForm profile={profile} update={update} />

      {/* Hospital Care Requests & Appointments Navigation Card */}
      <section className="resq-card rounded-2xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>Hospital Requests & Appointments</span>
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Track scheduled consultations, reserved hospital time slots, and non-emergency responses.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/appointments')}
            icon={<ArrowRight className="w-3.5 h-3.5" />}
            iconPosition="right"
            className="shrink-0 font-semibold"
          >
            Open Appointments
          </Button>
        </div>
      </section>

      {/* Emergency History */}
      <section className="resq-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-rose-600" />
              <span>Emergency Requests History</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Authoritative history of all emergency coordination requests.</p>
          </div>
        </div>

        {emergencies.isLoading ? (
          <div className="p-6 text-center text-xs text-slate-400">Loading emergency history…</div>
        ) : emergencies.isError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center justify-between">
            <span>Unable to load emergency history.</span>
            <Button size="sm" variant="secondary" onClick={() => void emergencies.refetch()}>Retry</Button>
          </div>
        ) : !emergencies.data?.items.length ? (
          <div className="p-6 text-center text-xs text-slate-400">No emergency requests registered.</div>
        ) : (
          <div className="space-y-2.5">
            {emergencies.data.items.map((item) => {
              const isActive = ['RECEIVED', 'REVIEWING', 'PREPARING', 'AMBULANCE_COORDINATION'].includes(item.status);
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200/90 p-3.5 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/60 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">{item.requestCode}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isActive
                            ? 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse'
                            : item.status === 'RESOLVED'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {item.situationType} &bull; {new Date(item.reportedAt).toLocaleString()}
                    </p>
                  </div>

                  {isActive && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={cancelEmergency.isPending}
                        onClick={() => {
                          if (window.confirm('Cancel this active emergency request?')) {
                            cancelEmergency.mutate(item.id);
                          }
                        }}
                        className="text-rose-600 hover:bg-rose-50"
                      >
                        Cancel SOS
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Medical Notice */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-4 text-xs text-slate-600 shadow-xs flex items-start gap-2.5">
        <Shield className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Coordination Notice:</strong> ResQ is a digital healthcare coordination platform. It does not diagnose medical conditions or replace emergency municipal dispatch (112).
        </p>
      </section>
    </div>
  );
};
