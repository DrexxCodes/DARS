"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Card, Button, Badge, Input, Skeleton } from "@/components/ui";
import ConfirmJobSheet from "@/components/ui/ConfirmJobSheet";
import AdminRoleSheet, { type AdminRecord, type CourseLite } from "@/components/admin/AdminRoleSheet";
import { adminFetch } from "@/lib/admin-api";
import { toast } from "sonner";
import { UserCog, BookOpen, ShieldOff, Lock, Mail } from "lucide-react";
import { useExportVisibility } from "@/hooks/useExportVisibility";
import ExportVisibilityToggle from "@/components/admin/ExportVisibilityToggle";
import { scopeDef } from "@/constants/scopes";

export default function AdminManagePage() {
  const { profile, loading: authLoading, refreshProfile } = useAuth();
  const router = useRouter();

  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [courses, setCourses] = useState<CourseLite[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [editing, setEditing] = useState<AdminRecord | null>(null);
  const [revoking, setRevoking] = useState<AdminRecord | null>(null);
  const { setExcluded, busyUid } = useExportVisibility();

  // Add admin
  const [email, setEmail] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);

  useEffect(() => {
    if (!authLoading && (!profile || profile.scope !== "super")) router.push("/admin/create");
  }, [authLoading, profile, router]);

  const fetchData = useCallback(async () => {
    setLoadingAdmins(true);
    const [a, c] = await Promise.all([adminFetch<{ admins: AdminRecord[] }>("/api/admin"), adminFetch<{ courses: CourseLite[] }>("/api/courses?all=true")]);
    if (!a.ok && !a.outOfScope) toast.error(a.error || "Couldn't load admins.");
    setAdmins(a.data.admins || []);
    setCourses(c.data.courses || []);
    setLoadingAdmins(false);
  }, []);

  useEffect(() => { if (profile?.scope === "super") fetchData(); }, [profile, fetchData]);

  const addAdmin = async () => {
    if (!email) return;
    setAddingAdmin(true);
    const r = await adminFetch<{ scope?: string }>("/api/admin/add", { body: { email } });
    setAddingAdmin(false);
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(
      r.data.scope === "super"
        ? `Admin access granted to ${email}`
        : `${email} is now a scoped admin. Tap Edit role to assign their courses and scopes.`
    );
    setEmail("");
    fetchData();
  };

  if (authLoading || profile?.scope !== "super") return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Management</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Grant, edit, or revoke admin roles, course assignments and scopes
        </p>
      </div>

      {/* Add admin */}
      <Card className="p-4 sm:p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Grant Admin Access</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="min-w-0 flex-1">
            <Input placeholder="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addAdmin()} />
          </div>
          <Button loading={addingAdmin} onClick={addAdmin} className="sm:self-start">Grant Access</Button>
        </div>
      </Card>

      {/* Admin list: stacked cards, readable on a phone */}
      <Card className="p-4 sm:p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Current Admins {!loadingAdmins && <span className="font-normal text-slate-400">({admins.length})</span>}</h2>
        {loadingAdmins ? (
          <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        ) : admins.length === 0 ? (
          <p className="text-sm text-slate-400 py-3 text-center">No admins found.</p>
        ) : (
          <div className="space-y-3">
            {admins.map((admin) => {
              const isYou = admin.uid === profile.uid;
              const isSuper = admin.scope === "super";
              return (
                <div key={admin.uid} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 sm:p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 shrink-0 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center text-brand-700 dark:text-brand-300 font-bold text-sm">
                      {admin.name?.[0]?.toUpperCase() || "A"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-slate-900 dark:text-white break-words">{admin.name || "Unnamed admin"}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1 break-all"><Mail className="w-3 h-3 shrink-0" />{admin.email}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant={isSuper ? "green" : "blue"}>{isSuper ? "Super Admin" : "Scoped Admin"}</Badge>
                      {isYou && <Badge variant="slate">You</Badge>}
                    </div>
                  </div>

                  {!isSuper && (
                    <div className="space-y-2">
                      {(admin.assignedCourses?.length ?? 0) > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {admin.assignedCourses!.map((cId) => {
                            const c = courses.find((x) => x.id === cId);
                            return c ? (
                              <span key={cId} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                <BookOpen className="w-3 h-3" />{c.code}
                              </span>
                            ) : null;
                          })}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                          <Lock className="w-3 h-3" /><span>No courses assigned yet</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {(admin.scopes ?? []).length === 0 ? (
                          <span className="text-xs text-slate-400">No scopes granted</span>
                        ) : (
                          admin.scopes!.map((k) => (
                            <span key={k} title={scopeDef(k)?.description} className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
                              {k}{k === "student.mark" && admin.scopeLimits?.["student.mark"] ? ` ≤${admin.scopeLimits["student.mark"]}/class` : ""}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Super admins can override whether this admin's own attendance shows in PDF exports */}
                  {admin.regNumber && (
                    <ExportVisibilityToggle
                      label="Hide this admin from attendance exports"
                      checked={!!admin.excludeFromExports}
                      busy={busyUid === admin.uid}
                      onChange={async (next) => {
                        if (await setExcluded(next, admin.uid)) {
                          if (isYou) void refreshProfile();
                          setAdmins((prev) => prev.map((a) => (a.uid === admin.uid ? { ...a, excludeFromExports: next } : a)));
                        }
                      }}
                    />
                  )}

                  {!isYou && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" icon={<UserCog className="w-3.5 h-3.5" />} onClick={() => setEditing(admin)}>
                        Edit Role
                      </Button>
                      <Button size="sm" variant="danger" icon={<ShieldOff className="w-3.5 h-3.5" />} onClick={() => setRevoking(admin)}>
                        Revoke
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <AdminRoleSheet admin={editing} courses={courses} onClose={() => setEditing(null)} onSaved={fetchData} />

      <ConfirmJobSheet<null>
        open={!!revoking}
        onClose={() => setRevoking(null)}
        icon={<ShieldOff className="h-5 w-5" />}
        title="Revoke admin access?"
        subtitle={revoking ? revoking.name || revoking.email : undefined}
        confirmLabel="Revoke access"
        runningTitle="Revoking access"
        run={async (onProgress) => {
          onProgress({ step: "Removing admin access and course assignments…" });
          const r = await adminFetch("/api/admin", { method: "DELETE", body: { uid: revoking?.uid } });
          return r.ok ? { ok: true, result: null } : { ok: false, error: r.error, outOfScope: r.outOfScope };
        }}
        success={() => ({ title: "Access revoked", body: <p>{revoking?.name || revoking?.email} is no longer an admin.</p> })}
        onFinished={fetchData}
      >
        <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          They lose admin access and every course assignment straight away. Their student account and attendance are not touched.
        </p>
      </ConfirmJobSheet>
    </div>
  );
}
