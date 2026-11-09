import { useQuery } from '@tanstack/react-query';
import { ambulanceDriverApi } from '../../services/ambulanceDriverApi';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, Phone, FileText, Truck, Building2, UserCheck } from 'lucide-react';

export const DriverProfilePage = () => {
  const { user } = useAuth();
  const profile = useQuery({
    queryKey: ['ambulance-driver', 'profile'],
    queryFn: ambulanceDriverApi.getProfile,
  });

  const p = profile.data;
  const fullName = p?.fullName || user?.name || 'Rajesh Sharma';
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'DR';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6 font-sans">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono mb-2">
          <UserCheck className="h-3.5 w-3.5" />
          <span>Paramedic Identity & Accreditation</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-light text-zinc-100 tracking-tight">Paramedic Driver Profile</h1>
        <p className="text-xs md:text-sm text-zinc-400 mt-1">
          Authoritative credentials, commercial emergency transport license, and fleet registry verification.
        </p>
      </div>

      {/* Credentials Card */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
        {/* Avatar and Identity */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="bg-rose-500/10 text-rose-300 border border-rose-500/20 text-xl font-bold p-5 rounded-2xl inline-flex items-center justify-center shrink-0 w-16 h-16 shadow-lg shadow-rose-950/40">
            {initials}
          </div>
          <div className="space-y-1.5 flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-zinc-100 tracking-tight truncate">{fullName}</h2>
            <p className="text-xs font-mono text-zinc-400 truncate">{p?.email || user?.email || 'driver@resq.ambulance'}</p>
            
            {/* Verification Badges */}
            <div className="pt-2 flex flex-wrap items-center gap-2.5">
              <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-mono flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Commercial EMT License
              </span>
              <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-mono flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                ABDM Registry Verified
              </span>
            </div>
          </div>
        </div>

        {/* 2-Column Key-Value Grid */}
        <div className="border-t border-white/10 pt-6 grid gap-4 sm:grid-cols-2">
          <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] flex items-start gap-3">
            <div className="p-2 rounded-lg bg-white/[0.04] text-zinc-400">
              <Phone className="h-4 w-4" />
            </div>
            <div>
              <p className="text-zinc-400 text-xs font-mono">Mobile Contact</p>
              <p className="mt-1 text-zinc-100 font-medium text-sm">{p?.phone || user?.phone || '+91 98765 43210'}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] flex items-start gap-3">
            <div className="p-2 rounded-lg bg-white/[0.04] text-zinc-400">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <p className="text-zinc-400 text-xs font-mono">Commercial License Number</p>
              <p className="mt-1 text-zinc-100 font-medium text-sm font-mono">{p?.licenseNumber || user?.licenseNumber || 'RJ-14-2022-EMT-8891'}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] flex items-start gap-3">
            <div className="p-2 rounded-lg bg-white/[0.04] text-zinc-400">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-zinc-400 text-xs font-mono">Assigned Provider</p>
              <p className="mt-1 text-zinc-100 font-medium text-sm">{user?.providerName || 'Jaipur Emergency Fleet Services'}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] flex items-start gap-3">
            <div className="p-2 rounded-lg bg-white/[0.04] text-zinc-400">
              <Truck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-zinc-400 text-xs font-mono">Assigned Vehicle Registration</p>
              <p className="mt-1 text-rose-300 font-medium text-sm font-mono">{user?.assignedAmbulanceVehicleNumber || 'RJ-14-EA-1001'}</p>
            </div>
          </div>
        </div>

        {/* Security & Registry Notice */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-3 text-xs text-zinc-400">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>All paramedic telemetry and verification records are synced with ResQ National Health Dispatch Registry.</span>
        </div>
      </div>
    </div>
  );
};
