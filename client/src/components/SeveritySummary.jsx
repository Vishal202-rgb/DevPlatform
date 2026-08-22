const severityConfig = {
  critical: { label: 'Critical', color: '#DC2626', bg: 'bg-red-500/10', text: 'text-red-600' },
  high: { label: 'High', color: '#EA580C', bg: 'bg-orange-500/10', text: 'text-orange-600' },
  medium: { label: 'Medium', color: '#CA8A04', bg: 'bg-yellow-400/10', text: 'text-yellow-700' },
  low: { label: 'Low', color: '#0284C7', bg: 'bg-sky-500/10', text: 'text-sky-600' },
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