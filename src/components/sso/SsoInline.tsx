"use client";

import { Loader2 } from "lucide-react";
import { useSsoContinue } from "@/hooks/useSsoContinue";

/** Fixed block for the sign-in pages: shown whenever the other app has a live session on this device. */
export default function SsoInline() {
  const { offer, busy, accept } = useSsoContinue({ ignoreDismissed: true });
  if (!offer) return null;

  return (
    <div className="mb-5 space-y-3">
      <div className="rounded-2xl border border-brand-200 bg-brand-50/80 p-4 backdrop-blur dark:border-brand-900 dark:bg-brand-950/60">
        <p className="text-sm text-slate-700 dark:text-slate-200">
          You&apos;re signed in to <strong>{offer.name}</strong> on this device as <strong>{offer.firstName}</strong>.
        </p>
      </div>
      <button
        onClick={accept}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Continue with {offer.name}
      </button>
      <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        or sign in with your email
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
}
