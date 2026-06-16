import { useState, useCallback, createContext, useContext, useRef } from 'react';

const ToastContext = createContext(null);

const EXIT_DURATION = 300;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, EXIT_DURATION);
  }, []);

  const showToast = useCallback((message, type = 'success', duration = 4500) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type, leaving: false }]);
    setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast--${t.type}${t.leaving ? ' toast--leaving' : ''}`}>
            {t.type === 'success' && <span aria-hidden="true">✓</span>}
            {t.type === 'error'   && <span aria-hidden="true">✕</span>}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.showToast;
}
