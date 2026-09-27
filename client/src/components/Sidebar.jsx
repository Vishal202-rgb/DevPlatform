import { Link, NavLink, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

const navSections = [
  {
    title: 'OVERVIEW',
    items: [
      {
        label: 'Dashboard',
        to: '/dashboard',
        exact: true,
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="7" height="9" x="3" y="3" rx="1" />
            <rect width="7" height="5" x="14" y="3" rx="1" />
            <rect width="7" height="9" x="14" y="12" rx="1" />
            <rect width="7" height="5" x="3" y="16" rx="1" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'CODE INTELLIGENCE',
    items: [
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
        label: 'Code Analysis',
        to: '/dashboard/analyses',
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        ),
      },
      {
        label: 'Architecture',
        to: '/dashboard/architecture',
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
        ),
      },
      {
        label: 'AI Chat',
        to: '/dashboard/chat',
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'ENGINEERING',
    items: [
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
        label: 'Security',
        to: '/dashboard/security',
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        ),
      },
      {
        label: 'Tests',
        to: '/dashboard/tests',
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        ),
      },
      {
        label: 'Impact Analysis',
        to: '/dashboard/impact',
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="2" />
            <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'AUTOMATION',
    items: [
      {
        label: 'AI Fixes',
        to: '/dashboard/ai-fixes',
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" />
          </svg>
        ),
      },
      {
        label: 'Pull Requests',
        to: '/dashboard/pull-requests',
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="18" r="3" />
            <circle cx="6" cy="6" r="3" />
            <path d="M13 6h3a2 2 0 0 1 2 2v7" />
            <line x1="6" y1="9" x2="6" y2="21" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      {
        label: 'System Health',
        to: '/dashboard/system-health',
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        ),
      },
      {
        label: 'Settings',
        to: '/dashboard/settings',
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ),
      },
    ],
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

  const checkIsActive = (to, exact = false) => {
    if (exact) {
      return location.pathname === to;
    }
    if (to === '/dashboard/repositories') {
      return (
        location.pathname === '/dashboard/repositories' ||
        (location.pathname.startsWith('/dashboard/repositories/') &&
          location.pathname.includes('/analysis'))
      );
    }
    if (to === '/dashboard/architecture') {
      return (
        location.pathname === '/dashboard/architecture' ||
        (location.pathname.startsWith('/dashboard/repositories/') &&
          location.pathname.includes('/architecture'))
      );
    }
    if (to === '/dashboard/chat') {
      return (
        location.pathname === '/dashboard/chat' ||
        (location.pathname.startsWith('/dashboard/repositories/') &&
          location.pathname.includes('/chat'))
      );
    }
    return location.pathname.startsWith(to);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between overflow-hidden">
      <div className="flex flex-col flex-1 overflow-y-auto pr-1 scrollbar-thin">
        {/* Brand Header */}
        <div className="mb-5 flex items-center justify-between px-2 pt-1 shrink-0">
          <Link to="/dashboard" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-500 font-mono text-xs font-bold text-graphite-950 shadow-glow-sm transition-transform group-hover:scale-105">
              DM
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sm font-semibold tracking-tight text-mist-100">
                  DevMind
                </span>
                <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase text-amber-400 border border-amber-400/20">
                  v2.0
                </span>
              </div>
              <p className="text-[10px] text-mist-500 font-mono">AI Software Platform</p>
            </div>
          </Link>

          {/* Close button for mobile */}
          {mobileOpen && (
            <button
              onClick={onCloseMobile}
              className="rounded-lg p-1.5 text-mist-400 hover:bg-graphite-800 hover:text-mist-100 md:hidden"
              aria-label="Close navigation"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Structured Navigation Sections */}
        <div className="space-y-4 pb-4">
          {navSections.map((section) => (
            <div key={section.title}>
              <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-mist-500 font-mono">
                {section.title}
              </div>
              <nav className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const isActive = checkIsActive(item.to, item.exact);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all relative ${
                        isActive
                          ? 'bg-amber-400/10 text-amber-400 border border-amber-400/25 shadow-sm font-semibold'
                          : 'text-mist-400 hover:bg-graphite-800/70 hover:text-mist-100 border border-transparent'
                      }`}
                    >
                      <span className={`shrink-0 ${isActive ? 'text-amber-400' : 'text-mist-400'}`}>
                        {item.icon}
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {isActive && (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-glow-sm" />
                      )}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Area: Platform status & User Profile */}
      <div className="space-y-2.5 pt-3 border-t border-graphite-800 shrink-0">
        {/* Status indicator */}
        <div className="rounded-xl border border-graphite-750 bg-graphite-850/60 p-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wide text-mist-400">Platform</span>
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Operational
            </span>
          </div>
          <Link
            to="/dashboard/system-health"
            className="mt-1.5 flex items-center justify-between text-[11px] text-mist-300 hover:text-amber-400 transition-colors font-medium"
          >
            <span>Diagnostics &amp; Health</span>
            <span className="text-mist-500">→</span>
          </Link>
        </div>

        {/* User Profile Card */}
        <div className="flex items-center justify-between rounded-xl border border-graphite-750 bg-graphite-850/40 p-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-graphite-800 font-mono text-xs font-bold text-amber-400 border border-graphite-700">
              {initialsFor(user?.name) || 'U'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-mist-100 leading-tight">
                {user?.name || 'Developer'}
              </p>
              <p className="truncate text-[10px] text-mist-500 font-mono">
                {user?.email || 'dev@devmind.io'}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            title="Log out"
            className="rounded-lg p-1 text-mist-500 hover:bg-graphite-800 hover:text-rose-400 transition-colors shrink-0"
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
      <aside className="hidden w-64 shrink-0 border-r border-graphite-800 bg-graphite-900/95 px-3 py-4 md:flex md:flex-col h-full">
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
          <div className="relative z-10 flex h-full w-72 flex-col border-r border-graphite-750 bg-graphite-900 p-4 shadow-2xl animate-fade-in">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
