import { Link, NavLink, Outlet } from 'react-router-dom';
import { Compass, AlertTriangle, LogIn, UserPlus, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { EnterpriseFooter } from '../components/common/EnterpriseFooter';
import { useLocationState } from '../hooks/useLocationState';
import { ROUTES } from '../routes/routePaths';
import { useAuth } from '../context/AuthContext';
import { getRoleHome } from '../routes/routePaths';

export const PublicLayout = () => {
  const { currentLocation, location: currentGeoLocation, isUpdating, permissionState, locationError, refreshLocation } = useLocationState();
  const { user, isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const context = {
    currentLocation,
    location: currentGeoLocation,
    permissionState,
    locationError,
    refreshLocation,
    isUpdating,
  };

  const navLinks = [
    { label: 'Home', path: ROUTES.PUBLIC.HOME },
    { label: 'About', path: ROUTES.PUBLIC.ABOUT },
    { label: 'Support & Help', path: ROUTES.PUBLIC.HELP },
    { label: 'Contact', path: ROUTES.PUBLIC.CONTACT },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#070709] text-white font-sans antialiased selection:bg-rose-500/20 selection:text-rose-200">
      {/* Public Glass Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#070709]/80 backdrop-blur-xl transition-all">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-12">
          {/* Logo */}
          <Link to={ROUTES.PUBLIC.HOME} className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-lg shadow-rose-600/30 group-hover:scale-105 transition-transform">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-white group-hover:text-rose-100 transition-colors">
                  resQ 2.O
                </span>
                <span className="hidden sm:inline-block text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  Crisis Fabric
                </span>
              </div>
              <span className="text-[11px] font-mono text-zinc-400 tracking-wider">
                Healthcare Network
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5" aria-label="Public Navigation">
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                end={link.path === '/'}
                className={({ isActive }) =>
                  `px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
                    isActive
                      ? 'bg-white/[0.08] text-white border border-white/10 shadow-xs'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Action CTAs */}
          <div className="hidden sm:flex items-center gap-3">
            <Link
              to={ROUTES.USER.EMERGENCY}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 px-4 py-2 text-xs font-bold text-white shadow-md shadow-rose-600/30 hover:from-rose-500 hover:to-rose-600 btn-shimmer transition-all"
            >
              <AlertTriangle className="h-3.5 w-3.5 animate-pulse" />
              Emergency SOS
            </Link>

            {isAuthenticated && user ? (
              <Link
                to={getRoleHome(user.role)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-zinc-200 hover:text-white hover:bg-white/[0.08] transition"
              >
                Portal ({user.role.replaceAll('_', ' ').toLowerCase()})
              </Link>
            ) : (
              <>
                <Link
                  to={ROUTES.PUBLIC.LOGIN}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.05] transition"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Sign In
                </Link>

                <Link
                  to={ROUTES.PUBLIC.REGISTER}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 px-4 py-2 text-xs font-semibold text-white transition"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Register
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Hamburger */}
          <button
            type="button"
            className="md:hidden p-2 rounded-xl text-zinc-300 hover:bg-white/[0.05]"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/[0.08] bg-[#070709]/95 backdrop-blur-2xl px-6 py-4 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 text-sm font-medium text-zinc-300 hover:text-white rounded-lg hover:bg-white/[0.05]"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-white/[0.08] flex flex-col gap-2.5">
              <Link
                to={ROUTES.USER.EMERGENCY}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-600/30"
              >
                <AlertTriangle className="h-4 w-4" /> Trigger Emergency SOS
              </Link>
              {isAuthenticated && user ? (
                <Link
                  to={getRoleHome(user.role)}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-zinc-300"
                >
                  My Portal
                </Link>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to={ROUTES.PUBLIC.LOGIN}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-300"
                  >
                    <LogIn className="h-3.5 w-3.5" /> Sign In
                  </Link>
                  <Link
                    to={ROUTES.PUBLIC.REGISTER}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-white/[0.08] px-3 py-2 text-xs font-semibold text-white border border-white/10"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <Outlet context={context} />
      </main>

      <EnterpriseFooter />
    </div>
  );
};
