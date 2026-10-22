"use client";

import { useState } from "react";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";
import { Badge, Button, Dialog } from "@/components/ui";
import { clientAuth } from "@/lib/firebase-client";
import { levelLabel } from "@/constants/academics";
import type { CarryoverEntry } from "@/types/mark";

interface Props {
  open: boolean;
  onClose: () => void;
  entries: CarryoverEntry[];
  onChanged: () => void;
}

export default function CarryoverDialog({ open, onClose, entries, onChanged }: Props) {
  const [applying, setApplying] = useState<string | null>(null);

  const apply = async (courseId: string) => {
    setApplying(courseId);
    try {
      const res = await fetch("/api/mark/carryover", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await clientAuth.currentUser?.getIdToken()}` },
        body: JSON.stringify({ courseId }),
      });
      const data = await res.json();
      if (!res.ok) toast.error(data.error || "Couldn't submit your application.");
      else toast.success("Application sent. An admin for the course needs to approve it.");
      onChanged();
    } catch {
      toast.error("Couldn't submit your application.");
    } finally {
      setApplying(null);
    }
  };

  const levels = (e: CarryoverEntry) => e.levels.map(levelLabel).join(", ");

  return (
    <Dialog open={open} onClose={onClose} title="Carry-over Courses" icon={<GraduationCap className="w-5 h-5" />}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Have a course from a lower level? Apply for it here. Once an admin approves, it shows up on your Mark page.
        </p>
        {entries.length === 0 ? (
          <p className="text-sm text-center text-slate-500 dark:text-slate-400 py-3">No other courses available.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 max-h-72 overflow-y-auto">
            {entries.map((e) => (
              <li key={e.courseId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{e.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {e.code}{levels(e) ? ` · ${levels(e)}` : ""}
                  </p>
                </div>
                {e.status === "approved" ? (
                  <Badge variant="green">Approved</Badge>
                ) : e.status === "pending" ? (
                  <Badge variant="yellow">Pending</Badge>
                ) : (
                  <Button size="sm" variant="outline" loading={applying === e.courseId} onClick={() => apply(e.courseId)}>
                    {e.status === "rejected" ? "Apply again" : "Apply"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
