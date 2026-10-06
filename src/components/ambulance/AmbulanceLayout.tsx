import type { ReactNode } from 'react';
import { Ambulance as AmbulanceIcon } from 'lucide-react';

export const AmbulanceLayout = ({ children }: { children: ReactNode }) => (
  <div className="resq-reduced-motion min-h-screen bg-slate-50 text-slate-900 antialiased">
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white"><AmbulanceIcon className="h-5 w-5" /></div><div><p className="text-sm font-semibold">ResQ Ambulance</p><p className="text-[11px] text-slate-500">Driver interface</p></div></div>
        <span className="text-[11px] font-medium text-slate-400">Mock mode</span>
      </div>
    </header>
    <div className="mx-auto flex min-h-[calc(100vh-61px)] w-full max-w-5xl flex-col">{children}</div>
  </div>
);
