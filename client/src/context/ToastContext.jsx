import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((type, message, title = '') => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, type, message, title }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const toast = {
    success: (msg, title) => addToast('success', msg, title),
    error: (msg, title) => addToast('error', msg, title),
    info: (msg, title) => addToast('info', msg, title),
    warning: (msg, title) => addToast('warning', msg, title),
    remove: removeToast,
    clear: clearToasts,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast viewport */}
      <div className="fixed bottom-5 right-5 z-[9999] flex max-w-sm flex-col gap-2.5 pointer-events-none">
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';
          const isWarning = t.type === 'warning';

          const borderColor = isSuccess
            ? 'border-emerald-500/40 bg-[#0F171A]/95 text-emerald-300'
            : isError
            ? 'border-red-500/40 bg-[#1A1114]/95 text-red-300'
            : isWarning
            ? 'border-amber-500/40 bg-[#1A160F]/95 text-amber-300'
            : 'border-graphite-600 bg-graphite-900/95 text-mist-200';

          const icon = isSuccess ? '✓' : isError ? '✕' : isWarning ? '⚠' : 'ℹ';

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-2xl backdrop-blur-md animate-slide-up transition-all ${borderColor}`}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                  isSuccess
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : isError
                    ? 'bg-red-500/20 text-red-400'
                    : isWarning
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-graphite-700 text-mist-200'
                }`}
              >
                {icon}
              </div>

              <div className="min-w-0 flex-1">
                {t.title && (
                  <p className="text-xs font-semibold uppercase tracking-wider text-mist-100">
                    {t.title}
                  </p>
                )}
                <p className="text-xs leading-relaxed text-mist-200">{t.message}</p>
              </div>

              <button
                onClick={() => removeToast(t.id)}
                className="shrink-0 text-mist-500 hover:text-mist-200 transition-colors text-xs p-1"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
