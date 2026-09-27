import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useGithubConnection } from '../hooks/useGithubConnection';
import { useToast } from '../hooks/useToast';

export default function Settings() {
  const { user } = useAuth();
  const { isConnected, githubProfile, connect, disconnect } = useGithubConnection();
  const toast = useToast();

  const [model, setModel] = useState('gemini-2.5-flash');
  const [autoScanOnPush, setAutoScanOnPush] = useState(true);
  const [strictLintMode, setStrictLintMode] = useState(false);
  const [notifyOnCritical, setNotifyOnCritical] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  const handleSavePreferences = (e) => {
    e.preventDefault();
    setIsSaved(true);
    toast.success('Workspace preferences saved successfully.');
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="space-y-6 pb-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-graphite-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-mist-400">
            <span>System</span>
            <span>/</span>
            <span className="text-amber-400 font-semibold">Workspace Configuration</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-mist-100 mt-1">
            Settings &amp; Preferences
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-mist-400">
            Manage your AI inference engine, GitHub integration, and codebase audit policies.
          </p>
        </div>
      </div>

      <form onSubmit={handleSavePreferences} className="space-y-6">
        {/* User Profile Section */}
        <div className="rounded-2xl border border-graphite-750 bg-graphite-900/90 p-5 sm:p-6 shadow-panel space-y-4">
          <div className="flex items-center gap-2 border-b border-graphite-800 pb-3">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-amber-400">
              Developer Profile
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-mist-300 font-mono mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                defaultValue={user?.name || 'Developer'}
                disabled
                className="w-full rounded-lg border border-graphite-750 bg-graphite-850 px-3 py-2 text-xs text-mist-300 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-mist-300 font-mono mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                defaultValue={user?.email || 'dev@devmind.io'}
                disabled
                className="w-full rounded-lg border border-graphite-750 bg-graphite-850 px-3 py-2 text-xs text-mist-300 outline-none"
              />
            </div>
          </div>
        </div>

        {/* AI Engine Configuration */}
        <div className="rounded-2xl border border-graphite-750 bg-graphite-900/90 p-5 sm:p-6 shadow-panel space-y-4">
          <div className="flex items-center justify-between border-b border-graphite-800 pb-3">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-amber-400">
              AI Inference Engine
            </span>
            <span className="rounded-full bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 text-[10px] font-mono text-amber-400 font-semibold">
              Gemini Powered
            </span>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-medium text-mist-300 font-mono">
              Primary Analysis Model
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'gemini-2.5-flash',
                  name: 'Gemini 2.5 Flash',
                  badge: 'Recommended',
                  desc: 'Ultra-fast AST semantic audits and real-time PR generation.',
                },
                {
                  id: 'gemini-3.0-flash',
                  name: 'Gemini 3.0 Flash',
                  badge: 'Preview',
                  desc: 'Enhanced reasoning for complex architectural graphs.',
                },
                {
                  id: 'gemini-2.0-flash',
                  name: 'Gemini 2.0 Flash',
                  badge: 'Fallback',
                  desc: 'High-availability automated failover model.',
                },
              ].map((m) => (
                <div
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                    model === m.id
                      ? 'border-amber-400 bg-amber-400/10 shadow-sm'
                      : 'border-graphite-750 bg-graphite-850/60 hover:border-graphite-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-mist-100">{m.name}</span>
                    <span className="text-[9px] font-mono rounded bg-graphite-800 px-1.5 py-0.5 text-mist-400 border border-graphite-700">
                      {m.badge}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-mist-400 leading-relaxed">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-mist-100">Auto-Scan on Repository Push</p>
                <p className="text-[11px] text-mist-400">Trigger background AST audit on Git commits to main branch</p>
              </div>
              <input
                type="checkbox"
                checked={autoScanOnPush}
                onChange={(e) => setAutoScanOnPush(e.target.checked)}
                className="h-4 w-4 rounded border-graphite-700 bg-graphite-800 text-amber-400 focus:ring-amber-400"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-mist-100">Strict AST Lint Mode</p>
                <p className="text-[11px] text-mist-400">Enforce zero-tolerance rule sets on medium severity debts</p>
              </div>
              <input
                type="checkbox"
                checked={strictLintMode}
                onChange={(e) => setStrictLintMode(e.target.checked)}
                className="h-4 w-4 rounded border-graphite-700 bg-graphite-800 text-amber-400 focus:ring-amber-400"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-mist-100">Critical Finding Alerts</p>
                <p className="text-[11px] text-mist-400">Highlight high-priority security vulnerabilities in dashboard</p>
              </div>
              <input
                type="checkbox"
                checked={notifyOnCritical}
                onChange={(e) => setNotifyOnCritical(e.target.checked)}
                className="h-4 w-4 rounded border-graphite-700 bg-graphite-800 text-amber-400 focus:ring-amber-400"
              />
            </div>
          </div>
        </div>

        {/* GitHub Integration Card */}
        <div className="rounded-2xl border border-graphite-750 bg-graphite-900/90 p-5 sm:p-6 shadow-panel space-y-4">
          <div className="flex items-center justify-between border-b border-graphite-800 pb-3">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-amber-400">
              GitHub Sync &amp; Auth
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold uppercase ${
                isConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-graphite-800 text-mist-400 border border-graphite-700'
              }`}
            >
              {isConnected ? 'Connected' : 'Not Connected'}
            </span>
          </div>

          {isConnected ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src={githubProfile?.avatarUrl}
                  alt={githubProfile?.username}
                  className="h-10 w-10 rounded-full border border-graphite-700 bg-graphite-800"
                />
                <div>
                  <p className="font-mono text-xs font-bold text-mist-100">
                    @{githubProfile?.username}
                  </p>
                  <p className="text-[11px] text-mist-400 font-mono">
                    Token authenticated · Repository write access
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Disconnect your GitHub account from DevMind?')) {
                    disconnect();
                  }
                }}
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition-colors self-start sm:self-auto"
              >
                Disconnect GitHub
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-mist-400">
                Connect your GitHub account to sync public &amp; private repositories for AI reviews.
              </p>
              <button
                type="button"
                onClick={connect}
                className="rounded-lg bg-amber-400 px-3.5 py-1.5 text-xs font-semibold text-graphite-950 hover:bg-amber-300 transition-all shadow-sm self-start sm:self-auto"
              >
                Connect GitHub
              </button>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {isSaved && (
            <span className="text-xs font-mono text-emerald-400 animate-fade-in">
              ✓ Preferences saved
            </span>
          )}
          <button
            type="submit"
            className="rounded-xl bg-amber-400 px-5 py-2.5 text-xs sm:text-sm font-semibold text-graphite-950 transition-all hover:bg-amber-300 shadow-sm active:scale-95"
          >
            Save Preferences
          </button>
        </div>
      </form>
    </div>
  );
}
