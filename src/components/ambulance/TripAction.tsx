import { Button } from '../common/Button';
import type { ReactNode } from 'react';

export const TripAction = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
  <div className="sticky bottom-0 mt-auto border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm sm:px-6"><Button type="button" size="lg" fullWidth onClick={onClick} className="min-h-14 text-base font-semibold">{children}</Button></div>
);
