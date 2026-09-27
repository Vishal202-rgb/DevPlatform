import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useGithubConnection } from '../hooks/useGithubConnection';

function initialsFor(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function getBreadcrumb(pathname) {
  if (pathname === '/dashboard') return { title: 'Overview', category: 'Platform' };
  if (pathname === '/dashboard/repositories') return { title: 'Repositories', category: 'Codebase' };
  if (pathname === '/dashboard/analyses') return { title: 'Analyses History', category: 'Insights' };
  if (pathname === '/dashboard/issues') return { title: 'Issues & Debts', category: 'Code Quality' };
  if (pathname === '/dashboard/system-health') return { title: 'System Diagnostics', category: 'Environment' };
  if (pathname.includes('/chat')) return { title: 'Codebase AI Chat', category: 'AI Assistant' };
  if (pathname.includes('/architecture')) return { title: 'Architecture Graph', category: 'Visualization' };
  if (pathname.includes('/analysis')) return { title: 'Analysis Report', category: 'Audit' };
  return { title: 'Dashboard', category: 'Platform' };
}

export default function Navbar({ onToggleMobileMenu, isMobileMenuOpen }) {
  const { user, logout } = useAuth();
  const { isConnected, githubProfile } = useGithubConnection();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const breadcrumb = getBreadcrumb(location.pathname);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-graphite-800 bg-graphite-900/90 px-4 sm:px-6 backdrop-blur-md z-30">
      {/* Left side: Mobile hamburger & breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-graphite-750 bg-graphite-800 text-mist-300 hover:text-mist-100 md:hidden transition-colors"
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {isMobileMenuOpen ? (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>

        <div className="flex items-center gap-2">
          <span className="hidden text-xs font-mono uppercase tracking-wider text-mist-500 sm:inline">
            {breadcrumb.category}
          </span>
          <span className="hidden text-mist-600 sm:inline">/</span>
          <span className="text-sm font-semibold text-mist-100">
            {breadcrumb.title}
          </span>
        </div>
      </div>

      {/* Right side: GitHub status badge & user avatar */}
      <div className="flex items-center gap-3">
        {/* GitHub integration indicator */}
        {isConnected ? (
          <div className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[11px]">
              @{githubProfile?.username || 'github'}
            </span>
          </div>
        ) : (
          <Link
            to="/dashboard"
            className="hidden items-center gap-1.5 rounded-full border border-graphite-700 bg-graphite-800/80 px-2.5 py-1 text-[11px] font-mono text-mist-400 hover:border-amber-400/40 hover:text-amber-400 transition-colors sm:flex"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400/80" />
            <span>Connect GitHub</span>
          </Link>
        )}

        {/* User profile dropdown trigger */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-xl border border-graphite-750 bg-graphite-800/90 p-1.5 transition-all hover:border-graphite-600 focus:outline-none"
            aria-expanded={menuOpen}
            aria-haspopup="true"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/10 font-mono text-xs font-bold text-amber-400 border border-amber-400/20">
              {initialsFor(user?.name) || 'U'}
            </div>
            <span className="hidden text-xs font-medium text-mist-200 sm:inline max-w-[100px] truncate pr-1">
              {user?.name || 'Account'}
            </span>
            <svg
              className={`h-3.5 w-3.5 text-mist-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {/* User Dropdown Menu */}
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-graphite-700 bg-graphite-900/95 p-1.5 shadow-2xl backdrop-blur-md animate-scale-in z-50 divide-y divide-graphite-800">
              <div className="px-3 py-2.5">
                <p className="text-xs font-semibold text-mist-100 truncate">
                  {user?.name || 'Developer'}
                </p>
                <p className="text-[11px] font-mono text-mist-500 truncate mt-0.5">
                  {user?.email || 'dev@platform.io'}
                </p>
              </div>

              <div className="py-1">
                <Link
                  to="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-mist-300 hover:bg-graphite-800 hover:text-mist-100 transition-colors"
                >
                  <svg className="h-3.5 w-3.5 text-mist-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect width="7" height="9" x="3" y="3" rx="1" />
                    <rect width="7" height="5" x="14" y="3" rx="1" />
                    <rect width="7" height="9" x="14" y="12" rx="1" />
                    <rect width="7" height="5" x="3" y="16" rx="1" />
                  </svg>
                  <span>Dashboard Overview</span>
                </Link>

                <Link
                  to="/dashboard/system-health"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-mist-300 hover:bg-graphite-800 hover:text-mist-100 transition-colors"
                >
                  <svg className="h-3.5 w-3.5 text-mist-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                  <span>Diagnostics &amp; Health</span>
                </Link>
              </div>

              <div className="pt-1">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" x2="9" y1="12" y2="12" />
                  </svg>
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
