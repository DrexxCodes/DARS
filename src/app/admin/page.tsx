"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Badge, Skeleton, Select } from "@/components/ui";
import { clientAuth } from "@/lib/firebase-client";
import { getAttendanceColor, getAttendanceBg, formatDisplayDate } from "@/lib/utils";
import { exportCSV, exportPDF } from "@/lib/export";
import { toast } from "sonner";
import {
  Search, Download, FileText, TrendingUp, Users,
  BookOpen, Ban, ShieldCheck, ChevronDown, ChevronUp
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from "recharts";

interface CourseAttendance {
  courseId: string; courseName: string; courseCode: string;
  attended: number; total: number; percentage: number;
}

interface SessionStat {
  dateKey: string; totalPresence: number; startTime: number;
}

interface Course { id: string; name: string; code: string; }

export default function AdminPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [sessions, setSessions] = useState<SessionStat[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const [regInput, setRegInput] = useState("");
  const [studentData, setStudentData] = useState<{ student: { name: string; regNumber: string; banned?: boolean; uid?: string }; courses: CourseAttendance[] } | null>(null);
  const [searching, setSearching] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!profile || !profile.admin)) router.push("/");
  }, [authLoading, profile, router]);

  const getToken = async () => clientAuth.currentUser?.getIdToken();

  const fetchCourses = useCallback(async () => {
    const token = await getToken();
    const res = await fetch("/api/courses?all=true", { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const all: Course[] = data.courses || [];
    const scoped = profile?.scope === "defined"
      ? all.filter((c: Course & { assignedAdmins?: string[] }) =>
          ((c as Course & { assignedAdmins?: string[] }).assignedAdmins || []).includes(profile.uid))
      : all;
    setCourses(scoped);
    if (scoped.length) setSelectedCourse(scoped[0].id);
  }, [profile]);

  useEffect(() => { if (profile?.admin) fetchCourses(); }, [profile, fetchCourses]);

  const fetchSessions = useCallback(async (courseId: string) => {
    if (!courseId) return;
    setLoadingSessions(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/classes?courseId=${courseId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setSessions((data.sessions || []).slice(0, 10));
    } catch { /* silent */ } finally { setLoadingSessions(false); }
  }, []);

  useEffect(() => { if (selectedCourse) fetchSessions(selectedCourse); }, [selectedCourse, fetchSessions]);

  const searchStudent = async () => {
    if (!regInput.trim()) return;
    setSearching(true);
    setStudentData(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/students/${regInput.trim().toUpperCase()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { toast.error("Student not found."); return; }
      const data = await res.json();
      setStudentData(data);
    } catch { toast.error("Search failed."); } finally { setSearching(false); }
  };

  const toggleBan = async () => {
    if (!studentData) return;
    const token = await getToken();
    const newBan = !studentData.student.banned;
    await fetch(`/api/users/${studentData.student.uid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ banned: newBan }),
    });
    toast.success(newBan ? "Student banned from attendance." : "Student ban lifted.");
    setStudentData((prev) => prev ? { ...prev, student: { ...prev.student, banned: newBan } } : prev);
  };

  const handleExportStudent = async (format: "csv" | "pdf") => {
    if (!studentData) return;
    setExporting(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/export/${studentData.student.regNumber}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const filename = `DARS_${studentData.student.regNumber}_Attendance`;
      const title = `Attendance Report — ${studentData.student.name} (${studentData.student.regNumber})`;
      if (format === "csv") exportCSV(data.rows, filename);
      else await exportPDF(data.rows, filename, title);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch { toast.error("Export failed."); } finally { setExporting(false); }
  };

  const handleBulkExport = async (format: "csv" | "pdf") => {
    setExporting(true);
    try {
      const token = await getToken();
      const url = selectedCourse ? `/api/admin/export?courseId=${selectedCourse}` : "/api/admin/export";
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const filename = `DARS_BulkExport_${new Date().toISOString().split("T")[0]}`;
      const title = `Full Attendance Export — ${new Date().toLocaleDateString()}`;
      if (format === "csv") exportCSV(data.rows, filename);
      else await exportPDF(data.rows, filename, title);
      toast.success(`Bulk export done as ${format.toUpperCase()}`);
    } catch { toast.error("Bulk export failed."); } finally { setExporting(false); }
  };

  if (authLoading || !profile?.admin) return null;

  const recentSessions = sessions.slice(0, 3);
  const chartData = recentSessions.map((s) => ({
    date: formatDisplayDate(s.dateKey).split(",")[0],
    presence: s.totalPresence,
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Panel</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {profile.scope === "super" ? "Super Admin" : "Defined Admin"} ·{" "}
            <span className="font-medium">{profile.name}</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" />}
            loading={exporting} onClick={() => handleBulkExport("csv")}>
            Export CSV
          </Button>
          <Button variant="outline" size="sm" icon={<FileText className="w-3.5 h-3.5" />}
            loading={exporting} onClick={() => handleBulkExport("pdf")}>
            Export PDF
          </Button>
        </div>
      </div>

      {/* Course selector */}
      {courses.length > 0 && (
        <Card className="p-5">
          <Select
            label="View Course"
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            options={courses.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
          />
        </Card>
      )}

      {/* Recent sessions chart */}
      <Card className="p-6">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-4">
          Last 3 Classes — Attendance
        </h2>
        {loadingSessions ? (
          <Skeleton className="h-40 w-full" />
        ) : recentSessions.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">No classes recorded yet.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow text-xs">
                        <p className="font-semibold">{payload[0].payload.date}</p>
                        <p className="text-brand-600">{payload[0].value} students present</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="presence" radius={[6, 6, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill="#16a34a" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Expandable session list */}
            <div className="mt-4 space-y-2">
              {sessions.map((s) => (
                <div key={s.dateKey}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{formatDisplayDate(s.dateKey)}</span>
                  <Badge variant="green">
                    <Users className="w-3 h-3 mr-1 inline" />{s.totalPresence} present
                  </Badge>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Student search */}
      <Card className="p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
          Search Student
        </h2>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. 2023133001"
            value={regInput}
            onChange={(e) => setRegInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchStudent()}
            className="font-mono"
          />
          <Button onClick={searchStudent} loading={searching} icon={<Search className="w-4 h-4" />}>
            Search
          </Button>
        </div>

        {studentData && (
          <div className="animate-slide-up space-y-4 pt-2">
            {/* Student header */}
            <div className="flex items-start justify-between flex-wrap gap-3 p-4 rounded-xl bg-brand-50 dark:bg-brand-950 border border-brand-100 dark:border-brand-900">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">{studentData.student.name}</p>
                <p className="font-mono text-xs text-slate-500 mt-0.5">{studentData.student.regNumber}</p>
                {studentData.student.banned && <Badge variant="red" >Banned</Badge>}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={studentData.student.banned ? "secondary" : "danger"}
                  icon={studentData.student.banned ? <ShieldCheck className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                  onClick={toggleBan}
                >
                  {studentData.student.banned ? "Lift Ban" : "Ban Student"}
                </Button>
                <Button size="sm" variant="outline" icon={<Download className="w-3.5 h-3.5" />}
                  loading={exporting} onClick={() => handleExportStudent("csv")}>CSV</Button>
                <Button size="sm" variant="outline" icon={<FileText className="w-3.5 h-3.5" />}
                  loading={exporting} onClick={() => handleExportStudent("pdf")}>PDF</Button>
              </div>
            </div>

            {/* Per-course attendance */}
            {studentData.courses.map((course) => (
              <div key={course.courseId} className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => setExpandedCourse(expandedCourse === course.courseId ? null : course.courseId)}
                >
                  <div className="flex items-center gap-3 text-left">
                    <BookOpen className="w-4 h-4 text-brand-500 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{course.courseName}</p>
                      <p className="text-xs text-slate-400 font-mono">{course.courseCode}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className={`text-sm font-bold ${getAttendanceColor(course.percentage)}`}>
                        {course.percentage}%
                      </p>
                      <p className="text-xs text-slate-400">{course.attended}/{course.total}</p>
                    </div>
                    {expandedCourse === course.courseId
                      ? <ChevronUp className="w-4 h-4 text-slate-400" />
                      : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {expandedCourse === course.courseId && (
                  <div className="px-4 pb-4 pt-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getAttendanceBg(course.percentage)}`}
                          style={{ width: `${course.percentage}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold ${getAttendanceColor(course.percentage)}`}>
                        {course.percentage}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={course.percentage >= 75 ? "green" : course.percentage >= 50 ? "yellow" : "red"}>
                        <TrendingUp className="w-3 h-3 mr-1 inline" />
                        {course.percentage >= 75 ? "Satisfactory" : course.percentage >= 50 ? "At risk" : "Critical"}
                      </Badge>
                      <span className="text-xs text-slate-500">{course.attended} classes attended of {course.total} total</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
