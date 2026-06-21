"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Badge, Skeleton, Select } from "@/components/ui";
import { clientAuth } from "@/lib/firebase-client";
import { toast } from "sonner";
import { formatDisplayDate, formatTime } from "@/lib/utils";
import {
  PlayCircle, StopCircle, PauseCircle, PlayIcon,
  Plus, Clock, Users, BookOpen, Activity
} from "lucide-react";

interface Course { id: string; name: string; code: string; assignedAdmins?: string[]; }
interface GlobalState {
  classActive: boolean; checkinPaused: boolean;
  startTime: number | null; endTime: number | null; currentDate: string | null;
}
interface Session { dateKey: string; totalPresence: number; startTime: number; endTime: number; startedBy: string; }
interface ActivityLog { id: string; action: string; courseId: string; adminName: string; timestamp: number; dateKey: string; }

export default function AdminCreatePage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [globalState, setGlobalState] = useState<GlobalState | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [loadingState, setLoadingState] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // New course form (super admin only)
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [newCourse, setNewCourse] = useState({ name: "", code: "", description: "" });
  const [creatingCourse, setCreatingCourse] = useState(false);

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
      ? all.filter((c) => (c.assignedAdmins || []).includes(profile.uid))
      : all;
    setCourses(scoped);
    if (scoped.length && !selectedCourse) setSelectedCourse(scoped[0].id);
  }, [profile, selectedCourse]);

  useEffect(() => { if (profile?.admin) fetchCourses(); }, [profile, fetchCourses]);

  const fetchCourseState = useCallback(async (courseId: string) => {
    if (!courseId) return;
    setLoadingState(true);
    try {
      const token = await getToken();
      const [globalRes, sessionsRes, logRes] = await Promise.all([
        fetch(`/api/globals?courseId=${courseId}`),
        fetch(`/api/classes?courseId=${courseId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/admin/activity-log?courseId=${courseId}&limit=10`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [g, s, l] = await Promise.all([globalRes.json(), sessionsRes.json(), logRes.json()]);
      setGlobalState(g.global);
      setSessions(s.sessions || []);
      setActivityLog(l.logs || []);
    } catch { /* silent */ } finally { setLoadingState(false); }
  }, []);

  useEffect(() => { if (selectedCourse) fetchCourseState(selectedCourse); }, [selectedCourse, fetchCourseState]);

  // Poll every 15s when class is active
  useEffect(() => {
    if (!globalState?.classActive || !selectedCourse) return;
    const interval = setInterval(() => fetchCourseState(selectedCourse), 15_000);
    return () => clearInterval(interval);
  }, [globalState?.classActive, selectedCourse, fetchCourseState]);

  const doAction = async (action: "start" | "end" | "pause" | "resume") => {
    if (!selectedCourse) return;
    setActionLoading(action);
    try {
      const token = await getToken();
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, courseId: selectedCourse }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Action failed"); return; }
      toast.success({
        start: "Class started! Students can now mark attendance.",
        end: "Class ended.",
        pause: "Check-in paused.",
        resume: "Check-in resumed.",
      }[action]);
      fetchCourseState(selectedCourse);
    } catch { toast.error("Action failed."); } finally { setActionLoading(null); }
  };

  const handleCreateCourse = async () => {
    if (!newCourse.name || !newCourse.code) { toast.error("Name and code are required."); return; }
    setCreatingCourse(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(newCourse),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(`Course ${newCourse.code} created!`);
      setNewCourse({ name: "", code: "", description: "" });
      setShowCourseForm(false);
      fetchCourses();
    } catch { toast.error("Failed to create course."); } finally { setCreatingCourse(false); }
  };

  const actionLabel = { start: "Starting...", end: "Ending...", pause: "Pausing...", resume: "Resuming..." };

  if (authLoading || !profile?.admin) return null;

  const isActive = globalState?.classActive;
  const isPaused = globalState?.checkinPaused;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Class Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Start, end, or pause attendance check-in</p>
        </div>
        {profile.scope === "super" && (
          <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowCourseForm(!showCourseForm)}>
            New Course
          </Button>
        )}
      </div>

      {/* New course form */}
      {showCourseForm && profile.scope === "super" && (
        <Card className="p-5 space-y-4 animate-slide-up border-brand-200 dark:border-brand-800">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Create New Course</h2>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Course Name" placeholder="e.g. Introduction to Political Science"
              value={newCourse.name} onChange={(e) => setNewCourse(p => ({ ...p, name: e.target.value }))} />
            <Input label="Course Code" placeholder="e.g. POL201"
              value={newCourse.code} onChange={(e) => setNewCourse(p => ({ ...p, code: e.target.value }))} />
          </div>
          <Input label="Description (optional)" placeholder="Brief description"
            value={newCourse.description} onChange={(e) => setNewCourse(p => ({ ...p, description: e.target.value }))} />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowCourseForm(false)}>Cancel</Button>
            <Button size="sm" loading={creatingCourse} onClick={handleCreateCourse}>Create Course</Button>
          </div>
        </Card>
      )}

      {/* Course picker */}
      {courses.length > 0 && (
        <Card className="p-5">
          <Select
            label="Select Course"
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            options={courses.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
          />
        </Card>
      )}

      {courses.length === 0 && !loadingState && (
        <Card className="p-8 text-center">
          <BookOpen className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500">No courses assigned to you yet.</p>
        </Card>
      )}

      {selectedCourse && (
        <>
          {/* Class status */}
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-4">
              Class Status
            </h2>
            {loadingState ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <div className={`flex items-center gap-3 p-4 rounded-xl mb-5 ${
                  isActive && !isPaused
                    ? "bg-brand-50 dark:bg-brand-950 border border-brand-200 dark:border-brand-800"
                    : isPaused
                    ? "bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800"
                    : "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                }`}>
                  <div className={`w-3 h-3 rounded-full ${
                    isActive && !isPaused ? "bg-brand-500 animate-pulse" : isPaused ? "bg-yellow-500" : "bg-slate-300"
                  }`} />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">
                      {isActive && !isPaused ? "Class Active" : isPaused ? "Check-in Paused" : "No Active Class"}
                    </p>
                    {isActive && globalState?.startTime && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Started at {formatTime(globalState.startTime)} · Ends at {formatTime(globalState.endTime!)}
                      </p>
                    )}
                  </div>
                  {isActive && (
                    <Badge variant={isPaused ? "yellow" : "green"}>
                      {globalState?.currentDate}
                    </Badge>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 flex-wrap">
                  {!isActive && (
                    <Button icon={<PlayCircle className="w-4 h-4" />}
                      loading={actionLoading === "start"} onClick={() => doAction("start")}>
                      {actionLoading === "start" ? actionLabel.start : "Start Class"}
                    </Button>
                  )}
                  {isActive && !isPaused && (
                    <Button variant="secondary" icon={<PauseCircle className="w-4 h-4" />}
                      loading={actionLoading === "pause"} onClick={() => doAction("pause")}>
                      Pause Check-in
                    </Button>
                  )}
                  {isActive && isPaused && (
                    <Button variant="secondary" icon={<PlayIcon className="w-4 h-4" />}
                      loading={actionLoading === "resume"} onClick={() => doAction("resume")}>
                      Resume Check-in
                    </Button>
                  )}
                  {isActive && (
                    <Button variant="danger" icon={<StopCircle className="w-4 h-4" />}
                      loading={actionLoading === "end"} onClick={() => doAction("end")}>
                      End Class
                    </Button>
                  )}
                </div>
              </>
            )}
          </Card>

          {/* Session history */}
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-4">
              Class History
            </h2>
            {loadingState ? (
              <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">No classes held yet.</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div key={s.dateKey} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-sm">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{formatDisplayDate(s.dateKey)}</p>
                        <p className="text-xs text-slate-400">
                          {formatTime(s.startTime)} – {formatTime(s.endTime)}
                        </p>
                      </div>
                    </div>
                    <Badge variant="green">
                      <Users className="w-3 h-3 mr-1 inline" />{s.totalPresence}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Activity log */}
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Activity Log
            </h2>
            {activityLog.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">No activity recorded.</p>
            ) : (
              <div className="space-y-2">
                {activityLog.map((log) => (
                  <div key={log.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        log.action.includes("start") ? "bg-brand-500"
                          : log.action.includes("end") ? "bg-red-500"
                          : log.action.includes("pause") ? "bg-yellow-500"
                          : "bg-blue-500"
                      }`} />
                      <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">
                        {log.action.replace(/_/g, " ")}
                      </span>
                      <span className="text-slate-400">by {log.adminName}</span>
                    </div>
                    <span className="text-slate-400 font-mono">{formatTime(log.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
