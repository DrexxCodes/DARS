"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserMinus } from "lucide-react";
import GlideSheet from "@/components/ui/GlideSheet";
import { Button } from "@/components/ui";
import { delistCourse } from "@/lib/delist-client";
import { haptic } from "@/lib/haptics";

interface Props {
  open: boolean;
  onClose: () => void;
  course: { courseId: string; courseCode: string; courseName: string; attended: number; total: number } | null;
  /** Set when a super admin is delisting this student. Leave out when the student is delisting themselves. */
  student?: { regNumber: string; name: string };
  onDone: () => void;
}

/** Bottom sheet that confirms a delist: permanent, and it wipes the student's attendance for the course. */
export default function DelistSheet({ open, onClose, course, student, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  if (!course) return null;

  const who = student ? student.name || student.regNumber : "you";
  const close = () => !busy && onClose();

  const confirm = async () => {
    setBusy(true);
    const result = await delistCourse(course.courseId, student?.regNumber);
    setBusy(false);
    if (!result.ok) {
      haptic([60, 40, 60]);
      toast.error(result.error);
      return;
    }
    haptic([30, 60, 30]);
    toast.success(student ? `${student.name || student.regNumber} was delisted from ${course.courseCode}.` : `${course.courseCode} was delisted.`);
    onClose();
    onDone();
  };

  return (
    <GlideSheet
      open={open}
      onClose={close}
      tone="danger"
      icon={<UserMinus className="h-5 w-5" />}
      title={`Delist ${course.courseCode}?`}
      subtitle={course.courseName}
    >
      <div className="space-y-4">
        <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          <p className="font-semibold">This is permanent.</p>
          <p className="mt-1">
            {student ? `${who} will be removed from this course and ` : "You'll be removed from this course and "}
            <strong>
              all attendance records for it will be cleared
              {course.attended > 0 ? ` (${course.attended} of ${course.total} class${course.total === 1 ? "" : "es"})` : ""}
            </strong>
            . The course will no longer show in {student ? "their" : "your"} attendance records, and this can&apos;t be undone.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" className="flex-1" loading={busy} onClick={confirm}>
            Delist &amp; clear
          </Button>
        </div>
      </div>
    </GlideSheet>
  );
}
