"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
  /** Classes for the dialog panel. */
  className?: string;
  /** Classes for the backdrop. */
  backdropClassName?: string;
  /** Close when the backdrop is clicked. */
  closeOnBackdrop?: boolean;
}

/**
 * Modal dialog rendered into document.body: traps focus, closes on Escape,
 * makes the rest of the page inert and restores focus on close.
 */
export default function Dialog({
  labelledBy,
  onClose,
  children,
  className = "",
  backdropClassName = "bg-neutral-900/50 backdrop-blur-sm",
  closeOnBackdrop = true,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const host = panel.closest("[data-dialog-host]");
    const siblings = Array.from(document.body.children).filter(
      (element) => element !== host && !element.hasAttribute("inert")
    );
    siblings.forEach((element) => element.setAttribute("inert", ""));

    const focusables = () => Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    (panel.querySelector<HTMLElement>("[data-autofocus]") ?? panel).focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      siblings.forEach((element) => element.removeAttribute("inert"));
      previouslyFocused?.focus?.();
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      data-dialog-host=""
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 ${backdropClassName}`}
      onClick={closeOnBackdrop ? () => onCloseRef.current() : undefined}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`outline-none ${className}`}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
