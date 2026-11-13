"use client";

import { CalendarOff } from "lucide-react";
import GlideSheet from "@/components/ui/GlideSheet";
import { Button } from "@/components/ui";

interface Props {
  open: boolean;
  onClose: () => void;
  course: { name: string; code: string } | null;
}

/** Shown when a student taps a course that has no class running. */
export default function NoActiveClassSheet({ open, onClose, course }: Props) {
  return (
    <GlideSheet open={open} onClose={onClose} tone="warning" icon={<CalendarOff className="h-5 w-5" />} title="No active class" subtitle={course ? `${course.code} · ${course.name}` : undefined}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          There&apos;s no active class for this course at the moment. Check-in opens when your lecturer starts the class, so try again then.
        </p>
        <Button variant="outline" className="w-full" onClick={onClose}>
          OK
        </Button>
      </div>
    </GlideSheet>
  );
}
