"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, UserCheck } from "lucide-react";
import { Button, Dialog, Select, Spinner } from "@/components/ui";
import { clientAuth } from "@/lib/firebase-client";
import { formatDisplayDate, formatTime } from "@/lib/utils";
import type { MarkableSession } from "@/types/admin";

interface CourseOption {
  courseId: string;
  courseName: string;
  courseCode: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after a successful mark so the parent can reload the student's numbers. */
  onDone: () => void;
  student: { regNumber: string; name: string };
  courses: CourseOption[];
}

export default function MarkPresentDialog({ open, onClose, onDone, student, courses }: Props) {
  const [courseId, setCourseId] = useState("");
  const [sessions, setSessions] = useState<MarkableSession[] | null>(null);
  const [eligible, setEligible] = useState(true);
  const [classId, setClassId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const base = `/api/admin/students/${student.regNumber}/mark`;
  const authHeaders = async () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${await clientAuth.currentUser?.getIdToken()}`,
  });

  // Fresh start every time the dialog opens
  useEffect(() => {
    if (open) {
      setCourseId(courses[0]?.courseId ?? "");
      setSessions(null);
      setClassId("");
    }
  }, [open, courses]);

  const loadSessions = async (id: string) => {
    if (!id) return;
    setLoading(true);
    setSessions(null);
    setClassId("");
    try {
      const res = await fetch(`${base}?courseId=${encodeURIComponent(id)}`, { headers: await authHeaders() });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Couldn't load classes.");
        return;
      }
      const list: MarkableSession[] = data.sessions;
      setSessions(list);
      setEligible(data.eligible !== false);
      setClassId(list.find((s) => !s.present)?.id ?? ""); // default to the newest class they missed
    } catch {
      toast.error("Couldn't load classes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && courseId) loadSessions(courseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, courseId]);

  const mark = async () => {
    if (!classId) return;
    setSaving(true);
    try {
      const res = await fetch(base, { method: "POST", headers: await authHeaders(), body: JSON.stringify({ courseId, classId }) });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Couldn't mark attendance.");
        if (res.status === 409) loadSessions(courseId);
        return;
      }
      toast.success(`${student.name} marked present.`);
      onDone();
      onClose();
    } catch {
      toast.error("Couldn't mark attendance.");
    } finally {
      setSaving(false);
    }
  };

  const label = (s: MarkableSession) =>
    `${formatDisplayDate(s.date)} · ${formatTime(s.startTime)}${s.locationName ? ` · ${s.locationName}` : ""}${s.present ? " ✓ present" : ""}`;

  const missed = sessions?.filter((s) => !s.present) ?? [];

  return (
    <Dialog open={open} onClose={onClose} title="Mark Present for a Class" icon={<UserCheck className="w-5 h-5" />}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Records <strong>{student.name}</strong> as present for a class they attended. This skips the location and device checks.
        </p>

        <Select
          label="Course"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          options={courses.map((c) => ({ value: c.courseId, label: `${c.courseCode} · ${c.courseName}` }))}
        />

        {loading && (
          <div className="flex justify-center py-3"><Spinner /></div>
        )}

        {!loading && sessions !== null && sessions.length === 0 && (
          <p className="text-sm text-center text-slate-500 dark:text-slate-400 py-2">No classes have been held for this course yet.</p>
        )}

        {!loading && sessions !== null && !eligible && (
          <p className="text-sm rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 p-3">
            {student.name} isn&apos;t in this course&apos;s level and has no approved carry-over, so they can&apos;t be marked present. They can apply for it from the Mark page, then you can approve it on the Classes page.
          </p>
        )}

        {!loading && sessions !== null && eligible && sessions.length > 0 && (
          <>
            {missed.length === 0 ? (
              <p className="flex items-center justify-center gap-1.5 text-sm text-brand-700 dark:text-brand-300 py-2">
                <CheckCircle2 className="w-4 h-4" /> Already present for every class.
              </p>
            ) : (
              <Select
                label="Class"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                options={sessions.map((s) => ({ value: s.id, label: label(s) }))}
              />
            )}
            <Button
              className="w-full"
              loading={saving}
              disabled={!classId || sessions.find((s) => s.id === classId)?.present}
              onClick={mark}
              icon={<UserCheck className="w-4 h-4" />}
            >
              Mark present
            </Button>
          </>
        )}
      </div>
    </Dialog>
  );
}
