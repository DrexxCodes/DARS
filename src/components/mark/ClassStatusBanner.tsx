"use client";

import { useEffect, useState } from "react";
import { getRemainingTime, isClassExpired } from "@/lib/utils";
import { Clock, PauseCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClassStatusBannerProps {
  classActive: boolean;
  checkinPaused: boolean;
  startTime: number | null;
  onExpired: () => void;
}

export default function ClassStatusBanner({
  classActive,
  checkinPaused,
  startTime,
  onExpired,
}: ClassStatusBannerProps) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    if (!classActive || !startTime) return;

    const tick = () => {
      if (isClassExpired(startTime)) {
        onExpired();
        return;
      }
      setRemaining(getRemainingTime(startTime));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [classActive, startTime, onExpired]);

  if (!classActive) return null;

  if (checkinPaused) {
    return (
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300 text-sm font-medium">
        <PauseCircle className="w-4 h-4 shrink-0" />
        Check-in is paused. Your lecturer will resume shortly.
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-sm font-medium",
      "bg-brand-50 dark:bg-brand-950 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300"
    )}>
      <span className="flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        Class is active — check-in open
      </span>
      {startTime && (
        <span className="flex items-center gap-1.5 font-mono text-xs bg-brand-100 dark:bg-brand-900 px-2.5 py-1 rounded-full">
          <Clock className="w-3 h-3" />
          {remaining} left
        </span>
      )}
    </div>
  );
}
