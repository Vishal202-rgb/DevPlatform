import { Link, NavLink } from 'react-router-dom';

const navItems = [
  { label: 'Overview', to: '/dashboard', icon: '◧' },
  { label: 'Repositories', to: '/dashboard/repositories', icon: '⌥' },
  { label: 'Analyses', to: '/dashboard/analyses', icon: '≡' },
  { label: 'Issues', to: '/dashboard/issues', icon: '⚑' },
];

export default function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-graphite-700 bg-graphite-900 px-4 py-6 md:flex">
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-400 font-mono text-sm font-bold text-graphite-950">
          Dv
        </div>
        <span className="font-mono text-sm font-semibold tracking-tight text-mist-100">
          devplatform
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-graphite-800 text-amber-400'
                  : 'text-mist-500 hover:bg-graphite-800 hover:text-mist-100'
              }`
            }
          >
            <span className="font-mono text-base leading-none">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="rounded-lg border border-graphite-700 bg-graphite-800 p-3 text-xs text-mist-500">
        <p className="font-mono text-amber-400">v0.1.0 — foundation</p>
        <p className="mt-1">GitHub sync and AI analysis land in a later build.</p>
        <Link
          to="/dashboard/system-health"
          className="mt-2 inline-block text-amber-400/80 hover:text-amber-400 hover:underline"
        >
          Deployment diagnostics →
        </Link>
      </div>
    </aside>
  );
}
