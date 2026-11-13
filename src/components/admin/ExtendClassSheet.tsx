"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TimerReset } from "lucide-react";
import GlideSheet from "@/components/ui/GlideSheet";
import { Button } from "@/components/ui";
import DurationField from "@/components/admin/DurationField";
import { EXTEND_LIMITS } from "@/constants/class";
import { formatMinutes, toMinutes, type TimeUnit } from "@/lib/class-timing";
import { adminFetch } from "@/lib/admin-api";
import { cn, formatTime } from "@/lib/utils";

export interface ExtendTarget {
  classId: string;
  /** Running = add to the current end time. Ended = re-open it, counting the extra time from now. */
  kind: "running" | "ended";
  label: string;
  startTime: number;
  endTime: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  courseId: string;
  target: ExtendTarget | null;
  onExtended: () => void;
}

/** Sheet for adding time to a running class or re-opening one that was ended. */
export default function ExtendClassSheet({ open, onClose, courseId, target, onExtended }: Props) {
  const [minutes, setMinutes] = useState(EXTEND_LIMITS.PRESETS_MIN[1] as number);
  const [custom, setCustom] = useState("");
  const [unit, setUnit] = useState<TimeUnit>("min");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setMinutes(EXTEND_LIMITS.PRESETS_MIN[1]);
      setCustom("");
      setUnit("min");
    }
  }, [open]);

  const customMinutes = custom.trim() ? toMinutes(Number(custom), unit) : null;
  const chosen = customMinutes ?? minutes;

  const check = useMemo(() => {
    if (!target) return { error: "", newEnd: 0 };
    if (!Number.isFinite(chosen) || chosen < EXTEND_LIMITS.MIN_MIN) return { error: "Enter how long to extend by.", newEnd: 0 };
    const base = target.kind === "running" ? target.endTime : Date.now();
    const newEnd = base + chosen * 60_000;
    const total = Math.round((newEnd - target.startTime) / 60_000);
    if (total > EXTEND_LIMITS.MAX_TOTAL_MIN) return { error: `A class can't run longer than ${EXTEND_LIMITS.MAX_TOTAL_MIN / 60} hours from its start.`, newEnd };
    return { error: "", newEnd };
  }, [target, chosen]);

  if (!target) return null;

  const submit = async () => {
    if (check.error) return;
    setBusy(true);
    const r = await adminFetch<{ reopened: boolean; endTime: number }>("/api/classes", {
      body: { action: "extend", courseId, classId: target.classId, extendMinutes: chosen },
    });
    setBusy(false);
    if (!r.ok) {
      if (!r.outOfScope) toast.error(r.error || "Couldn't extend the class.");
      return;
    }
    toast.success(r.data.reopened ? `Class re-opened until ${formatTime(r.data.endTime)}.` : `Class extended until ${formatTime(r.data.endTime)}.`);
    onClose();
    onExtended();
  };

  return (
    <GlideSheet
      open={open}
      onClose={() => !busy && onClose()}
      icon={<TimerReset className="h-5 w-5" />}
      title={target.kind === "running" ? "Extend this class" : "Re-open this class"}
      subtitle={target.label}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {target.kind === "running"
            ? `Check-in closes at ${formatTime(target.endTime)}. How much longer should it stay open?`
            : "This class was ended. Re-opening it lets students mark again, on the same attendance list, for as long as you choose from now."}
        </p>

        <div className="grid grid-cols-4 gap-2" role="group" aria-label="Extend by">
          {EXTEND_LIMITS.PRESETS_MIN.map((m) => (
            <button
              key={m}
              type="button"
              disabled={busy}
              onClick={() => {
                setMinutes(m);
                setCustom("");
              }}
              className={cn(
                "rounded-xl border-2 px-2 py-2.5 text-sm font-semibold transition-colors",
                customMinutes === null && minutes === m ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "border-slate-200 text-slate-600 hover:border-brand-300 dark:border-slate-700 dark:text-slate-300"
              )}
            >
              {formatMinutes(m)}
            </button>
          ))}
        </div>

        <DurationField label="Or a custom time" value={custom} unit={unit} onValueChange={setCustom} onUnitChange={setUnit} disabled={busy} error={custom.trim() ? check.error : undefined} />

        {!check.error && (
          <div className="rounded-2xl bg-brand-50 p-3 text-sm text-brand-800 dark:bg-brand-950/50 dark:text-brand-200">
            Check-in will stay open until <strong>{formatTime(check.newEnd)}</strong>.
            {target.kind === "ended" && " Students marking after the late cut-off are still marked late."}
          </div>
        )}
        {check.error && !custom.trim() && <p className="text-xs text-red-600 dark:text-red-400">{check.error}</p>}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button className="flex-1" loading={busy} disabled={!!check.error} onClick={submit}>
            {target.kind === "running" ? "Extend" : "Re-open"}
          </Button>
        </div>
      </div>
    </GlideSheet>
  );
}
