"use client";

import { Loader2, MapPin, MapPinOff, RefreshCw, SignalLow } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LocationStatus as Status } from "@/hooks/useLocationFix";

interface LocationStatusProps {
  status: Status;
  accuracy: number | null;
  onRetry: () => void;
}

/** Small non-blocking pill that tells the student how their location lookup is going. */
export default function LocationStatus({ status, accuracy, onRetry }: LocationStatusProps) {
  if (status === "idle" || status === "denied" || status === "unsupported") return null;

  const tone =
    status === "ready"
      ? "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-950 dark:text-brand-300 dark:border-brand-800"
      : status === "unavailable"
        ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900"
        : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900";

  return (
    <div className="flex justify-center">
      <div
        role="status"
        aria-live="polite"
        className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium", tone)}
      >
        {status === "locating" && (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Finding your location…
          </>
        )}
        {status === "ready" && (
          <>
            <MapPin className="w-3.5 h-3.5" />
            Location ready{accuracy != null ? ` · ±${accuracy} m` : ""}
          </>
        )}
        {status === "weak" && (
          <>
            <SignalLow className="w-3.5 h-3.5" />
            Improving signal{accuracy != null ? ` (±${accuracy} m)` : ""} — near a window is best
          </>
        )}
        {status === "unavailable" && (
          <>
            <MapPinOff className="w-3.5 h-3.5" />
            Can&apos;t find you yet
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 underline underline-offset-2 font-semibold"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          </>
        )}
      </div>
    </div>
  );
}
