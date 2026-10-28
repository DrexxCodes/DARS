"use client";

import { useId, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { MONTHS } from "@/constants/birthday";
import { daysInMonth, yearOptions } from "@/lib/birthday";
import { cn } from "@/lib/utils";
import type { DobParts } from "@/types/birthday";

interface Props {
  value: DobParts;
  onChange: (next: DobParts) => void;
  disabled?: boolean;
  invalid?: boolean;
}

interface PickerProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  invalid?: boolean;
}

function Picker({ id, label, placeholder, value, onChange, options, disabled, invalid }: PickerProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</label>
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full appearance-none rounded-xl border bg-white/80 py-3 pl-3.5 pr-8 text-sm text-slate-900 outline-none transition-all dark:bg-slate-800/80 dark:text-white",
            "focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-900 disabled:opacity-60",
            invalid ? "border-red-400" : "border-slate-200 dark:border-slate-700",
            !value && "text-slate-400 dark:text-slate-500"
          )}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value} className="text-slate-900 dark:text-white">{o.label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}

/** Day / Month / Year, in that order. Choices only, so a bad date can't be typed; the day list follows the month and year. */
export default function DateOfBirthFields({ value, onChange, disabled, invalid }: Props) {
  const uid = useId();
  const years = useMemo(() => yearOptions().map((y) => ({ value: String(y), label: String(y) })), []);
  const months = useMemo(() => MONTHS.map((m, i) => ({ value: String(i + 1), label: m })), []);
  const days = useMemo(
    () => Array.from({ length: daysInMonth(Number(value.month) || 1, Number(value.year) || undefined) }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
    [value.month, value.year]
  );

  const set = (patch: Partial<DobParts>) => {
    const next = { ...value, ...patch };
    // A day that no longer exists in the new month/year (31 Feb) is cleared rather than silently changed.
    if (next.day && Number(next.day) > daysInMonth(Number(next.month) || 1, Number(next.year) || undefined)) next.day = "";
    onChange(next);
  };

  return (
    <div className="grid grid-cols-[1fr_1.7fr_1.2fr] gap-2.5">
      <Picker id={`${uid}-day`} label="Day" placeholder="Day" value={value.day} onChange={(day) => set({ day })} options={days} disabled={disabled} invalid={invalid} />
      <Picker id={`${uid}-month`} label="Month" placeholder="Month" value={value.month} onChange={(month) => set({ month })} options={months} disabled={disabled} invalid={invalid} />
      <Picker id={`${uid}-year`} label="Year" placeholder="Year" value={value.year} onChange={(year) => set({ year })} options={years} disabled={disabled} invalid={invalid} />
    </div>
  );
}
