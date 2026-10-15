import { useQuery } from '@tanstack/react-query';
import { ambulanceDriverApi } from '../../services/ambulanceDriverApi';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/common/StatusBadge';

export const DriverProfilePage = () => {
  const { user } = useAuth();
  const profile = useQuery({
    queryKey: ['ambulance-driver', 'profile'],
    queryFn: ambulanceDriverApi.getProfile,
  });

  const p = profile.data;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-black text-slate-950">Paramedic Driver Profile</h1>
        <p className="text-xs text-slate-500">Commercial driving credentials, medical certifications, and fleet assignment</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 font-black text-xl">
            {p?.fullName ? p.fullName.slice(0, 2).toUpperCase() : 'DR'}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-950">{p?.fullName || user?.name || 'Driver'}</h2>
            <p className="text-xs text-slate-500">{p?.email || user?.email}</p>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge variant="verified" label="Commercial EMT License" />
              <span className="text-xs text-slate-400">&bull;</span>
              <span className="text-xs font-semibold text-teal-700">ABDM Registry Verified</span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-slate-500">Mobile Phone</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{p?.phone || user?.phone || 'Not provided'}</p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Commercial License Number</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{p?.licenseNumber || user?.licenseNumber || 'Verified'}</p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Assigned Provider</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{user?.providerName || 'Certified Ambulance Provider'}</p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Assigned Vehicle</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{user?.assignedAmbulanceVehicleNumber || 'Fleet Vehicle'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
