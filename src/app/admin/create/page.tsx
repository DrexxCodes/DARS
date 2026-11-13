"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Badge, Skeleton, Select } from "@/components/ui";
import DeleteClassSheet from "@/components/admin/DeleteClassSheet";
import DeleteCourseSheet from "@/components/admin/DeleteCourseSheet";
import ExtendClassSheet, { type ExtendTarget } from "@/components/admin/ExtendClassSheet";
import { useScopes } from "@/hooks/useScopes";
import { handleOutOfScope } from "@/lib/scope-events";
import { EXTEND_LIMITS } from "@/constants/class";
import type { ScopeKey } from "@/constants/scopes";
import { clientAuth } from "@/lib/firebase-client";
import { toast } from "sonner";
import { formatTime } from "@/lib/utils";
import { formatMinutes } from "@/lib/class-timing";
import LevelPicker from "@/components/admin/LevelPicker";
import DepartmentPicker from "@/components/admin/DepartmentPicker";
import AdmissionTypePicker from "@/components/admin/AdmissionTypePicker";
import ExportAttendanceCard from "@/components/admin/ExportAttendanceCard";
import StartClassSheet, { type StartClassValues } from "@/components/admin/StartClassSheet";
import CarryoverRequestsCard from "@/components/admin/CarryoverRequestsCard";
import { levelLabel, departmentLabel, admissionTypeLabel } from "@/constants/academics";
import {
  PlayCircle, StopCircle, PauseCircle, PlayIcon,
  Plus, Clock, Users, BookOpen, Activity, MapPin, Trash2, TimerReset
} from "lucide-react";

interface Course { id: string; name: string; code: string; assignedAdmins?: string[]; levels?: number[]; departments?: string[]; admissionTypes?: string[]; }
interface GlobalState {
  classActive: boolean; checkinPaused: boolean;
  startTime: number | null; endTime: number | null;
  currentClassId: string | null;
  locationId?: string; locationName?: string;
  className?: string | null; lateAfterMinutes?: number | null;
}
interface Session {
  id: string; classId: string; date: string;
  totalPresence: number; startTime: number; endTime: number;
  startedBy: string; locationName?: string;
  name?: string | null; lateAfterMinutes?: number | null;
}
interface ActivityLog { id: string; action: string; courseId: string; adminName: string; timestamp: number; }
interface LocationTag { id: string; name: string; isPrimary: boolean; }

