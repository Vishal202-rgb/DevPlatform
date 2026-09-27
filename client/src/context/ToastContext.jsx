import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const recentToastsRef = useRef(new Map());

  const addToast = useCallback((type, message, title = '') => {
    if (!message) return null;

    // Deduplication check: prevent same type + message within 2.5 seconds
    const key = `${type}:${title}:${message}`;
    const now = Date.now();
    const lastSeen = recentToastsRef.current.get(key);
    if (lastSeen && now - lastSeen < 2500) {
      return null;
    }
    recentToastsRef.current.set(key, now);

    // Clean up old deduplication cache entries
    if (recentToastsRef.current.size > 50) {
      for (const [k, time] of recentToastsRef.current.entries()) {
        if (now - time > 10000) {
          recentToastsRef.current.delete(k);
        }
      }
    }

    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, type, message, title, createdAt: now }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);

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
      <div
        className="fixed bottom-5 right-5 z-[9999] flex max-w-sm sm:max-w-md flex-col gap-2.5 pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';
          const isWarning = t.type === 'warning';

          const borderBg = isSuccess
            ? 'border-emerald-500/30 bg-[#0C1412]/95 text-emerald-300'
            : isError
            ? 'border-rose-500/30 bg-[#160E11]/95 text-rose-300'
            : isWarning
            ? 'border-amber-500/30 bg-[#16120C]/95 text-amber-300'
            : 'border-graphite-600/80 bg-graphite-900/95 text-mist-200';

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-2xl backdrop-blur-md animate-slide-up transition-all ${borderBg}`}
            >
              {/* Type icon */}
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${
                  isSuccess
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                    : isError
                    ? 'border-rose-500/20 bg-rose-500/10 text-rose-400'
                    : isWarning
                    ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                    : 'border-graphite-600 bg-graphite-800 text-mist-300'
                }`}
              >
                {isSuccess ? (
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : isError ? (
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : isWarning ? (
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-0.5">
                {t.title && (
                  <p className="text-xs font-mono font-semibold uppercase tracking-wider text-mist-100">
                    {t.title}
                  </p>
                )}
                <p className="text-xs leading-relaxed text-mist-300 break-words">{t.message}</p>
              </div>

              <button
                onClick={() => removeToast(t.id)}
                className="shrink-0 rounded p-1 text-mist-500 hover:bg-graphite-800 hover:text-mist-200 transition-colors text-xs"
                aria-label="Dismiss notification"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
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
