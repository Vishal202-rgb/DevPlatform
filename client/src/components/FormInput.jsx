export default function FormInput({ label, id, error, hint, ...inputProps }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="block text-xs font-mono font-medium uppercase tracking-wider text-mist-300">
          {label}
        </label>
        {hint && <span className="text-[11px] font-mono text-mist-500">{hint}</span>}
      </div>

      <input
        id={id}
        className={`w-full rounded-xl border bg-graphite-900 px-3.5 py-2.5 text-xs sm:text-sm text-mist-100 outline-none transition-all placeholder:text-mist-600 focus:bg-graphite-850 ${
          error
            ? 'border-rose-500/70 focus:border-rose-400'
            : 'border-graphite-750 hover:border-graphite-600 focus:border-amber-400'
        }`}
        {...inputProps}
      />

      {error && (
        <p className="text-[11px] text-rose-400 font-mono flex items-center gap-1.5 animate-fade-in">
          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
