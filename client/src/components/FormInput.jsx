export default function FormInput({ label, id, error, hint, ...inputProps }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="block text-xs font-mono font-medium uppercase tracking-wider text-mist-300">
          {label}
        </label>
        {hint && <span className="text-[11px] text-mist-500">{hint}</span>}
      </div>

      <input
        id={id}
        className={`w-full rounded-xl border bg-graphite-900 px-3.5 py-2.5 text-xs sm:text-sm text-mist-100 outline-none transition-all placeholder:text-mist-600 focus:bg-graphite-850 ${
          error
            ? 'border-red-500/70 focus:border-red-400'
            : 'border-graphite-700 hover:border-graphite-600 focus:border-amber-400'
        }`}
        {...inputProps}
      />

      {error && (
        <p className="text-[11px] text-red-400 font-mono flex items-center gap-1 animate-fade-in">
          <span>⚠</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
