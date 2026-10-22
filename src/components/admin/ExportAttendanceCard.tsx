"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileDown } from "lucide-react";
import { Button, Card, Select } from "@/components/ui";
import { clientAuth } from "@/lib/firebase-client";
import { formatDisplayDate } from "@/lib/utils";
import { exportCourseAttendancePDF, exportDayAttendancePDF } from "@/lib/attendance-pdf";
import type { CourseExportData } from "@/types/admin";

interface Props {
  courseId: string;
  /** Class sessions already loaded for this course (used to offer the days a class was held). */
  sessions: { id: string; date: string }[];
}

export default function ExportAttendanceCard({ courseId, sessions }: Props) {
  const [scope, setScope] = useState("all"); // "all" or a YYYY-MM-DD day
  const [busy, setBusy] = useState(false);

  // Days that had a class, newest first. If the chosen day vanishes (course switched, class deleted) fall back to "all".
  const days = useMemo(() => [...new Set(sessions.map((s) => s.date).filter(Boolean))].sort().reverse(), [sessions]);
  const value = scope === "all" || days.includes(scope) ? scope : "all";

  const download = async () => {
    setBusy(true);
    try {
      const token = await clientAuth.currentUser?.getIdToken();
      const params = new URLSearchParams({ courseId, ...(value !== "all" ? { date: value } : {}) });
      const res = await fetch(`/api/admin/export?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Export failed.");
        return;
      }
      if (value === "all") await exportCourseAttendancePDF(data as CourseExportData);
      else await exportDayAttendancePDF(data as CourseExportData, value);
      toast.success("Attendance PDF downloaded.");
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-4 flex items-center gap-2">
        <FileDown className="w-4 h-4" /> Export Attendance
      </h2>
      {sessions.length === 0 ? (
        <p className="text-sm text-slate-400">Nothing to export until a class has been held.</p>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <Select
              label="What to export"
              value={value}
              onChange={(e) => setScope(e.target.value)}
              options={[
                { value: "all", label: `Whole course (${sessions.length} class${sessions.length === 1 ? "" : "es"})` },
                ...days.map((d) => ({ value: d, label: `One day · ${formatDisplayDate(d)}` })),
              ]}
            />
          </div>
          <Button loading={busy} onClick={download} icon={<FileDown className="w-4 h-4" />}>
            Download PDF
          </Button>
        </div>
      )}
    </Card>
  );
}
