"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export type ToastType = "success" | "error" | "info";
export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

const ToastContext = createContext<{
  toasts: Toast[];
  showToast: (message: string, type?: ToastType) => void;
}>({ toasts: [], showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = (message: string, type: ToastType = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  };
  return (
    <ToastContext.Provider value={{ toasts, showToast }}>
      {children}
      <div className="fixed z-50 bottom-20 left-1/2 -translate-x-1/2 flex flex-col gap-2 items-center sm:bottom-8">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-2 rounded shadow text-white text-sm font-medium animate-fade-in-up
              ${toast.type === "success" ? "bg-green-600" : toast.type === "error" ? "bg-red-600" : "bg-gray-800"}
            `}
          >
            <center><strong>{toast.type.toUpperCase()}</strong></center><br/>{toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
