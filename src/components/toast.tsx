"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface Toast {
  id: number;
  message: string;
  tone: "default" | "success" | "error";
  action?: { label: string; onClick: () => void };
}

interface ToastCtx {
  show: (message: string, opts?: { tone?: Toast["tone"]; action?: Toast["action"] }) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback<ToastCtx["show"]>((message, opts) => {
    const id = Date.now() + Math.random();
    const toast: Toast = { id, message, tone: opts?.tone ?? "default", action: opts?.action };
    setToasts((t) => [...t, toast]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-[86px] lg:bottom-6 inset-x-0 flex flex-col items-center gap-2 z-50 px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto max-w-sm w-full flex items-center gap-3 px-4 py-3 rounded-inner bg-surface border border-transparent shadow-[var(--shadow-card)]"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full flex-none ${
                t.tone === "success" ? "bg-income" : t.tone === "error" ? "bg-alert" : "bg-primary"
              }`}
            />
            <span className="flex-1 text-[13px] text-text-primary">{t.message}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action!.onClick();
                  setToasts((all) => all.filter((x) => x.id !== t.id));
                }}
                className="text-[13px] font-semibold text-primary"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
