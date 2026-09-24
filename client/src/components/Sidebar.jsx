import { Link, NavLink, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

const navItems = [
  {
    label: 'Overview',
    to: '/dashboard',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="7" height="9" x="3" y="3" rx="1" />
        <rect width="7" height="5" x="14" y="3" rx="1" />
        <rect width="7" height="9" x="14" y="12" rx="1" />
        <rect width="7" height="5" x="3" y="16" rx="1" />
      </svg>
    ),
  },
  {
    label: 'Repositories',
    to: '/dashboard/repositories',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="6" x2="6" y1="3" y2="15" />
        <circle cx="18" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M18 9a9 9 0 0 1-9 9" />
      </svg>
    ),
  },
  {
    label: 'Analyses',
    to: '/dashboard/analyses',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    label: 'Issues',
    to: '/dashboard/issues',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" x2="12" y1="8" y2="12" />
        <line x1="12" x2="12.01" y1="16" y2="16" />
      </svg>
    ),
  },
  {
    label: 'Diagnostics',
    to: '/dashboard/system-health',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
];

function initialsFor(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function Sidebar({ mobileOpen = false, onCloseMobile = () => {} }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Close mobile drawer on route change
  useEffect(() => {
    onCloseMobile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between">
      <div>
        {/* Brand Header */}
        <div className="mb-7 flex items-center justify-between px-2">
          <Link to="/dashboard" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-500 font-mono text-xs font-bold text-graphite-950 shadow-glow-sm transition-transform group-hover:scale-105">
              Dv
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sm font-semibold tracking-tight text-mist-100">
                  DevPlatform
                </span>
                <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase text-amber-400">
                  SaaS
                </span>
              </div>
              <p className="text-[10px] text-mist-500 font-mono">AI Developer Suite</p>
            </div>
          </Link>

          {/* Close button for mobile */}
          {mobileOpen && (
            <button
              onClick={onCloseMobile}
              className="rounded-lg p-1.5 text-mist-400 hover:bg-graphite-800 hover:text-mist-100 md:hidden"
              aria-label="Close navigation"
            >
              ✕
            </button>
          )}
        </div>

        {/* Navigation Section */}
        <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-mist-500 font-mono">
          Main Navigation
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20 shadow-sm'
                    : 'text-mist-400 hover:bg-graphite-800 hover:text-mist-100'
                }`
              }
            >
              <span className="shrink-0">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer Area: System status & User Profile */}
      <div className="space-y-3 pt-4 border-t border-graphite-700/80">
        {/* Status card */}
        <div className="rounded-xl border border-graphite-700/80 bg-graphite-800/60 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wide text-mist-400">Platform</span>
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Operational
            </span>
          </div>
          <Link
            to="/dashboard/system-health"
            className="mt-2 flex items-center justify-between text-[11px] text-mist-300 hover:text-amber-400 transition-colors"
          >
            <span>Diagnostics &amp; Health</span>
            <span className="text-mist-500">→</span>
          </Link>
        </div>

        {/* User Profile Card */}
        <div className="flex items-center justify-between rounded-xl border border-graphite-700/80 bg-graphite-800/40 p-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-graphite-700 font-mono text-xs font-bold text-amber-400 border border-graphite-600">
              {initialsFor(user?.name) || 'U'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-mist-100 leading-tight">
                {user?.name || 'Developer'}
              </p>
              <p className="truncate text-[10px] text-mist-500 font-mono">
                {user?.email || 'dev@platform.io'}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            title="Log out"
            className="rounded-lg p-1.5 text-mist-500 hover:bg-graphite-700 hover:text-red-400 transition-colors shrink-0"
            aria-label="Log out"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop static sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-graphite-700 bg-graphite-900 px-4 py-6 md:flex md:flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-graphite-950/80 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 flex h-full w-72 flex-col border-r border-graphite-700 bg-graphite-900 p-5 shadow-2xl animate-fade-in">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
