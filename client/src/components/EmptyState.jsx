import { Link } from 'react-router-dom';

export default function EmptyState({
  icon = '📂',
  title = 'No data found',
  description = 'There are no items to display at this time.',
  actionLabel,
  onAction,
  actionLink,
  secondaryLabel,
  onSecondary,
  isError = false,
}) {
  return (
    <div
      className={`rounded-2xl border border-dashed p-8 sm:p-12 text-center animate-fade-in ${
        isError
          ? 'border-rose-500/30 bg-rose-500/5'
          : 'border-graphite-750 bg-graphite-900/60'
      }`}
    >
      <div
        className={`mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-xl border text-xl sm:text-2xl shadow-sm ${
          isError
            ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
            : 'border-graphite-700 bg-graphite-800/90 text-amber-400'
        }`}
      >
        {icon}
      </div>

      <h3
        className={`font-mono text-sm sm:text-base font-semibold tracking-tight ${
          isError ? 'text-rose-300' : 'text-mist-100'
        }`}
      >
        {title}
      </h3>

      <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm text-mist-400 leading-relaxed">
        {description}
      </p>

      {(actionLabel || secondaryLabel) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {actionLabel && (
            actionLink ? (
              <Link
                to={actionLink}
                className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-graphite-950 transition-all hover:bg-amber-300 shadow-sm active:scale-95"
              >
                {actionLabel}
              </Link>
            ) : (
              <button
                type="button"
                onClick={onAction}
                className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-graphite-950 transition-all hover:bg-amber-300 shadow-sm active:scale-95"
              >
                {actionLabel}
              </button>
            )
          )}

          {secondaryLabel && (
            <button
              type="button"
              onClick={onSecondary}
              className="rounded-lg border border-graphite-700 bg-graphite-800 px-4 py-2 text-xs font-medium text-mist-300 transition-colors hover:border-graphite-600 hover:bg-graphite-750 hover:text-mist-100"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
