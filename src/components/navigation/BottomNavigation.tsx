import type { ComponentType } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Search, AlertCircle, Bookmark, User } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

interface NavItem {
  name: string;
  path: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  isEmergency?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Home', path: '/', icon: Home },
  { name: 'Search', path: '/search', icon: Search },
  { name: 'SOS', path: '/sos', icon: AlertCircle, isEmergency: true },
  { name: 'Saved', path: '/saved', icon: Bookmark },
  { name: 'Profile', path: '/profile', icon: User },
];

export const BottomNavigation = () => {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_10px_rgba(0,0,0,0.03)]"
    >
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          if (item.isEmergency) {
            return (
              <NavLink
                key={item.name}
                to={item.path}
                aria-label="Emergency SOS coordination"
                className="flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-2 py-1 group select-none cursor-pointer focus-visible:outline-none"
              >
                <div
                  className={`flex items-center justify-center w-9 h-9 rounded-full transition-all border ${
                    isActive
                      ? 'bg-rose-700 text-white border-rose-800 shadow-xs'
                      : 'bg-rose-50 text-rose-700 border-rose-200 group-hover:bg-rose-100 group-active:bg-rose-200'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                </div>
                <span
                  className={`text-[10px] font-semibold tracking-tight mt-0.5 ${
                    isActive ? 'text-rose-800' : 'text-rose-700'
                  }`}
                >
                  {item.name}
                </span>
              </NavLink>
            );
          }

          return (
            <NavLink
              key={item.name}
              to={item.path}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-2 py-1 rounded-md select-none cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                isActive ? 'text-slate-950 font-semibold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                {isActive && !shouldReduceMotion && (
                  <motion.div
                    layoutId="bottom-nav-active"
                    className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-slate-900"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  />
                )}
              </div>
              <span className="text-[10px] mt-1 leading-tight tracking-tight">
                {item.name}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
