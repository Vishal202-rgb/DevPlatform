import { Link } from 'react-router-dom';

export default function StatCard({
  label,
  value,
  hint,
  accent = false,
  icon,
  badge,
  linkTo,
  title,
}) {
  const tooltipTitle = title || (typeof value === 'string' ? value : undefined);
  const tooltipHint = typeof hint === 'string' ? hint : undefined;

  const cardContent = (
    <div
      className="group relative flex h-full min-h-[144px] flex-col justify-between overflow-hidden rounded-xl border border-graphite-750/90 bg-graphite-900/90 p-5 shadow-panel transition-all duration-150 hover:border-graphite-600 hover:bg-graphite-850/90 hover:shadow-panel-hover"
      title={tooltipTitle}
    >
      {/* Top highlight hairline */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-graphite-600/25 to-transparent pointer-events-none" />

      <div className="min-w-0">
        <div className="flex h-5 items-center justify-between gap-2">
          <p className="truncate text-xs font-medium text-mist-400">
            {label}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {badge && (
              <span className="rounded-md bg-graphite-800/80 px-2 py-0.5 text-[10px] font-mono font-medium text-mist-400 border border-graphite-750">
                {badge}
              </span>
            )}
            {icon && (
              <span className="text-mist-500 group-hover:text-amber-400 transition-colors">
                {icon}
              </span>
            )}
          </div>
        </div>

        <div className="mt-3.5 min-w-0">
          <p
            className={`truncate font-mono text-3xl font-bold tracking-tight tabular-nums ${
              accent ? 'text-amber-400' : 'text-mist-50'
            }`}
            title={tooltipTitle}
          >
            {value}
          </p>
        </div>
      </div>

      {hint && (
        <div className="mt-3.5 min-w-0 pt-2.5 border-t border-graphite-800/70">
          <p
            className="truncate text-xs text-mist-500 font-mono"
            title={tooltipHint}
          >
            {hint}
          </p>
        </div>
      )}
    </div>
  );

  if (linkTo) {
    return (
      <Link
        to={linkTo}
        className="block h-full transition-transform duration-150 hover:-translate-y-0.5 focus:outline-none"
      >
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}


