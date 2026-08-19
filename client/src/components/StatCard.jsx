export default function StatCard({ label, value, hint, accent = false }) {
  return (
    <div className="rounded-xl border border-graphite-700 bg-graphite-900 p-5 shadow-panel">
      <p className="text-xs uppercase tracking-wider text-mist-500">{label}</p>
      <p
        className={`mt-2 font-mono text-3xl font-semibold ${
          accent ? 'text-amber-400' : 'text-mist-100'
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-mist-500">{hint}</p>}
    </div>
  );
}
