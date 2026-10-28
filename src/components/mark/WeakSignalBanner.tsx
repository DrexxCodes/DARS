"use client";

import { Loader2 } from "lucide-react";

/** Top-of-screen notice while the GPS reading is still too rough. Marking is not blocked: the server decides at tap time. */
export default function WeakSignalBanner({ show, accuracy }: { show: boolean; accuracy: number | null }) {
  if (!show) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+3.75rem)] z-[45] mx-auto flex max-w-md animate-slide-up items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800 shadow-lg backdrop-blur dark:border-amber-900 dark:bg-amber-950/80 dark:text-amber-200 md:top-4"
    >
      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      <p>
        DARS is trying to boost accuracy, you may still try to mark
        {accuracy != null && <span className="opacity-70"> (±{accuracy} m)</span>}
      </p>
    </div>
  );
}
