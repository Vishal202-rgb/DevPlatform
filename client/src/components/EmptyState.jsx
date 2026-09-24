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
    <div className={`rounded-xl border border-dashed p-10 text-center animate-fade-in ${
      isError
        ? 'border-red-500/30 bg-red-500/5'
        : 'border-graphite-700 bg-graphite-900/60'
    }`}>
      <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${
        isError
          ? 'bg-red-500/10 text-red-400'
          : 'bg-graphite-800 text-amber-400'
      }`}>
        {icon}
      </div>

      <h3 className={`font-mono text-sm font-semibold tracking-tight ${
        isError ? 'text-red-400' : 'text-mist-100'
      }`}>
        {title}
      </h3>

      <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm text-mist-400 leading-relaxed">
        {description}
      </p>

      {(actionLabel || secondaryLabel) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {actionLabel && (
            actionLink ? (
              <a
                href={actionLink}
                className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-graphite-950 transition-colors hover:bg-amber-500 shadow-sm"
              >
                {actionLabel}
              </a>
            ) : (
              <button
                type="button"
                onClick={onAction}
                className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-graphite-950 transition-colors hover:bg-amber-500 shadow-sm active:scale-95"
              >
                {actionLabel}
              </button>
            )
          )}

          {secondaryLabel && (
            <button
              type="button"
              onClick={onSecondary}
              className="rounded-lg border border-graphite-600 bg-graphite-800 px-4 py-2 text-xs font-medium text-mist-300 transition-colors hover:bg-graphite-700 hover:text-mist-100"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
