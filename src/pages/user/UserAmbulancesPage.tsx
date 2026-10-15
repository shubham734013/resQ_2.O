import { ShieldCheck, Clock, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../routes/routePaths';

export const UserAmbulancesPage = () => {
  const fleets = [
    {
      name: 'Jaipur Central EMS - ALS Fleet',
      type: 'Advanced Life Support (ALS)',
      capabilities: ['Ventilator', 'Defibrillator', 'Critical Cardiac Monitor', 'Paramedic Crew'],
      area: 'Jaipur Metro & JL Road',
      baseWait: '4 - 8 mins',
      verified: true,
    },
    {
      name: 'Rajasthan Health State EMS - BLS Unit',
      type: 'Basic Life Support (BLS)',
      capabilities: ['Oxygen Supply', 'Spine Board', 'Trained EMT Driver'],
      area: 'Malviya Nagar & Sanganer',
      baseWait: '6 - 10 mins',
      verified: true,
    },
    {
      name: 'Apex Trauma Emergency Rapid Unit',
      type: 'Trauma & Cardiac Care Unit',
      capabilities: ['Trauma Surgeon Onboard', 'Telemetry Pre-alert', 'Portable Ultrasound'],
      area: 'Mansarovar & Tonk Road',
      baseWait: '5 - 9 mins',
      verified: true,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-950">Ambulance Fleets & Emergency Response</h1>
          <p className="text-xs text-slate-500">Certified Advanced and Basic Life Support fleets connected to the ResQ network</p>
        </div>

        <Link
          to={ROUTES.USER.EMERGENCY}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700"
        >
          <AlertTriangle className="h-4 w-4" /> Trigger Emergency SOS
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {fleets.map((fleet, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                  {fleet.type}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                  <ShieldCheck className="h-3.5 w-3.5" /> ABDM Certified
                </span>
              </div>

              <h2 className="text-base font-bold text-slate-950">{fleet.name}</h2>
              <p className="text-xs text-slate-500 mt-1">{fleet.area}</p>

              <div className="mt-4 pt-3 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-700 mb-2">Onboard Equipment:</p>
                <div className="flex flex-wrap gap-1.5">
                  {fleet.capabilities.map((cap, ci) => (
                    <span key={ci} className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Clock className="h-3.5 w-3.5 text-teal-600" />
                <span>Est. Wait: <strong>{fleet.baseWait}</strong></span>
              </div>
              <span className="text-xs font-bold text-rose-700">Dial 108 / 112</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
