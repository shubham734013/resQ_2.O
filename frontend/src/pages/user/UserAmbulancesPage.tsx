import { ShieldCheck, Clock, AlertTriangle, Ambulance, Phone, Activity } from 'lucide-react';
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
      phone: '108',
      verified: true,
    },
    {
      name: 'Rajasthan Health State EMS - BLS Unit',
      type: 'Basic Life Support (BLS)',
      capabilities: ['Oxygen Supply', 'Spine Board', 'Trained EMT Driver'],
      area: 'Malviya Nagar & Sanganer',
      baseWait: '6 - 10 mins',
      phone: '108',
      verified: true,
    },
    {
      name: 'Apex Trauma Emergency Rapid Unit',
      type: 'Trauma & Cardiac Care Unit',
      capabilities: ['Trauma Surgeon Onboard', 'Telemetry Pre-alert', 'Portable Ultrasound'],
      area: 'Mansarovar & Tonk Road',
      baseWait: '5 - 9 mins',
      phone: '112',
      verified: true,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full space-y-6 font-sans">
      {/* ── Header Banner ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono mb-2">
            <Ambulance className="h-3.5 w-3.5 text-rose-400" />
            <span>Emergency Fleet & Dispatch</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-light text-zinc-100 tracking-tight">
            Ambulance Fleet & Emergency Dispatch
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Certified Advanced and Basic Life Support fleets connected to the ResQ telemetry network.
          </p>
        </div>

        <Link
          to={ROUTES.USER.EMERGENCY}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-950/60 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shrink-0"
        >
          <AlertTriangle className="h-4 w-4 animate-pulse" />
          <span>Trigger Emergency SOS</span>
        </Link>
      </div>

      {/* ── Ambulance Cards Grid ──────────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-3">
        {fleets.map((fleet, i) => (
          <div
            key={i}
            className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 hover:bg-white/[0.05] transition-all space-y-5 shadow-2xl flex flex-col justify-between group"
          >
            <div className="space-y-4">
              {/* Badges Bar */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-300 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                  {fleet.type}
                </span>
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>ABDM Certified</span>
                </span>
              </div>

              {/* Title & Coverage */}
              <div>
                <h2 className="text-base font-semibold text-zinc-100 tracking-tight group-hover:text-rose-200 transition-colors">
                  {fleet.name}
                </h2>
                <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-rose-400/80 shrink-0" />
                  <span>{fleet.area}</span>
                </p>
              </div>

              {/* Onboard Equipment Micro-Tags */}
              <div className="pt-3 border-t border-white/5 space-y-2">
                <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Onboard Equipment:</p>
                <div className="flex flex-wrap gap-1.5">
                  {fleet.capabilities.map((cap, ci) => (
                    <span
                      key={ci}
                      className="bg-white/[0.04] text-zinc-300 border border-white/5 text-xs px-2.5 py-1 rounded-lg font-mono"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Dispatch Actions */}
            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
                <Clock className="h-3.5 w-3.5 text-rose-400" />
                <span>
                  Est. Wait: <strong className="text-zinc-200 font-semibold">{fleet.baseWait}</strong>
                </span>
              </div>

              <a
                href={`tel:${fleet.phone}`}
                className="inline-flex items-center gap-1.5 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white rounded-xl px-4 py-2 text-xs font-bold shadow-lg shadow-rose-950/40 hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
              >
                <Phone className="h-3 w-3" />
                <span>Dial {fleet.phone}</span>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
