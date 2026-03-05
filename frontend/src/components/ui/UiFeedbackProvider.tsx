"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ToastViewport from "@/components/ui/ToastViewport";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
}

export interface ToastOptions {
  type?: "success" | "error" | "info";
  durationMs?: number;
}

interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface UiFeedbackContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  showToast: (message: string, options?: ToastOptions) => void;
}

const UiFeedbackContext = createContext<UiFeedbackContextValue | undefined>(undefined);

export function useUiFeedback() {
  const context = useContext(UiFeedbackContext);
  if (!context) {
    throw new Error("useUiFeedback must be used within UiFeedbackProvider");
  }
  return context;
}

export function UiFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const toastCounterRef = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, options?: ToastOptions) => {
      const id = `${Date.now()}-${toastCounterRef.current++}`;
      const type = options?.type ?? "info";
      const durationMs = options?.durationMs ?? 3500;

      setToasts((prev) => [...prev, { id, message, type }]);

      window.setTimeout(() => {
        dismissToast(id);
      }, durationMs);
    },
    [dismissToast]
  );

  const confirm = useCallback((options: ConfirmOptions) => {
    setConfirmState(options);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const resolveConfirm = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setConfirmState(null);
  }, []);

  useEffect(() => {
    if (!confirmState) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        resolveConfirm(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmState, resolveConfirm]);

  useEffect(() => {
    return () => {
      resolverRef.current?.(false);
    };
  }, []);

  const value = useMemo(
    () => ({
      confirm,
      showToast,
    }),
    [confirm, showToast]
  );

  return (
    <UiFeedbackContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      <ConfirmModal
        open={!!confirmState}
        title={confirmState?.title ?? "Confirm"}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel}
        cancelLabel={confirmState?.cancelLabel}
        tone={confirmState?.tone}
        onCancel={() => resolveConfirm(false)}
        onConfirm={() => resolveConfirm(true)}
      />
    </UiFeedbackContext.Provider>
  );
}
