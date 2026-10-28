"use client";

import { usePathname } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { isSsoInlinePage, useSsoContinue } from "@/hooks/useSsoContinue";
import { PLATFORMS, SELF } from "@/lib/sso/platforms";

/** "You're already signed in to NPS. Continue here?" Shown to signed-out visitors when the other app has a live session. */
export default function SsoPrompt() {
  const pathname = usePathname();
  // Sign-in and register pages show the inline block (SsoInline) instead.
  const { offer, busy, accept, dismiss } = useSsoContinue({ enabled: !isSsoInlinePage(pathname) });
  if (!offer) return null;
  const self = PLATFORMS[SELF].name;

  return (
    <div
      role="region"
      aria-label={`Continue with ${offer.name}`}
      className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4rem)] z-[70] mx-auto max-w-sm animate-slide-up rounded-2xl border border-white/60 bg-white/80 p-4 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/80 md:inset-x-auto md:right-4 md:top-4 md:mx-0"
    >
      <button onClick={dismiss} aria-label="Not now" className="absolute right-2.5 top-2.5 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
        <X className="h-4 w-4" />
      </button>
      <div className="pr-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Welcome back, {offer.firstName}</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            You&apos;re already signed in to {offer.name} on this device. Continue to {self} without a password?
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={accept}
          disabled={busy}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Continue as {offer.firstName}
        </button>
        <button onClick={dismiss} disabled={busy} className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
          Not now
        </button>
      </div>
    </div>
  );
}
