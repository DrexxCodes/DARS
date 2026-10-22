"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, GraduationCap, X } from "lucide-react";
import { Badge, Button, Card, Skeleton } from "@/components/ui";
import { clientAuth } from "@/lib/firebase-client";
import { levelLabel } from "@/constants/academics";
import type { CarryoverRequest } from "@/types/admin";

/** Carry-over applications for the selected course. Any admin of the course (or a super admin) can decide. */
export default function CarryoverRequestsCard({ courseId }: { courseId: string }) {
  const [requests, setRequests] = useState<CarryoverRequest[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const headers = async () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${await clientAuth.currentUser?.getIdToken()}`,
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/carryover?courseId=${encodeURIComponent(courseId)}`, { headers: await headers() });
      const data = await res.json();
      setRequests(res.ok ? data.requests : []);
    } catch {
      setRequests([]);
    }
  }, [courseId]);

  useEffect(() => {
    setRequests(null);
    load();
  }, [load]);

  const decide = async (r: CarryoverRequest, decision: "approve" | "reject") => {
    setBusy(r.regNumber);
    try {
      const res = await fetch("/api/admin/carryover", {
        method: "POST",
        headers: await headers(),
        body: JSON.stringify({ courseId, regNumber: r.regNumber, decision }),
      });
      const data = await res.json();
      if (!res.ok) toast.error(data.error || "Couldn't save your decision.");
      else toast.success(decision === "approve" ? `${r.name} approved.` : r.status === "approved" ? `${r.name} removed.` : `${r.name} declined.`);
      load();
    } catch {
      toast.error("Couldn't save your decision.");
    } finally {
      setBusy(null);
    }
  };

  const pending = requests?.filter((r) => r.status === "pending") ?? [];
  const approved = requests?.filter((r) => r.status === "approved") ?? [];

  const Row = ({ r }: { r: CarryoverRequest }) => (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-sm">
      <div className="min-w-0">
        <p className="font-medium text-slate-900 dark:text-white truncate">{r.name}</p>
        <p className="text-xs text-slate-400 font-mono">
          {r.regNumber}
          {r.level ? ` · ${levelLabel(r.level)}` : ""}
        </p>
      </div>
      {r.status === "pending" ? (
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" disabled={busy === r.regNumber} onClick={() => decide(r, "reject")} icon={<X className="w-3.5 h-3.5" />}>
            Decline
          </Button>
          <Button size="sm" loading={busy === r.regNumber} onClick={() => decide(r, "approve")} icon={<Check className="w-3.5 h-3.5" />}>
            Approve
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" className="text-red-600 dark:text-red-400 shrink-0" loading={busy === r.regNumber} onClick={() => decide(r, "reject")}>
          Remove
        </Button>
      )}
    </div>
  );

  return (
    <Card className="p-6">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-4 flex items-center gap-2">
        <GraduationCap className="w-4 h-4" /> Carry-over Students
        {pending.length > 0 && <Badge variant="orange">{pending.length} pending</Badge>}
      </h2>
      {requests === null ? (
        <Skeleton className="h-14" />
      ) : requests.length === 0 ? (
        <p className="text-sm text-slate-400">
          No carry-over applications. Students from other levels can apply from the Mark page; approved students are added to this course&apos;s attendance and exports.
        </p>
      ) : (
        <div className="space-y-4">
          {pending.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Waiting for approval</p>
              {pending.map((r) => <Row key={r.regNumber} r={r} />)}
            </div>
          )}
          {approved.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Approved</p>
              {approved.map((r) => <Row key={r.regNumber} r={r} />)}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
