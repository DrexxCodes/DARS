"use client";

import { Trash2 } from "lucide-react";
import ConfirmJobSheet from "@/components/ui/ConfirmJobSheet";
import { runJob } from "@/lib/admin-api";

interface Result {
  recordsCleared: number;
  coursesCleared: number;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  student: { regNumber: string; name: string };
  /** The student no longer exists: clear the lookup. */
  onDeleted: () => void;
}

/** Permanently deletes a student's account, details and attendance, with live progress and a result summary. */
export default function DeleteStudentSheet({ open, onClose, student, onDeleted }: Props) {
  const who = student.name || student.regNumber;
  return (
    <ConfirmJobSheet<Result>
      open={open}
      onClose={onClose}
      icon={<Trash2 className="h-5 w-5" />}
      title="Delete this student?"
      subtitle={`${who} · ${student.regNumber}`}
      confirmLabel="Delete everything"
      runningTitle="Deleting student"
      run={(onProgress) => runJob<Result>(`/api/admin/students/${encodeURIComponent(student.regNumber)}/account`, { method: "DELETE" }, onProgress)}
      success={(r) => ({
        title: "Student deleted",
        body: (
          <p>
            <strong>{who}</strong> was deleted: their login, profile and details are gone, along with{" "}
            <strong>{r.recordsCleared}</strong> attendance record{r.recordsCleared === 1 ? "" : "s"}
            {r.coursesCleared > 0 ? ` across ${r.coursesCleared} course${r.coursesCleared === 1 ? "" : "s"}` : ""}.
          </p>
        ),
      })}
      onFinished={onDeleted}
    >
      <div className="space-y-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
        <p className="font-semibold">This is permanent and can&apos;t be undone.</p>
        <p>
          It removes their login account, profile and details, <strong>every attendance record</strong>, their course enrolments and their linked device.
          Class counts and attendance totals are corrected to match.
        </p>
        <p className="text-xs">
          Accounts are shared across Drexx apps (for example NPS), so deleting the login also removes it there. If they only need to be locked out for now, use <strong>Disable</strong> instead.
        </p>
      </div>
    </ConfirmJobSheet>
  );
}
