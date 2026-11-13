"use client";

import { Trash2 } from "lucide-react";
import ConfirmJobSheet from "@/components/ui/ConfirmJobSheet";
import { runJob } from "@/lib/admin-api";

interface Result {
  recordsRemoved: number;
  courseName: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  course: { id: string; name: string; code: string } | null;
  onDeleted: () => void;
}

/** Deletes a whole course with live progress. */
export default function DeleteCourseSheet({ open, onClose, course, onDeleted }: Props) {
  if (!course) return null;
  return (
    <ConfirmJobSheet<Result>
      open={open}
      onClose={onClose}
      icon={<Trash2 className="h-5 w-5" />}
      title="Delete this course?"
      subtitle={`${course.code} · ${course.name}`}
      confirmLabel="Delete permanently"
      runningTitle="Deleting course"
      run={(onProgress) => runJob<Result>("/api/classes", { method: "DELETE", body: { courseId: course.id } }, onProgress)}
      success={(r) => ({
        title: "Course deleted",
        body: (
          <p>
            <strong>{r.courseName}</strong> and everything under it were deleted, including {r.recordsRemoved} attendance record{r.recordsRemoved === 1 ? "" : "s"}.
          </p>
        ),
      })}
      onFinished={onDeleted}
    >
      <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
        <p className="font-semibold">This is permanent.</p>
        <p className="mt-1">
          Every class session, activity log entry, enrolment and student attendance record tied to <strong>{course.name}</strong> will be deleted. This can&apos;t be undone.
        </p>
      </div>
    </ConfirmJobSheet>
  );
}
