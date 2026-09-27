import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FormInput from '../components/FormInput';
import { useAuth } from '../hooks/useAuth';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register(form);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-mist-100">
          Create developer account
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-mist-400">
          Already registered?{' '}
          <Link to="/login" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          id="name"
          name="name"
          type="text"
          label="Full name"
          placeholder="Ada Lovelace"
          value={form.name}
          onChange={handleChange}
          required
          autoComplete="name"
        />

        <FormInput
          id="email"
          name="email"
          type="email"
          label="Work email"
          placeholder="developer@company.com"
          value={form.email}
          onChange={handleChange}
          required
          autoComplete="email"
        />

        <FormInput
          id="password"
          name="password"
          type="password"
          label="Password"
          placeholder="At least 8 characters"
          hint="Min 8 characters"
          value={form.password}
          onChange={handleChange}
          required
          autoComplete="new-password"
        />

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 font-mono animate-fade-in flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0 text-rose-400" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-xs sm:text-sm font-semibold text-graphite-950 transition-all hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm active:scale-[0.99] mt-2"
        >
          {isSubmitting ? (
            <>
              <svg className="h-4 w-4 animate-spin text-graphite-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span>Creating Account…</span>
            </>
          ) : (
            <span>Create Account →</span>
          )}
        </button>
      </form>
    </div>
  );
}
