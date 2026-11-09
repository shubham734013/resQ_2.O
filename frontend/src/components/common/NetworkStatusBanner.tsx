import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * Shared connectivity feedback for every operational role.
 * TanStack Query handles reconnect refetching; this banner only reports browser connectivity
 * and never implies that an API operation succeeded while offline.
 */
export const NetworkStatusBanner = () => {
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div role="alert" aria-live="assertive" className="sticky top-0 z-[100] flex items-center justify-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>You are offline. Live updates may be delayed. ResQ will refresh stale queries when the connection returns.</span>
    </div>
  );
};
