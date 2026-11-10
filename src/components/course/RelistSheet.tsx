"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import GlideSheet from "@/components/ui/GlideSheet";
import { Button } from "@/components/ui";
import { relistCourse } from "@/lib/relist-client";
import { haptic } from "@/lib/haptics";

interface Props {
  open: boolean;
  onClose: () => void;
  course: { courseId: string; courseCode: string; courseName: string } | null;
  student: { regNumber: string; name: string };
  onDone: () => void;
}

/** Bottom sheet where a super admin adds a delisted student back to a course. */
export default function RelistSheet({ open, onClose, course, student, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  if (!course) return null;

  const who = student.name || student.regNumber;
  const close = () => !busy && onClose();

  const confirm = async () => {
    setBusy(true);
    const result = await relistCourse(course.courseId, student.regNumber);
    setBusy(false);
    if (!result.ok) {
      haptic([60, 40, 60]);
      toast.error(result.error);
      return;
    }
    haptic([30, 60, 30]);
    toast.success(`${who} was added back to ${course.courseCode}.`);
    onClose();
    onDone();
  };

  return (
    <GlideSheet open={open} onClose={close} icon={<UserPlus className="h-5 w-5" />} title={`Add back to ${course.courseCode}?`} subtitle={course.courseName}>
      <div className="space-y-4">
        <div className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-800 dark:bg-brand-950/50 dark:text-brand-200">
          <p>
            {who} will see this course again and can mark attendance from the next class.
          </p>
          <p className="mt-2 font-semibold">
            Their earlier attendance for it was cleared when they delisted, and it won&apos;t come back.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button className="flex-1" loading={busy} onClick={confirm}>
            Add back
          </Button>
        </div>
      </div>
    </GlideSheet>
  );
}
