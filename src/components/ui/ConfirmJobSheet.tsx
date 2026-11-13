"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import GlideSheet from "@/components/ui/GlideSheet";
import { Button } from "@/components/ui";
import { haptic } from "@/lib/haptics";
import type { JobProgress, JobResult } from "@/lib/admin-api";

type Phase = "confirm" | "running" | "done" | "error";

interface Props<T> {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  tone?: "default" | "danger" | "warning";
  /** What's about to happen (shown before the admin confirms). */
  children: ReactNode;
  confirmLabel: string;
  confirmVariant?: "primary" | "danger";
  /** Headline while running, e.g. "Deleting class day". */
  runningTitle: string;
  /** Does the work. Report steps through `onProgress`; resolve with the outcome. */
  run: (onProgress: (p: JobProgress) => void) => Promise<JobResult<T>>;
  /** Feedback once it succeeded. */
  success: (result: T) => { title: string; body?: ReactNode };
  /** Called when the sheet is closed after a success, so the page can refresh. */
  onFinished?: (result: T) => void;
}

/**
 * Confirm -> live progress -> feedback, in one sheet. Used for anything slow and permanent (deleting a class day, a
 * student account, a course). Can't be dismissed while it's running.
 */
export default function ConfirmJobSheet<T>({
  open, onClose, title, subtitle, icon, tone = "danger", children, confirmLabel, confirmVariant = "danger", runningTitle, run, success, onFinished,
}: Props<T>) {
  const [phase, setPhase] = useState<Phase>("confirm");
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<T | null>(null);
  const resultRef = useRef<T | null>(null);

  useEffect(() => {
    if (open) {
      setPhase("confirm");
      setProgress(null);
      setError("");
      setResult(null);
      resultRef.current = null;
    }
  }, [open]);

  const start = async () => {
    setPhase("running");
    setProgress({ step: "Starting…" });
    const outcome = await run(setProgress);
    if (outcome.ok) {
      haptic([30, 60, 30]);
      resultRef.current = outcome.result;
      setResult(outcome.result);
      setPhase("done");
    } else if (outcome.outOfScope) {
      onClose(); // the "Out of Scope" sheet has taken over
    } else {
      haptic([60, 40, 60]);
      setError(outcome.error);
      setPhase("error");
    }
  };

  const close = () => {
    if (phase === "running") return;
    const finished = phase === "done" ? resultRef.current : null;
    onClose();
    if (finished !== null) onFinished?.(finished);
  };

  const pct = progress?.total ? Math.min(100, Math.round(((progress.done ?? 0) / progress.total) * 100)) : null;
  const done = phase === "done" && result !== null ? success(result) : null;

  return (
    <GlideSheet
      open={open}
      onClose={close}
      tone={phase === "done" ? "default" : tone}
      icon={phase === "done" ? <CheckCircle2 className="h-5 w-5" /> : icon}
      title={phase === "done" && done ? done.title : phase === "running" ? runningTitle : phase === "error" ? "Something went wrong" : title}
      subtitle={phase === "confirm" ? subtitle : undefined}
    >
      {phase === "confirm" && (
        <div className="space-y-4">
          {children}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={close}>Cancel</Button>
            <Button variant={confirmVariant} className="flex-1" onClick={start}>{confirmLabel}</Button>
          </div>
        </div>
      )}

      {phase === "running" && (
        <div className="space-y-4 py-2" aria-live="polite">
          <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-brand-600" />
            <span className="min-w-0 break-words">{progress?.step ?? "Working…"}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined}>
            <div
              className={`h-full rounded-full bg-brand-500 transition-all duration-300 ${pct === null ? "w-1/3 animate-pulse" : ""}`}
              style={pct === null ? undefined : { width: `${pct}%` }}
            />
          </div>
          <p className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Please keep this open until it finishes.</span>
            {pct !== null && <span className="font-mono">{pct}%</span>}
          </p>
        </div>
      )}

      {phase === "done" && done && (
        <div className="space-y-4">
          {done.body && <div className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-800 dark:bg-brand-950/50 dark:text-brand-200">{done.body}</div>}
          <Button className="w-full" onClick={close}>Done</Button>
        </div>
      )}

      {phase === "error" && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Nothing is lost by trying again: it picks up whatever is left.</p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={close}>Close</Button>
            <Button className="flex-1" icon={<RotateCcw className="h-4 w-4" />} onClick={start}>Try again</Button>
          </div>
        </div>
      )}
    </GlideSheet>
  );
}
