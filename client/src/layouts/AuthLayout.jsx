import { Outlet, Link } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen bg-graphite-950 text-mist-100 selection:bg-amber-400/20 selection:text-amber-300">
      {/* Left: Form View */}
      <div className="flex w-full flex-col justify-between px-6 py-10 sm:px-12 lg:w-1/2 lg:px-16">
        <div>
          <Link to="/" className="inline-flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-500 font-mono text-xs font-bold text-graphite-950 shadow-glow-sm transition-transform group-hover:scale-105">
              Dv
            </div>
            <span className="font-mono text-sm font-semibold tracking-tight text-mist-100">
              devplatform
            </span>
          </Link>
        </div>

        <div className="mx-auto w-full max-w-sm py-8">
          <Outlet />
        </div>

        <div className="text-center sm:text-left text-xs font-mono text-mist-500">
          <span>&copy; {new Date().getFullYear()} DevPlatform. Production-ready AI Developer SaaS.</span>
        </div>
      </div>

      {/* Right: Signature Linear/Vercel Showcase Panel */}
      <div className="relative hidden w-1/2 overflow-hidden border-l border-graphite-800 bg-graphite-900 lg:flex lg:flex-col lg:justify-between p-12">
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(#F59E0B 1px, transparent 1px), linear-gradient(90deg, #F59E0B 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Ambient radial blur */}
        <div className="absolute top-1/4 right-1/4 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            AI Developer Intelligence
          </span>
        </div>

        <div className="relative z-10 max-w-lg space-y-6">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-mist-100 font-sans">
            Automated code reviews, vulnerability fixes, and architecture graphs.
          </h2>

          <p className="text-sm text-mist-400 leading-relaxed">
            DevPlatform integrates directly with your GitHub repositories to audit code quality, generate unit test suites, and open verified pull requests automatically.
          </p>

          {/* Feature Badges */}
          <div className="grid grid-cols-2 gap-3 pt-2 font-mono text-xs">
            <div className="rounded-xl border border-graphite-700 bg-graphite-850/80 p-3.5 shadow-sm">
              <p className="text-amber-400 font-semibold">Gemini 2.5 Flash</p>
              <p className="text-mist-500 text-[11px] mt-0.5">AST static &amp; semantic scan</p>
            </div>

            <div className="rounded-xl border border-graphite-700 bg-graphite-850/80 p-3.5 shadow-sm">
              <p className="text-emerald-400 font-semibold">One-Click Fixes</p>
              <p className="text-mist-500 text-[11px] mt-0.5">Git branch &amp; PR generation</p>
            </div>

            <div className="rounded-xl border border-graphite-700 bg-graphite-850/80 p-3.5 shadow-sm">
              <p className="text-sky-400 font-semibold">Codebase Chat</p>
              <p className="text-mist-500 text-[11px] mt-0.5">Context-aware AI assistant</p>
            </div>

            <div className="rounded-xl border border-graphite-700 bg-graphite-850/80 p-3.5 shadow-sm">
              <p className="text-purple-400 font-semibold">Force Graph 2D</p>
              <p className="text-mist-500 text-[11px] mt-0.5">Module dependency topology</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs font-mono text-mist-500 border-t border-graphite-800 pt-6">
          <span>Enterprise-grade security</span>
          <span>Zero telemetry leakage</span>
        </div>
      </div>
    </div>
  );
}
