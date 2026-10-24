"use client";

import { cn } from "@/lib/utils";
import { ADMISSION_TYPES } from "@/constants/academics";

interface AdmissionTypePickerProps {
  value: string[];
  onChange: (types: string[]) => void;
  disabled?: boolean;
}

/** Multi-select chips for the admission types (regular / CEP) a course is for. No selection = both. */
export default function AdmissionTypePicker({ value, onChange, disabled }: AdmissionTypePickerProps) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((t) => t !== id) : [...value, id]);

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
          Regular &amp; CEP
        </button>
        {ADMISSION_TYPES.map((t) => (
          <button key={t.id} type="button" disabled={disabled} className={chip(value.includes(t.id))} onClick={() => toggle(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
        Read from the reg number code: 134 / 174 are Regular, 133 / 173 are CEP. Nothing selected means the course is for both.
      </p>
    </div>
  );
}
