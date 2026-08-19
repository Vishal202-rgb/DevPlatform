export default function PlaceholderPage({ title, description }) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-mist-100">{title}</h1>
      <p className="mt-1 text-sm text-mist-500">{description}</p>

      <div className="mt-6 rounded-xl border border-dashed border-graphite-700 bg-graphite-900/60 p-10 text-center">
        <p className="font-mono text-sm text-amber-400">Coming in a later build</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-mist-500">
          This section is wired into navigation now so the shell is complete, and will be
          filled in once GitHub sync and AI analysis are implemented.
        </p>
      </div>
    </div>
  );
}
