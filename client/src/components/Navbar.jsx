import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function initialsFor(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-graphite-700 bg-graphite-900/80 px-6 backdrop-blur">
      <div>
        <p className="text-sm text-mist-500">
          Welcome back, <span className="text-mist-100">{user?.name?.split(' ')[0]}</span>
        </p>
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((open) => !open)}
          className="flex items-center gap-2 rounded-full border border-graphite-700 bg-graphite-800 py-1 pl-1 pr-3 text-sm text-mist-100 transition-colors hover:border-amber-500/40"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 font-mono text-xs font-bold text-graphite-950">
            {initialsFor(user?.name) || 'U'}
          </span>
          <span className="max-w-[10rem] truncate">{user?.name}</span>
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-lg border border-graphite-700 bg-graphite-800 shadow-panel">
            <div className="border-b border-graphite-700 px-3 py-2 text-xs text-mist-500">
              {user?.email}
            </div>
            <button
              onClick={handleLogout}
              className="w-full px-3 py-2 text-left text-sm text-mist-100 transition-colors hover:bg-graphite-700 hover:text-amber-400"
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
