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
      setError('Password must be at least 8 characters.');
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
    <div>
      <h1 className="text-2xl font-semibold text-mist-100">Create your account</h1>
      <p className="mt-1.5 text-sm text-mist-500">
        Already have one?{' '}
        <Link to="/login" className="text-amber-400 hover:underline">
          Log in
        </Link>
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
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
          label="Email"
          placeholder="you@company.com"
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
          value={form.password}
          onChange={handleChange}
          required
          autoComplete="new-password"
        />

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-graphite-950 transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
