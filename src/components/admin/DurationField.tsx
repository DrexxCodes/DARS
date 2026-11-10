"use client";

import { cn } from "@/lib/utils";
import type { TimeUnit } from "@/lib/class-timing";

interface Props {
  label: string;
  hint?: string;
  value: string;
  unit: TimeUnit;
  onValueChange: (value: string) => void;
  onUnitChange: (unit: TimeUnit) => void;
  error?: string;
  disabled?: boolean;
}

/** A number box with a minutes / hours pill beside it. The parent owns the state and converts with `toMinutes`. */
export default function DurationField({ label, hint, value, unit, onValueChange, onUnitChange, error, disabled }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={unit === "hr" ? 0.25 : 1}
          value={value}
          disabled={disabled}
          onChange={(e) => onValueChange(e.target.value)}
          aria-label={label}
          className={cn(
            "w-full min-w-0 flex-1 rounded-xl border bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all dark:bg-slate-800 dark:text-white",
            error
              ? "border-red-400 focus:ring-2 focus:ring-red-300"
              : "border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:focus:ring-brand-900"
          )}
        />
        <div role="group" aria-label={`${label} unit`} className="flex shrink-0 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
          {(["min", "hr"] as const).map((u) => (
            <button
              key={u}
              type="button"
              disabled={disabled}
              aria-pressed={unit === u}
              onClick={() => onUnitChange(u)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                unit === u ? "bg-brand-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              {u === "min" ? "Minutes" : "Hours"}
            </button>
          ))}
        </div>
      </div>
      {hint && !error && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
