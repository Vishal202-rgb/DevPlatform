export default function PlaceholderPage({ title, description }) {
  return (
    <div className="space-y-6">
      <div className="border-b border-graphite-800 pb-5">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-mist-100">{title}</h1>
        <p className="mt-1 text-xs sm:text-sm text-mist-400">{description}</p>
      </div>

      <div className="rounded-2xl border border-dashed border-graphite-750 bg-graphite-900/60 p-12 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-graphite-800 border border-graphite-700 text-amber-400 font-mono text-xs font-bold">
          Dv
        </div>
        <p className="font-mono text-sm font-semibold text-amber-400">Section Under Active Development</p>
        <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm text-mist-400 leading-relaxed">
          This section is wired into platform navigation and will be populated as new telemetry and features are enabled.
        </p>
      </div>
    </div>
  );
}
