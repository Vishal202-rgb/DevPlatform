export const severityConfig = {
  critical: {
    label: 'Critical',
    color: '#EF4444',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    dot: 'bg-red-400',
  },
  high: {
    label: 'High',
    color: '#F97316',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-400',
    dot: 'bg-orange-400',
  },
  medium: {
    label: 'Medium',
    color: '#F59E0B',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
  },
  low: {
    label: 'Low',
    color: '#38BDF8',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    text: 'text-sky-400',
    dot: 'bg-sky-400',
  },
};

export default function SeveritySummary({ summary, activeSeverity, onSelectSeverity }) {
  const levels = ['critical', 'high', 'medium', 'low'];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {levels.map((key) => {
        const cfg = severityConfig[key];
        const count = summary?.[key] ?? 0;
        const isSelected = activeSeverity === key;

        return (
          <div
            key={key}
            onClick={() => onSelectSeverity && onSelectSeverity(isSelected ? 'all' : key)}
            role={onSelectSeverity ? 'button' : undefined}
            tabIndex={onSelectSeverity ? 0 : undefined}
            className={`group relative overflow-hidden rounded-xl border p-4 shadow-panel transition-all ${
              isSelected
                ? `${cfg.border} ${cfg.bg} ring-1 ring-amber-400/40`
                : 'border-graphite-700 bg-graphite-900 hover:border-graphite-600 hover:bg-graphite-850/60'
            } ${onSelectSeverity ? 'cursor-pointer select-none active:scale-[0.98]' : ''}`}
          >
            {/* Top hairline */}
            <div className={`absolute inset-x-0 top-0 h-[1px] ${
              count > 0 ? cfg.bg : 'bg-transparent'
            }`} />

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-mono font-medium uppercase tracking-wider text-mist-400">
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
              {isSelected && (
                <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-mono text-amber-300">
                  Filtered
                </span>
              )}
            </div>

            <p className={`mt-2 font-mono text-2xl font-bold tracking-tight tabular-nums ${
              count > 0 ? cfg.text : 'text-mist-500'
            }`}>
              {count}
            </p>
          </div>
        );
      })}
    </div>
  );
}