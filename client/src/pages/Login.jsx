import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import FormInput from '../components/FormInput';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || '/dashboard';

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(form);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to log in. Please verify your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-mist-100">
          Sign in to your account
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-mist-400">
          Don't have an account?{' '}
          <Link to="/register" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
            Create an account
          </Link>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          id="email"
          name="email"
          type="email"
          label="Email address"
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
          placeholder="••••••••••••"
          value={form.password}
          onChange={handleChange}
          required
          autoComplete="current-password"
        />

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 font-mono animate-fade-in">
            <span>⚠ </span>
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-xs sm:text-sm font-semibold text-graphite-950 transition-all hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm active:scale-[0.99] mt-2"
        >
          {isSubmitting ? (
            <>
              <span className="h-3 w-3 rounded-full border-2 border-graphite-950 border-t-transparent animate-spin" />
              <span>Authenticating…</span>
            </>
          ) : (
            <span>Sign In →</span>
          )}
        </button>
      </form>
    </div>
  );
}
