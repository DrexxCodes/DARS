"use client";

import { Trash2 } from "lucide-react";
import ConfirmJobSheet from "@/components/ui/ConfirmJobSheet";
import { runJob } from "@/lib/admin-api";

interface Result {
  studentsAffected: number;
  date: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  courseId: string;
  session: { id: string; date: string; name?: string | null } | null;
  onDeleted: () => void;
}

/** Deletes one class day with live progress and a summary of what was removed. */
export default function DeleteClassSheet({ open, onClose, courseId, session, onDeleted }: Props) {
  if (!session) return null;
  const label = session.name ? `${session.name} · ${session.date}` : session.date;
  return (
    <ConfirmJobSheet<Result>
      open={open}
      onClose={onClose}
      icon={<Trash2 className="h-5 w-5" />}
      title="Delete this class day?"
      subtitle={label}
      confirmLabel="Delete class"
      runningTitle="Deleting class day"
      run={(onProgress) => runJob<Result>("/api/classes", { method: "DELETE", body: { courseId, classId: session.id } }, onProgress)}
      success={(r) => ({
        title: "Class day deleted",
        body: (
          <p>
            <strong>{label}</strong> was deleted. {r.studentsAffected} attendance record{r.studentsAffected === 1 ? "" : "s"} removed and every affected student&apos;s attendance was recalculated.
          </p>
        ),
      })}
      onFinished={onDeleted}
    >
      <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
        <p className="font-semibold">This is permanent.</p>
        <p className="mt-1">
          The class held on <strong>{session.date}</strong> and every student&apos;s attendance record for it will be removed, and attendance percentages recalculated. If the class is running, check-in closes first.
        </p>
      </div>
    </ConfirmJobSheet>
  );
}
