const severityConfig = {
  critical: { label: 'Critical', color: '#D46A6A', bg: 'bg-red-500/10', text: 'text-red-400' },
  high: { label: 'High', color: '#E8A33D', bg: 'bg-orange-400/10', text: 'text-orange-400' },
  medium: { label: 'Medium', color: '#F5B942', bg: 'bg-amber-400/10', text: 'text-amber-400' },
  low: { label: 'Low', color: '#5B9BD5', bg: 'bg-sky-400/10', text: 'text-sky-400' },
};

export default function SeveritySummary({ summary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {['critical', 'high', 'medium', 'low'].map((key) => {
        const cfg = severityConfig[key];
        return (
          <div
            key={key}
            className="rounded-xl border border-graphite-700 bg-graphite-900 p-4 shadow-panel"
          >
            <p className="text-xs uppercase tracking-wider text-mist-500">{cfg.label}</p>
            <p className={`mt-1 font-mono text-2xl font-semibold ${cfg.text}`}>
              {summary?.[key] ?? 0}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export { severityConfig };
