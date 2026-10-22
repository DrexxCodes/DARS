"use client";

import { cn } from "@/lib/utils";
import { LEVELS, levelLabel } from "@/constants/academics";

interface LevelPickerProps {
  value: number[];
  onChange: (levels: number[]) => void;
  disabled?: boolean;
}

/** Multi-select chips for the levels (student classes) a course is assigned to. No selection = every level. */
export default function LevelPicker({ value, onChange, disabled }: LevelPickerProps) {
  const toggle = (level: number) =>
    onChange(value.includes(level) ? value.filter((l) => l !== level) : [...value, level].sort((a, b) => a - b));

  const chip = (active: boolean) =>
    cn(
      "px-3 py-1.5 rounded-full border-2 text-xs font-medium transition-colors disabled:opacity-50",
      active
        ? "border-brand-500 bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300"
        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-brand-300"
    );

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled} className={chip(value.length === 0)} onClick={() => onChange([])}>
          All levels
        </button>
        {LEVELS.map((level) => (
          <button key={level} type="button" disabled={disabled} className={chip(value.includes(level))} onClick={() => toggle(level)}>
            {levelLabel(level)}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
        Students only see and can mark courses assigned to their level. A student&apos;s level comes from the admission year in
        their registration number (the session rolls over each October).
      </p>
    </div>
  );
}
