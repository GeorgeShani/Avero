'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type Toast = { id: number; message: string };

const ToastContext = createContext<(message: string) => void>(() => undefined);

/** Tells the person something went through: "Saved", "Deleted". Failures stay on the page. */
export function useToast(): (message: string) => void {
  return useContext(ToastContext);
}

const visibleMs = 6000;

/**
 * Holds the toasts and draws them in a polite live region, so a screen reader hears each one
 * without the focus moving. At most three show; each goes away by itself or when dismissed.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message: string) => {
      const id = next.current++;
      setToasts((list) => [...list.slice(-2), { id, message }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), visibleMs),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div data-toasts role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} data-toast>
            <span>{toast.message}</span>
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
