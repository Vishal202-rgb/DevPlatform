import { Link } from 'react-router-dom';

export default function StatCard({
  label,
  value,
  hint,
  accent = false,
  icon,
  badge,
  linkTo,
}) {
  const content = (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-graphite-700 bg-graphite-900 p-5 shadow-panel transition-all duration-200 hover:border-graphite-600 hover:shadow-panel-hover">
      {/* Top highlight hairline */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-graphite-600/40 to-transparent" />

      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-mono font-medium uppercase tracking-wider text-mist-400">
            {label}
          </p>
          {badge && (
            <span className="rounded-full bg-graphite-800 px-2 py-0.5 text-[10px] font-mono text-mist-300 border border-graphite-700">
              {badge}
            </span>
          )}
          {icon && (
            <span className="text-mist-500 group-hover:text-amber-400 transition-colors">
              {icon}
            </span>
          )}
        </div>

        <p
          className={`mt-3 font-mono text-3xl font-semibold tracking-tight tabular-nums ${
            accent ? 'text-amber-400' : 'text-mist-100'
          }`}
        >
          {value}
        </p>
      </div>

      {hint && (
        <p className="mt-2.5 text-xs text-mist-500 leading-normal">
          {hint}
        </p>
      )}
    </div>
  );

  if (linkTo) {
    return <Link to={linkTo} className="block transition-transform hover:-translate-y-0.5">{content}</Link>;
  }

  return content;
}
