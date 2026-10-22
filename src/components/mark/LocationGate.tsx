"use client";

import { Button, Card } from "@/components/ui";
import { MapPin, AlertTriangle } from "lucide-react";

interface LocationGateProps {
  /** Only the two states the student can't continue from. Everything else is handled inline on the mark page. */
  status: "denied" | "unsupported";
  onRetry: () => void;
}

export default function LocationGate({ status, onRetry }: LocationGateProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-md">
        <Card className="p-6 text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-brand-100 dark:bg-brand-950 flex items-center justify-center mx-auto">
            <MapPin className="w-8 h-8 text-brand-600 dark:text-brand-400" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Location Required</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              DARS confirms you&apos;re on campus before marking attendance. Please allow location access to continue.
            </p>
          </div>

          {status === "denied" && (
            <div className="flex items-start gap-2 text-left bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-sm p-3 rounded-lg">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Location access was denied. On iPhone: Settings → Privacy &amp; Security → Location Services → Safari Websites
                (or DARS) → While Using. On Android: tap the lock icon in the address bar → Permissions → Location → Allow.
                Then tap Try Again.
              </span>
            </div>
          )}

          {status === "unsupported" && (
            <div className="flex items-start gap-2 text-left bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-sm p-3 rounded-lg">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Your browser doesn&apos;t support location services. Try a different browser.</span>
            </div>
          )}

          <Button className="w-full" size="lg" onClick={onRetry} icon={<MapPin className="w-5 h-5" />}>
            Try Again
          </Button>
        </Card>
      </div>
    </div>
  );
}
