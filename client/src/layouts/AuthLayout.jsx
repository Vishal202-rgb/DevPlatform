import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen bg-graphite-950">
      {/* Left: form */}
      <div className="flex w-full flex-col justify-center px-8 py-12 sm:px-16 lg:w-1/2">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-400 font-mono text-sm font-bold text-graphite-950">
              Dv
            </div>
            <span className="font-mono text-sm font-semibold tracking-tight text-mist-100">
              devplatform
            </span>
          </div>
          <Outlet />
        </div>
      </div>

      {/* Right: signature panel */}
      <div className="relative hidden w-1/2 overflow-hidden bg-graphite-900 lg:flex lg:items-center lg:justify-center">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(#F5B942 1px, transparent 1px), linear-gradient(90deg, #F5B942 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative z-10 max-w-md px-10 text-left">
          <p className="font-mono text-xs uppercase tracking-widest text-amber-400">
            status: foundation
          </p>
          <h2 className="mt-3 text-2xl font-semibold leading-snug text-mist-100">
            Repository intelligence, before you've written the query.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-mist-500">
            This build lays down auth, data models, and a protected dashboard shell —
            the ground GitHub sync and AI-driven code analysis will stand on.
          </p>
          <div className="mt-8 flex gap-6 font-mono text-xs text-mist-500">
            <div>
              <p className="text-mist-100">JWT</p>
              <p>stateless auth</p>
            </div>
            <div>
              <p className="text-mist-100">bcrypt</p>
              <p>12 salt rounds</p>
            </div>
            <div>
              <p className="text-mist-100">MERN</p>
              <p>modular by design</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
