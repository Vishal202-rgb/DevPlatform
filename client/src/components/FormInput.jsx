export default function FormInput({ label, id, error, ...inputProps }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm text-mist-300">
        {label}
      </label>
      <input
        id={id}
        className={`w-full rounded-lg border bg-graphite-800 px-3 py-2.5 text-sm text-mist-100 outline-none transition-colors placeholder:text-mist-500 focus:border-amber-400 ${
          error ? 'border-red-500/70' : 'border-graphite-600'
        }`}
        {...inputProps}
      />
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}
