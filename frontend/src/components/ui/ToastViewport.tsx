interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastViewportProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export default function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[7100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => {
        const typeClass =
          toast.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : toast.type === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-blue-200 bg-blue-50 text-blue-800";

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto rounded-xl border px-3 py-2 text-sm shadow-lg ${typeClass}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="leading-5">{toast.message}</p>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => onDismiss(toast.id)}
                className="shrink-0 rounded-md px-1 text-xs opacity-70 hover:opacity-100"
              >
                x
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
