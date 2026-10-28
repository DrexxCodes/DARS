"use client";

import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";

interface GlideSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
}

/**
 * Frosted bottom sheet that glides up from the bottom edge (all screen sizes, width-capped on large ones).
 * `data-gate-sheet` lets the profile gate know taps inside it are the answer, not a blocked action.
 */
export default function GlideSheet({ open, onClose, title, subtitle, icon, children }: GlideSheetProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div data-gate-sheet className="fixed inset-0 z-[80] flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" />
      <div className="relative w-full max-w-md rounded-t-3xl border-t border-white/60 bg-white/85 px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl backdrop-blur-xl animate-sheet-up dark:border-white/10 dark:bg-slate-900/85 sm:mb-6 sm:rounded-3xl sm:border sm:pb-6">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200">
          <X className="h-4 w-4" />
        </button>
        <div className="mb-5 flex items-center gap-3 pr-8">
          {icon && <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-950 dark:text-brand-400">{icon}</div>}
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
