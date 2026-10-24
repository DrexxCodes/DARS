"use client";

import { cn } from "@/lib/utils";
import { DEPARTMENTS } from "@/constants/academics";

interface DepartmentPickerProps {
  value: string[];
  onChange: (departments: string[]) => void;
  disabled?: boolean;
}

/** Multi-select chips for the departments a course is restricted to. No selection = every department. */
export default function DepartmentPicker({ value, onChange, disabled }: DepartmentPickerProps) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((d) => d !== id) : [...value, id]);

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
          All departments
        </button>
        {DEPARTMENTS.map((d) => (
          <button key={d.id} type="button" disabled={disabled} className={chip(value.includes(d.id))} onClick={() => toggle(d.id)}>
            {d.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
        The department comes from the code in the registration number: 133 / 134 for Political Science, 173 / 174 for Political Science Education.
      </p>
    </div>
  );
}