export default function AdminCreatePage() {
  const { profile, loading: authLoading } = useAuth();
  const { guard } = useScopes();
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [globalState, setGlobalState] = useState<GlobalState | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [loadingState, setLoadingState] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // New course form
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [newCourse, setNewCourse] = useState({ name: "", code: "", description: "", levels: [] as number[], departments: [] as string[], admissionTypes: [] as string[] });
  const [editLevels, setEditLevels] = useState<number[] | null>(null); // non-null while editing the selected course's levels + departments
  const [editDepartments, setEditDepartments] = useState<string[]>([]);
  const [editAdmissionTypes, setEditAdmissionTypes] = useState<string[]>([]);
  const [savingLevels, setSavingLevels] = useState(false);
  const [creatingCourse, setCreatingCourse] = useState(false);

  // Locations
  const [locations, setLocations] = useState<LocationTag[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [startSheetOpen, setStartSheetOpen] = useState(false);

  // Delete course / class day sheets (both show live progress)
  const [showDeleteCourseDialog, setShowDeleteCourseDialog] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);

  // Extend a running class or re-open an ended one
  const [extendTarget, setExtendTarget] = useState<ExtendTarget | null>(null);

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

  const fetchLocations = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/locations", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const locs: LocationTag[] = data.locations || [];
      setLocations(locs);
      const primary = locs.find((l) => l.isPrimary);
      if (primary && !selectedLocationId) setSelectedLocationId(primary.id);
    } catch { /* silent */ }
  }, [selectedLocationId]);

  useEffect(() => { if (profile?.admin) fetchLocations(); }, [profile, fetchLocations]);

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

  useEffect(() => {
    if (!globalState?.classActive || !selectedCourse) return;
    const interval = setInterval(() => fetchCourseState(selectedCourse), 15_000);
    return () => clearInterval(interval);
  }, [globalState?.classActive, selectedCourse, fetchCourseState]);

  const ACTION_SCOPE: Record<"start" | "end" | "pause" | "resume", ScopeKey> = { start: "class.create", end: "class.end", pause: "class.pause", resume: "class.pause" };

  const doAction = async (action: "start" | "end" | "pause" | "resume", start?: StartClassValues) => {
    if (!selectedCourse) return;
    if (!guard(ACTION_SCOPE[action])) return;
    setActionLoading(action);
    try {
      const token = await getToken();
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action,
          courseId: selectedCourse,
          ...(action === "start" && start ? start : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) { if (!handleOutOfScope(res.status, data)) toast.error(data.error || "Action failed"); return; }
      toast.success({
        start: `Class started at ${data.locationName || "the selected location"}! Students can now mark attendance.`,
        end: "Class ended.",
        pause: "Check-in paused.",
        resume: "Check-in resumed.",
      }[action]);
      if (action === "start") setStartSheetOpen(false);
      fetchCourseState(selectedCourse);
    } catch { toast.error("Action failed."); } finally { setActionLoading(null); }
  };

  const handleCreateCourse = async () => {
    if (!guard("course.create")) return;
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
      if (!res.ok) { if (!handleOutOfScope(res.status, data)) toast.error(data.error); return; }
      toast.success(`Course ${newCourse.code} created!`);
      setNewCourse({ name: "", code: "", description: "", levels: [], departments: [], admissionTypes: [] });
      setShowCourseForm(false);
      fetchCourses();
    } catch { toast.error("Failed to create course."); } finally { setCreatingCourse(false); }
  };

  const handleSaveLevels = async () => {
    if (!selectedCourse || editLevels === null) return;
    setSavingLevels(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/courses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ courseId: selectedCourse, levels: editLevels, departments: editDepartments, admissionTypes: editAdmissionTypes }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to update course."); return; }
      toast.success("Course audience updated.");
      setEditLevels(null);
      fetchCourses();
    } catch { toast.error("Failed to update levels."); } finally { setSavingLevels(false); }
  };

  if (authLoading || !profile?.admin) return null;

  const selectedCourseData = courses.find((c) => c.id === selectedCourse);
  const isActive = globalState?.classActive;
  const isPaused = globalState?.checkinPaused;
  // Running = active AND still inside its check-in window (an "active" class past its end time has effectively ended)
  const liveNow = !!isActive && !!globalState?.startTime && Date.now() < (globalState.endTime ?? 0);

  const openExtend = (s: Session) => {
    if (!guard("class.extend")) return;
    const label = s.name ? `${s.name} · ${s.date}` : s.date;
    setExtendTarget({ classId: s.id, kind: liveNow && globalState?.currentClassId === s.id ? "running" : "ended", label, startTime: s.startTime, endTime: s.endTime });
  };
  /** Ended classes can be re-opened while their start is still inside the 12 hour window (and nothing else is running). */
  const canReopen = (s: Session) => !liveNow && Date.now() - s.startTime < (EXTEND_LIMITS.MAX_TOTAL_MIN - EXTEND_LIMITS.MIN_MIN) * 60_000;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Class Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Start, end, or pause attendance check-in</p>
        </div>
        <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => (showCourseForm || guard("course.create")) && setShowCourseForm(!showCourseForm)}>
          New Course
        </Button>
      </div>

      {/* New course form */}
      {showCourseForm && (
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
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Assign to levels</p>
            <LevelPicker value={newCourse.levels} onChange={(levels) => setNewCourse((p) => ({ ...p, levels }))} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Restrict to departments</p>
            <DepartmentPicker value={newCourse.departments} onChange={(departments) => setNewCourse((p) => ({ ...p, departments }))} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Admission type</p>
            <AdmissionTypePicker value={newCourse.admissionTypes} onChange={(admissionTypes) => setNewCourse((p) => ({ ...p, admissionTypes }))} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowCourseForm(false)}>Cancel</Button>
            <Button size="sm" loading={creatingCourse} onClick={handleCreateCourse}>Create Course</Button>
          </div>
        </Card>
      )}

      {/* Course picker */}
      {courses.length > 0 && (
        <Card className="p-5 space-y-4">
          <Select
            label="Select Course"
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            options={courses.map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
          />
          {selectedCourse && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Levels:</span>
                  {selectedCourseData?.levels?.length
                    ? selectedCourseData.levels.map((l) => <Badge key={l} variant="blue">{levelLabel(l)}</Badge>)
                    : <Badge variant="slate">All levels</Badge>}
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-2">Departments:</span>
                  {selectedCourseData?.departments?.length
                    ? selectedCourseData.departments.map((d) => <Badge key={d} variant="orange">{departmentLabel(d)}</Badge>)
                    : <Badge variant="slate">All departments</Badge>}
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-2">Admission:</span>
                  {selectedCourseData?.admissionTypes?.length
                    ? selectedCourseData.admissionTypes.map((t) => <Badge key={t} variant="green">{admissionTypeLabel(t)}</Badge>)
                    : <Badge variant="slate">Regular &amp; CEP</Badge>}
                </div>
                {profile.scope === "super" && editLevels === null && (
                  <Button size="sm" variant="outline" onClick={() => { setEditLevels(selectedCourseData?.levels ?? []); setEditDepartments(selectedCourseData?.departments ?? []); setEditAdmissionTypes(selectedCourseData?.admissionTypes ?? []); }}>
                    Edit Audience
                  </Button>
                )}
              </div>
              {profile.scope === "super" && editLevels !== null && (
                <div className="space-y-3 border-t border-slate-100 dark:border-slate-700 pt-3">
                  <LevelPicker value={editLevels} onChange={setEditLevels} disabled={savingLevels} />
                  <DepartmentPicker value={editDepartments} onChange={setEditDepartments} disabled={savingLevels} />
                  <AdmissionTypePicker value={editAdmissionTypes} onChange={setEditAdmissionTypes} disabled={savingLevels} />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditLevels(null)}>Cancel</Button>
                    <Button size="sm" loading={savingLevels} onClick={handleSaveLevels}>Save</Button>
                  </div>
                </div>
              )}
            </div>
          )}
          {selectedCourse && (
            <div className="flex justify-end">
              <Button
                size="sm" variant="danger" icon={<Trash2 className="w-3.5 h-3.5" />}
                disabled={liveNow}
                onClick={() => guard("course.delete") && setShowDeleteCourseDialog(true)}
              >
                Delete Course
              </Button>
            </div>
          )}
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
                      {isActive && globalState?.className && <span className="font-normal text-slate-500"> · {globalState.className}</span>}
                    </p>
                    {isActive && globalState?.startTime && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Started at {formatTime(globalState.startTime)} · Ends at {formatTime(globalState.endTime!)}
                        {globalState?.locationName && <> · <MapPin className="w-3 h-3 inline -mt-0.5" /> {globalState.locationName}</>}
                        {globalState?.lateAfterMinutes ? <> · Late after {formatMinutes(globalState.lateAfterMinutes)}</> : null}
                      </p>
                    )}
                  </div>
                  {isActive && globalState?.currentClassId && (
                    <Badge variant={isPaused ? "yellow" : "green"}>
                      Live
                    </Badge>
                  )}
                </div>

                {/* No tags yet: the sheet can't be used, so say why up front */}
                {!isActive && locations.length === 0 && (
                  <div className="mb-5 flex items-start gap-2 text-left bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-sm p-3 rounded-lg">
                    <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>
                      No location tags exist yet. Create one on the{" "}
                      <a href="/admin/tags" className="underline font-medium">Tags page</a> before starting a class.
                    </span>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3 flex-wrap">
                  {!isActive && (
                    <Button icon={<PlayCircle className="w-4 h-4" />}
                      loading={actionLoading === "start"} disabled={!locations.length}
                      onClick={() => guard("class.create") && setStartSheetOpen(true)}>
                      Start Class
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
                  {liveNow && globalState?.currentClassId && globalState.startTime && (
                    <Button variant="secondary" icon={<TimerReset className="w-4 h-4" />}
                      onClick={() => {
                        if (!guard("class.extend")) return;
                        const cur = sessions.find((x) => x.id === globalState.currentClassId);
                        setExtendTarget({
                          classId: globalState.currentClassId!, kind: "running",
                          label: globalState.className || cur?.date || "Current class",
                          startTime: globalState.startTime!, endTime: globalState.endTime!,
                        });
                      }}>
                      Extend Class
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
                  <div key={s.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-sm">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{s.name ? `${s.name} · ${s.date}` : s.date}</p>
                        <p className="text-xs text-slate-400">
                          {formatTime(s.startTime)} – {formatTime(s.endTime)}
                          {s.locationName && <> · {s.locationName}</>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="green">
                        <Users className="w-3 h-3 mr-1 inline" />{s.totalPresence}
                      </Badge>
                      {canReopen(s) && (
                        <button
                          onClick={() => openExtend(s)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950 transition-colors"
                          title="Extend this class"
                          aria-label="Extend this class"
                        >
                          <TimerReset className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => guard("class.delete") && setSessionToDelete(s)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                        title="Delete this class"
                        aria-label="Delete this class"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Added Course requests from students of other levels */}
          <CarryoverRequestsCard courseId={selectedCourse} />

          {/* Export attendance (whole course or one day) */}
          <ExportAttendanceCard courseId={selectedCourse} sessions={sessions} />

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
                          : log.action.includes("delete") ? "bg-orange-500"
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

      <StartClassSheet
        open={startSheetOpen}
        onClose={() => setStartSheetOpen(false)}
        course={selectedCourseData ? { code: selectedCourseData.code, name: selectedCourseData.name } : null}
        locations={locations}
        defaultLocationId={selectedLocationId}
        suggestedName={selectedCourseData ? `${selectedCourseData.code} · Class ${sessions.length + 1}` : ""}
        starting={actionLoading === "start"}
        onStart={(values) => { setSelectedLocationId(values.locationId); doAction("start", values); }}
      />

      <DeleteCourseSheet
        open={showDeleteCourseDialog}
        onClose={() => setShowDeleteCourseDialog(false)}
        course={selectedCourseData ?? null}
        onDeleted={() => {
          setSelectedCourse("");
          setGlobalState(null);
          setSessions([]);
          setActivityLog([]);
          fetchCourses();
        }}
      />

      <DeleteClassSheet
        open={!!sessionToDelete}
        onClose={() => setSessionToDelete(null)}
        courseId={selectedCourse}
        session={sessionToDelete}
        onDeleted={() => fetchCourseState(selectedCourse)}
      />

      <ExtendClassSheet
        open={!!extendTarget}
        onClose={() => setExtendTarget(null)}
        courseId={selectedCourse}
        target={extendTarget}
        onExtended={() => fetchCourseState(selectedCourse)}
      />
    </div>
  );
}
