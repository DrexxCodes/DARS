"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface PreloaderProps {
  onComplete?: () => void;
}

export default function Preloader({ onComplete }: PreloaderProps) {
  const [phase, setPhase] = useState<"drawing" | "holding" | "zooming" | "done">("drawing");

  useEffect(() => {
    // Phase 1: draw checkmark (0.9s)
    const t1 = setTimeout(() => setPhase("holding"), 900);
    // Phase 2: hold briefly (300ms)
    const t2 = setTimeout(() => setPhase("zooming"), 1200);
    // Phase 3: zoom out + reveal (500ms)
    const t3 = setTimeout(() => {
      setPhase("done");
      onComplete?.();
    }, 1700);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  if (phase === "done") return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center",
        "bg-brand-600 dark:bg-brand-700",
        "transition-all duration-500",
        phase === "zooming" ? "scale-[20] opacity-0" : "scale-100 opacity-100"
      )}
      style={{
        transformOrigin: "center center",
        transition: phase === "zooming" ? "transform 0.5s ease-in, opacity 0.5s ease-in" : undefined,
      }}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Animated checkmark */}
        <div className="relative w-24 h-24">
          {/* Outer ring */}
          <svg
            viewBox="0 0 100 100"
            className="w-24 h-24 absolute inset-0"
          >
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="4"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="283"
              strokeDashoffset={phase === "drawing" ? "283" : "0"}
              style={{
                transition: "stroke-dashoffset 0.7s ease-in-out",
                transform: "rotate(-90deg)",
                transformOrigin: "50% 50%",
              }}
            />
          </svg>

          {/* Checkmark path */}
          <svg
            viewBox="0 0 100 100"
            className="w-24 h-24 absolute inset-0"
          >
            <polyline
              points="28,52 42,66 72,36"
              fill="none"
              stroke="white"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="70"
              strokeDashoffset={phase === "drawing" ? "70" : "0"}
              style={{
                transition: "stroke-dashoffset 0.5s ease-in-out 0.4s",
              }}
            />
          </svg>
        </div>

        {/* DARS label */}
        <div
          className="text-white text-center"
          style={{
            opacity: phase === "drawing" ? 0 : 1,
            transform: phase === "drawing" ? "translateY(8px)" : "translateY(0)",
            transition: "opacity 0.4s ease 0.7s, transform 0.4s ease 0.7s",
          }}
        >
          <p className="text-2xl font-bold tracking-widest">DARS</p>
          <p className="text-xs text-white/70 tracking-wider mt-0.5">
            Digital Attendance Recording System
          </p>
        </div>
      </div>
    </div>
  );
}
