import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Navigation,
  LayoutDashboard,
  Bell,
  User,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Radio,
  MapPin,
  History,
  FileText,
  MessageSquare,
  AlertTriangle,
  ChevronLeft,
  ShieldCheck,
  Phone,
  Clock,
  ArrowRight,
  Siren,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ambulanceDriverApi } from '../services/ambulanceDriverApi';
import { useLocationState } from '../hooks/useLocationState';
import { ROUTES } from '../routes/routePaths';

const driverNavItems = [
  { label: 'Dashboard', path: ROUTES.DRIVER.DASHBOARD, icon: LayoutDashboard },
  { label: 'Current Request', path: ROUTES.DRIVER.NAVIGATION('active'), icon: AlertTriangle },
  { label: 'Open Requests', path: ROUTES.DRIVER.ASSIGNMENTS, icon: Radio },
  { label: 'My Trips', path: ROUTES.DRIVER.TRIPS, icon: History },
  { label: 'Documents', path: ROUTES.DRIVER.PROFILE, icon: FileText },
  { label: 'Messages', path: ROUTES.DRIVER.NOTIFICATIONS, icon: MessageSquare },
  { label: 'Settings', path: ROUTES.DRIVER.SETTINGS, icon: User },
];

export const DriverLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { currentLocation, location: currentGeoLocation, isUpdating, permissionState, locationError, refreshLocation } = useLocationState();

  const driverProfile = useQuery({
    queryKey: ['ambulance-driver', 'profile'],
    queryFn: ambulanceDriverApi.getProfile,
  });

  const driverStatus = useQuery({
    queryKey: ['ambulance-driver', 'status'],
    queryFn: ambulanceDriverApi.getStatus,
    refetchInterval: 5000,
  });

  const qc = useQueryClient();
  const offers = useQuery({
    queryKey: ['ambulance-driver', 'dispatch-offers'],
    queryFn: ambulanceDriverApi.getDispatchOffers,
    refetchInterval: 2000,
    refetchOnWindowFocus: true,
  });

  const incomingOffer = offers.data?.[0] ?? null;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const chimePlayedRef = useRef<string | null>(null);

  // Play audio ping on new incoming offer
  useEffect(() => {
    if (incomingOffer && incomingOffer.dispatchJobId !== chimePlayedRef.current) {
      chimePlayedRef.current = incomingOffer.dispatchJobId;
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.35);
          gain.gain.setValueAtTime(0.25, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.35);
        }
      } catch {
        // Autoplay may be blocked before interaction
      }
    }
  }, [incomingOffer]);

  // Live countdown timer for active offer
  useEffect(() => {
    if (!incomingOffer?.deadlineAt) {
      setSecondsLeft(null);
      return;
    }
    const updateCountdown = () => {
      const diff = Math.max(0, Math.floor((new Date(incomingOffer.deadlineAt!).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [incomingOffer?.deadlineAt]);

  const acceptOffer = useMutation({
    mutationFn: (id: string) => ambulanceDriverApi.acceptDispatchOffer(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['ambulance-driver'] });
      navigate(ROUTES.DRIVER.NAVIGATION('active'));
    },
  });

  const rejectOffer = useMutation({
    mutationFn: (id: string) => ambulanceDriverApi.rejectDispatchOffer(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['ambulance-driver', 'dispatch-offers'] });
    },
  });

  const isRoleMismatch = user?.role && user.role !== 'AMBULANCE_DRIVER';

  const driverName = driverProfile.data?.fullName || user?.name || 'Rajesh Sharma';
  const isOnDuty = driverStatus.data?.isOnDuty ?? false;
  const vehicle =
    user?.assignedAmbulanceVehicleNumber ||
    driverStatus.data?.assignedAmbulance?.registrationNumber ||
    'RJ-14-EA-1001';

  const currentItem = driverNavItems.find((item) =>
    item.path === ROUTES.DRIVER.DASHBOARD
      ? location.pathname === ROUTES.DRIVER.DASHBOARD
      : location.pathname.startsWith(item.path.split('/active')[0])
  ) ?? driverNavItems[0];

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate(ROUTES.PUBLIC.LOGIN, { replace: true });
    }
  };

  const context = {
    currentLocation,
    location: currentGeoLocation,
    permissionState,
    locationError,
    refreshLocation,
    isUpdating,
  };

  const sidebarWidth = collapsed ? 'w-[76px]' : 'w-68';

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 font-sans antialiased relative selection:bg-rose-500/30 selection:text-white overflow-x-hidden">
      {/* Background texture */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.018]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Background glow */}
      <div
        className="pointer-events-none fixed top-0 right-1/4 h-96 w-96 rounded-full blur-[140px] opacity-15"
        style={{ background: 'radial-gradient(circle, #f43f5e 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none fixed bottom-1/4 left-1/3 h-96 w-96 rounded-full blur-[140px] opacity-10"
        style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }}
      />

      {/* Side menu */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden ${sidebarWidth} flex-col transition-all duration-300 lg:flex bg-zinc-950/80 border-r border-white/10 backdrop-blur-xl`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-600 to-rose-700 shadow-md shadow-rose-950/50">
              <Navigation className="h-5 w-5 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-black tracking-tight text-white leading-none">resQ</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    DRIVER
                  </span>
                </div>
                <p className="text-[10px] font-medium text-zinc-400 mt-1">Driver home</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition cursor-pointer"
            title={collapsed ? 'Show full menu' : 'Hide menu labels'}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Driver Identity Badge: Dark Glass Profile Card */}
        {!collapsed && (
          <div className="mx-3.5 my-3 rounded-2xl bg-white/[0.03] border border-white/10 p-3.5 backdrop-blur-md shadow-xl shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isOnDuty
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                    : 'bg-white/[0.05] border border-white/10 text-zinc-400'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isOnDuty ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                <span>{isOnDuty ? 'On duty' : 'Off duty'}</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-400">Jaipur Dispatch</span>
            </div>

            <p className="truncate text-xs font-bold text-white leading-snug">{driverName}</p>

            <div className="mt-2.5 pt-2 border-t border-white/[0.06] flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-lg">
                {vehicle}
              </span>
              <span className="text-[10px] font-medium text-zinc-500">Ambulance</span>
            </div>
          </div>
        )}

        {/* Navigation items */}
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-3" aria-label="Driver menu">
          {driverNavItems.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === ROUTES.DRIVER.DASHBOARD}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-rose-500/10 text-rose-300 border-l-2 border-rose-500 rounded-r-xl shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] rounded-xl'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Support Card in Sidebar */}
        {!collapsed && (
          <div className="px-3.5 py-2 shrink-0">
            <div className="rounded-2xl bg-white/[0.025] border border-white/10 p-3.5 text-center backdrop-blur-md">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <Phone className="h-3.5 w-3.5" />
                </div>
                <p className="text-xs font-bold text-white">Driver help line</p>
              </div>
              <p className="text-[10px] text-zinc-400 mb-2.5">Call for help any time</p>
              <a
                href="tel:112"
                className="inline-flex items-center justify-center gap-1.5 w-full rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 px-3 py-2 text-xs font-bold text-white shadow-md shadow-rose-950/60 transition cursor-pointer"
              >
                <span>Call 112</span>
              </a>
            </div>
          </div>
        )}

        {/* Footer info & Logout */}
        <div className="border-t border-white/10 p-3 bg-zinc-950/60 shrink-0">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-rose-400 hover:bg-white/[0.04] transition cursor-pointer"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`transition-all duration-300 ${collapsed ? 'lg:pl-[76px]' : 'lg:pl-68'} flex flex-col min-h-screen`}>
        {/* Top Header: Floating Dark Glass */}
        <header className="sticky top-0 z-20 bg-zinc-950/60 border-b border-white/10 backdrop-blur-md px-6 py-4">
          <div className="flex h-10 items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden p-2 rounded-xl text-zinc-300 hover:bg-white/[0.06] transition cursor-pointer"
                aria-label="Open or close menu"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>

              <div>
                <p className="text-[11px] text-zinc-400 font-medium flex items-center gap-1">
                  <span>Driver home</span>
                  <ChevronRight className="h-3 w-3 text-zinc-600" />
                  <span className="text-zinc-300">{currentItem.label}</span>
                </p>
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-none mt-1">
                  {currentItem.label}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* GPS Telemetry Pill */}
              <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 text-xs text-zinc-200 px-3 py-1.5 rounded-xl shadow-xs">
                <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                <span className="font-semibold font-mono text-[11px]">
                  {permissionState === 'granted' ? 'Location on' : 'Turn on location'}
                </span>
              </div>

              {/* Driver status */}
              <div className="hidden sm:flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs px-3 py-1.5 rounded-xl font-bold">
                <ShieldCheck className="h-3.5 w-3.5 text-rose-400" />
                <span>Driver account</span>
              </div>

              {/* Notifications Link */}
              <NavLink
                to={ROUTES.DRIVER.NOTIFICATIONS}
                className="relative p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/[0.06] transition"
                aria-label="Notifications"
              >
                <Bell className="h-4.5 w-4.5" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500" />
              </NavLink>

              {/* Logout Button */}
              <button
                type="button"
                onClick={handleLogout}
                className="p-2 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-white/[0.06] transition cursor-pointer"
                title="Sign out"
              >
                <LogOut className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          {/* Mobile Navigation Drawer */}
          {mobileOpen && (
            <div className="lg:hidden max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain border-t border-white/10 bg-zinc-950/95 backdrop-blur-xl px-3 py-3 space-y-1 mt-4 rounded-2xl shadow-2xl">
              {driverNavItems.map(({ label, path, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  onClick={() => setMobileOpen(false)}
                  end={path === ROUTES.DRIVER.DASHBOARD}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-rose-500/10 text-rose-300 border-l-2 border-rose-500'
                        : 'text-zinc-300 hover:bg-white/[0.05]'
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          )}
        </header>

        {/* Role Mismatch Warning Banner */}
        {isRoleMismatch && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              <span>
                <strong>Session Role Warning:</strong> Your browser session is authenticated as <code>{user?.role}</code>.
                Browser tabs share cookies. To test the Driver portal simultaneously, please open an <strong>Incognito / Private Window</strong> and sign in as <code>demo.driver@resq.local</code>.
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 font-semibold text-[11px] cursor-pointer shrink-0 self-start sm:self-auto"
            >
              Sign out & Switch Account
            </button>
          </div>
        )}

        {/* Global Urgent Emergency Dispatch Offer Overlay */}
        {incomingOffer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="w-full max-w-lg rounded-3xl bg-zinc-950 border-2 border-rose-500 shadow-2xl shadow-rose-950/90 overflow-hidden relative">
              {/* Header Gradient */}
              <div className="bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 px-6 py-4 flex items-center justify-between text-white">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 bg-white/20 rounded-xl backdrop-blur-md animate-pulse">
                    <Siren className="h-5 w-5 text-white" />
                  </span>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-rose-100 font-bold block">
                      Emergency Dispatch Request
                    </span>
                    <h3 className="text-base font-extrabold tracking-tight">
                      {incomingOffer.request?.situationType || 'Urgent Medical Emergency'}
                    </h3>
                  </div>
                </div>
                {secondsLeft !== null && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 border border-white/20 text-xs font-mono font-bold">
                    <Clock className="h-3.5 w-3.5 text-amber-300 animate-spin" />
                    <span>{Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, '0')}</span>
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                {/* Request Code & Priority Badge */}
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-zinc-400">
                    ID: <strong className="text-zinc-200">{incomingOffer.request?.requestCode || incomingOffer.dispatchJobId.slice(0, 8)}</strong>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold uppercase tracking-wider">
                    Immediate Dispatch
                  </span>
                </div>

                {/* Pickup & Destination Locations */}
                <div className="space-y-3 rounded-2xl bg-zinc-900/80 border border-white/10 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-6 w-6 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                      <MapPin className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">Patient Pickup Location</span>
                      <p className="text-sm font-semibold text-white mt-0.5">
                        {incomingOffer.request?.pickup?.label || 'Emergency GPS Coordinates Shared'}
                      </p>
                      {incomingOffer.route?.distanceMeters && (
                        <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                          Distance: {(incomingOffer.route.distanceMeters / 1000).toFixed(1)} km
                          {incomingOffer.route.etaSeconds && ` • ETA: ~${Math.ceil(incomingOffer.route.etaSeconds / 60)} mins`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-3 flex items-start gap-3">
                    <div className="mt-0.5 h-6 w-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">Destination Hospital</span>
                      <p className="text-sm font-semibold text-white mt-0.5">
                        {incomingOffer.hospital?.name || 'Assigned Verified Hospital'}
                      </p>
                      {incomingOffer.hospital?.address && (
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {incomingOffer.hospital.address}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => rejectOffer.mutate(incomingOffer.dispatchJobId)}
                    disabled={rejectOffer.isPending || acceptOffer.isPending}
                    className="py-3 px-4 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-zinc-300 transition cursor-pointer disabled:opacity-50 text-center"
                  >
                    {rejectOffer.isPending ? 'Declining...' : 'Decline Offer'}
                  </button>

                  <button
                    type="button"
                    onClick={() => acceptOffer.mutate(incomingOffer.dispatchJobId)}
                    disabled={acceptOffer.isPending}
                    className="py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-xs font-bold text-white shadow-xl shadow-emerald-950/80 transition cursor-pointer active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {acceptOffer.isPending ? (
                      'Accepting...'
                    ) : (
                      <>
                        <span>Accept & Start Trip</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Content */}
        <main className="flex-1 flex flex-col">
          <Outlet context={context} />
        </main>
      </div>
    </div>
  );
};
