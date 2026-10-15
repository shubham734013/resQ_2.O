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
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Public Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link to={ROUTES.PUBLIC.HOME} className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-teal-950 text-teal-400 border border-teal-500/20 shadow-xs">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-slate-950">ResQ 2.0</span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                Healthcare Network
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Public Navigation">
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                end={link.path === '/'}
                className={({ isActive }) =>
                  `px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    isActive ? 'bg-slate-100 text-slate-950' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
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
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs shadow-rose-600/20 hover:bg-rose-700 transition"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Emergency SOS
            </Link>

            {isAuthenticated && user ? (
              <Link
                to={getRoleHome(user.role)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition"
              >
                Go to Portal ({user.role.replaceAll('_', ' ').toLowerCase()})
              </Link>
            ) : (
              <>
                <Link
                  to={ROUTES.PUBLIC.LOGIN}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Sign In
                </Link>

                <Link
                  to={ROUTES.PUBLIC.REGISTER}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
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
            className="md:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 text-sm font-semibold text-slate-700 rounded-lg hover:bg-slate-50"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              <Link
                to={ROUTES.USER.EMERGENCY}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white"
              >
                <AlertTriangle className="h-4 w-4" /> Trigger Emergency SOS
              </Link>
              {isAuthenticated && user ? (
                <Link
                  to={getRoleHome(user.role)}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-800"
                >
                  My Portal
                </Link>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to={ROUTES.PUBLIC.LOGIN}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    <LogIn className="h-3.5 w-3.5" /> Sign In
                  </Link>
                  <Link
                    to={ROUTES.PUBLIC.REGISTER}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
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
