"use client";

import { EyeOff } from "lucide-react";

interface Props {
  checked: boolean;
  busy?: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  hint?: string;
}

/** Checkbox row: "leave this admin's own attendance out of PDF exports". Used on the export card and the admin list. */
export default function ExportVisibilityToggle({
  checked,
  busy,
  onChange,
  label = "Leave my own attendance out of exports",
  hint,
}: Props) {
  return (
    <label className={`flex items-start gap-2.5 text-xs cursor-pointer select-none ${busy ? "opacity-60 pointer-events-none" : ""}`}>
      <input type="checkbox" className="accent-brand-600 mt-0.5" checked={checked} disabled={busy} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-slate-600 dark:text-slate-400">
        <span className="font-medium flex items-center gap-1.5"><EyeOff className="w-3 h-3" /> {label}</span>
        {hint && <span className="block text-slate-400 mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}
