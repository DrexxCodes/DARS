"use client";

import { Check } from "lucide-react";
import { Input } from "@/components/ui";
import { SCOPES, SCOPE_GROUPS, MARK_LIMIT, type ScopeKey } from "@/constants/scopes";
import { cn } from "@/lib/utils";

interface Props {
  value: ScopeKey[];
  onChange: (next: ScopeKey[]) => void;
  /** Max students markable per class, as typed ("" = unlimited). */
  markLimit: string;
  onMarkLimitChange: (v: string) => void;
  disabled?: boolean;
}

/** Checklist of scopes grouped by area, with the per-class cap that appears under `student.mark`. */
export default function ScopePicker({ value, onChange, markLimit, onMarkLimitChange, disabled }: Props) {
  const toggle = (key: ScopeKey) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);

  return (
    <div className="space-y-4">
      {SCOPE_GROUPS.map((group) => (
        <div key={group} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{group}</p>
          <div className="space-y-2">
            {SCOPES.filter((s) => s.group === group).map((s) => {
              const on = value.includes(s.key);
              return (
                <div key={s.key} className="space-y-2">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(s.key)}
                    aria-pressed={on}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-colors disabled:opacity-60",
                      on ? "border-brand-500 bg-brand-50 dark:bg-brand-950" : "border-slate-200 hover:border-brand-300 dark:border-slate-700"
                    )}
                  >
                    <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 dark:border-slate-600")}>
                      {on && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900 dark:text-white">{s.label}</span>
                      <span className="block font-mono text-[11px] text-slate-500">{s.key}</span>
                      <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{s.description}</span>
                    </span>
                  </button>
                  {s.key === "student.mark" && on && (
                    <div className="ml-8">
                      <Input
                        label="Students they can mark per class"
                        type="number"
                        inputMode="numeric"
                        min={MARK_LIMIT.MIN}
                        max={MARK_LIMIT.MAX}
                        placeholder="Unlimited"
                        value={markLimit}
                        disabled={disabled}
                        onChange={(e) => onMarkLimitChange(e.target.value)}
                        hint="Counted from when the class starts until it ends. Leave empty for no limit."
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
