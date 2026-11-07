import { X } from "lucide-react";

/** Panel style shared by every modal dialog. */
export const DIALOG_PANEL_CLASS = "relative w-full rounded-2xl bg-white shadow-2xl sm:rounded-3xl";

interface DialogCloseButtonProps {
  onClick: () => void;
  label?: string;
}

/** The round X in the top-right corner of every modal dialog. */
export default function DialogCloseButton({ onClick, label = "Close" }: DialogCloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 transition-colors hover:bg-neutral-200 hover:text-neutral-900 sm:right-4 sm:top-4"
    >
      <X className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
