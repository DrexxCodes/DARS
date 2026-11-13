"use client";

import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface GlideSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  /** "danger" tints the icon red, "warning" amber. */
  tone?: "default" | "danger" | "warning";
  children: ReactNode;
}

const TONES = {
  default: "bg-brand-100 text-brand-600 dark:bg-brand-950 dark:text-brand-400",
  danger: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
  warning: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
} as const;

/**
 * Every popup in the app. On phones it's a frosted bottom sheet that glides up; from `md` up it's a drawer that slides in
 * from the right edge. (The old centred dialogs are built on this too, see `Dialog` in components/ui.)
 * `data-gate-sheet` lets the profile gate know taps inside it are the answer, not a blocked action.
 */
export default function GlideSheet({ open, onClose, title, subtitle, icon, tone = "default", children }: GlideSheetProps) {
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
    <div data-gate-sheet className="fixed inset-0 z-[80] flex items-end justify-center md:justify-end" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" />
      <div
        className={cn(
          "relative flex w-full max-w-lg flex-col overflow-y-auto overscroll-contain border-white/60 bg-white/90 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90",
          // phone: bottom sheet
          "max-h-[92dvh] animate-sheet-up rounded-t-3xl border-t px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3",
          // md+: full-height drawer from the right
          "md:h-full md:max-h-none md:max-w-md md:animate-drawer-in md:rounded-none md:rounded-l-3xl md:border-l md:border-t-0 md:px-6 md:pb-8 md:pt-[calc(1.5rem+env(safe-area-inset-top))]"
        )}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 shrink-0 rounded-full bg-slate-300 dark:bg-slate-700 md:hidden" />
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 md:top-[calc(1rem+env(safe-area-inset-top))]">
          <X className="h-4 w-4" />
        </button>
        <div className="mb-5 flex items-center gap-3 pr-8">
          {icon && <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", TONES[tone])}>{icon}</div>}
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
