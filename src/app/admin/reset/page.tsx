"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { Card, Button, Input, Skeleton } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { clientAuth } from "@/lib/firebase-client";
import { RESET_PHRASE } from "@/constants/reset";
import type { ResetCounts } from "@/types/admin";

const DELETED = [
  "Every class session and the class history",
  "Every student's attendance history",
  "Live classes are ended and attendance percentages go back to 0",
];
const KEPT = ["Student accounts", "Courses", "Admins", "Location tags", "The activity log (a reset entry is added)"];

export default function ResetPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [counts, setCounts] = useState<ResetCounts | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [typed, setTyped] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!authLoading && (!profile || profile.scope !== "super")) router.push("/");
  }, [authLoading, profile, router]);

  const fetchCounts = useCallback(async () => {
    setLoadingCounts(true);
    try {
      const token = await clientAuth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/reset", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setCounts(data.counts ?? null);
    } catch {
      setCounts(null);
    } finally {
      setLoadingCounts(false);
    }
  }, []);

  useEffect(() => { if (profile?.scope === "super") fetchCounts(); }, [profile, fetchCounts]);

  const handleReset = async () => {
    setResetting(true);
    try {
      const token = await clientAuth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirmation: typed }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Reset failed.");
        return;
      }
      toast.success("Reset complete. All classes and attendance history are gone.");
      setTyped("");
      fetchCounts();
    } catch {
      toast.error("Reset didn't finish. Run it again to complete it.");
    } finally {
      setResetting(false);
    }
  };

  if (authLoading || profile?.scope !== "super") return null;

  const matches = typed.trim() === RESET_PHRASE;
  const stat = (label: string, value: number | null | undefined) => (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800 px-3 py-2 text-center">
      <p className="text-lg font-bold text-slate-900 dark:text-white">{value ?? "–"}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Reset</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Start a fresh semester. This can&apos;t be undone.</p>
      </div>

      <Card className="p-5 space-y-5 border-red-200 dark:border-red-900">
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-sm p-3 rounded-lg">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Everything listed under &quot;Deleted&quot; is removed permanently for all students and all courses.</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {loadingCounts ? <Skeleton className="h-14 col-span-3" /> : (
            <>
              {stat("class sessions", counts?.sessions)}
              {stat("attendance records", counts?.records)}
              {stat("students (kept)", counts?.students)}
            </>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-semibold text-red-600 dark:text-red-400 mb-2">Deleted</p>
            <ul className="space-y-1.5">
              {DELETED.map((t) => (
                <li key={t} className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                  <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-brand-600 dark:text-brand-400 mb-2">Kept</p>
            <ul className="space-y-1.5">
              {KEPT.map((t) => (
                <li key={t} className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-brand-500" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <Input
            label={`Type "${RESET_PHRASE}" to approve`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && matches && !resetting && handleReset()}
            placeholder={RESET_PHRASE}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="font-mono"
          />
          <Button
            variant="danger"
            className="w-full"
            size="lg"
            disabled={!matches}
            loading={resetting}
            onClick={handleReset}
            icon={<RotateCcw className="w-4 h-4" />}
          >
            Delete all classes &amp; attendance
          </Button>
        </div>
      </Card>
    </div>
  );
}
