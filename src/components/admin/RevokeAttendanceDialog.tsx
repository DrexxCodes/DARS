"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Ban, Search } from "lucide-react";
import { Button, Dialog, Input, Select } from "@/components/ui";
import { clientAuth } from "@/lib/firebase-client";
import { formatTime, todayKey } from "@/lib/utils";
import type { RevokeRecord } from "@/types/admin";

interface CourseOption {
  courseId: string;
  courseName: string;
  courseCode: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after a successful revoke so the parent can reload the student's numbers. */
  onDone: () => void;
  student: { regNumber: string; name: string };
  courses: CourseOption[];
}

export default function RevokeAttendanceDialog({ open, onClose, onDone, student, courses }: Props) {
  const [date, setDate] = useState(todayKey());
  const [courseId, setCourseId] = useState("all");
  const [records, setRecords] = useState<RevokeRecord[] | null>(null);
  const [finding, setFinding] = useState(false);
  const [revoking, setRevoking] = useState(false);

  // Fresh start every time the dialog opens
  useEffect(() => {
    if (open) {
      setDate(todayKey());
      setCourseId("all");
      setRecords(null);
    }
  }, [open]);

  const authHeaders = async () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${await clientAuth.currentUser?.getIdToken()}`,
  });

  const base = `/api/admin/students/${student.regNumber}/revoke`;

  const find = async () => {
    if (!date) return;
    setFinding(true);
    setRecords(null);
    try {
      const params = new URLSearchParams({ date, ...(courseId !== "all" ? { courseId } : {}) });
      const res = await fetch(`${base}?${params}`, { headers: await authHeaders() });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Couldn't look up attendance.");
        return;
      }
      setRecords(data.records);
    } catch {
      toast.error("Couldn't look up attendance.");
    } finally {
      setFinding(false);
    }
  };

  const revoke = async () => {
    setRevoking(true);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ date, ...(courseId !== "all" ? { courseId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Couldn't revoke attendance.");
        return;
      }
      toast.success(`Revoked ${data.revoked} record${data.revoked === 1 ? "" : "s"} for ${student.name}.`);
      onDone();
      onClose();
    } catch {
      toast.error("Couldn't revoke attendance.");
    } finally {
      setRevoking(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Revoke Attendance for a Day" variant="danger" icon={<Ban className="w-5 h-5" />}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Removes <strong>{student.name}</strong>&apos;s attendance for the day you pick. Their percentage drops immediately.
        </p>

        <Input
          label="Day"
          type="date"
          value={date}
          onChange={(e) => { setDate(e.target.value); setRecords(null); }}
        />

        <Select
          label="Course"
          value={courseId}
          onChange={(e) => { setCourseId(e.target.value); setRecords(null); }}
          options={[
            { value: "all", label: courses.length > 1 ? "All my courses" : "My course" },
            ...courses.map((c) => ({ value: c.courseId, label: `${c.courseCode} · ${c.courseName}` })),
          ]}
        />

        {records === null && (
          <Button className="w-full" variant="outline" loading={finding} onClick={find} icon={<Search className="w-4 h-4" />}>
            Find attendance
          </Button>
        )}

        {records !== null && records.length === 0 && (
          <p className="text-sm text-center text-slate-500 dark:text-slate-400 py-2">No attendance found for that day.</p>
        )}

        {records !== null && records.length > 0 && (
          <div className="space-y-3">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm">
              {records.map((r) => (
                <li key={`${r.courseId}-${r.classId}`} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    {r.courseCode || r.courseName}
                    {r.late && <span className="ml-2 text-xs text-orange-600 dark:text-orange-400">late</span>}
                  </span>
                  <span className="text-xs text-slate-500">{formatTime(r.timestamp)}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              The phone that marked these stays blocked for that class. If this was a mistake, use &quot;Mark for another student&quot; to re-mark them.
            </p>
            <Button className="w-full" variant="danger" loading={revoking} onClick={revoke}>
              Revoke {records.length} record{records.length === 1 ? "" : "s"}
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
