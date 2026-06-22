"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Card, Button, Badge, Input, Select, Skeleton } from "@/components/ui";
import { clientAuth } from "@/lib/firebase-client";
import { toast } from "sonner";
import { UserCog, Mail, BookOpen, Shield, ShieldOff, Lock } from "lucide-react";

interface AdminRecord {
  uid: string;
  name: string;
  email: string;
  scope?: "super" | "defined";
  assignedCourses?: string[];
}
interface Course { id: string; name: string; code: string; assignedAdmins?: string[]; }

export default function AdminManagePage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editScope, setEditScope] = useState<"super" | "defined">("defined");
  const [editCourses, setEditCourses] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Add admin
  const [email, setEmail] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);

  useEffect(() => {
    if (!authLoading && (!profile || profile.scope !== "super")) router.push("/admin/create");
  }, [authLoading, profile, router]);

  const getToken = async () => clientAuth.currentUser?.getIdToken();

  const fetchData = useCallback(async () => {
    setLoadingAdmins(true);
    try {
      const token = await getToken();
      const [aRes, cRes] = await Promise.all([
        fetch("/api/admin", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/courses?all=true", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [a, c] = await Promise.all([aRes.json(), cRes.json()]);
      setAdmins(a.admins || []);
      setCourses(c.courses || []);
    } catch { /* silent */ } finally { setLoadingAdmins(false); }
  }, []);

  useEffect(() => { if (profile?.scope === "super") fetchData(); }, [profile, fetchData]);

  const startEdit = (admin: AdminRecord) => {
    setEditingUid(admin.uid);
    setEditScope(admin.scope || "defined");
    setEditCourses(admin.assignedCourses || []);
  };

  const saveEdit = async () => {
    if (!editingUid) return;
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid: editingUid, scope: editScope, assignedCourses: editCourses }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success("Admin role updated.");
      setEditingUid(null);
      fetchData();
    } catch { toast.error("Failed to save."); } finally { setSaving(false); }
  };

  const revokeAdmin = async (uid: string) => {
    if (!confirm("Revoke this admin's access?")) return;
    try {
      const token = await getToken();
      const res = await fetch("/api/admin", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success("Admin access revoked.");
      fetchData();
    } catch { toast.error("Failed to revoke."); }
  };

  const addAdmin = async () => {
    if (!email) return;
    setAddingAdmin(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/add", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(`Admin access granted to ${email}`);
      setEmail("");
      fetchData();
    } catch { toast.error("Failed to add admin."); } finally { setAddingAdmin(false); }
  };

  if (authLoading || profile?.scope !== "super") return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Management</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Grant, edit, or revoke admin roles and course assignments
        </p>
      </div>

      {/* Add admin */}
      <Card className="p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Grant Admin Access</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail className="w-4 h-4" />}
            className="flex-1"
          />
          <Button loading={addingAdmin} onClick={addAdmin}>Grant Access</Button>
        </div>
      </Card>

      {/* Admin list */}
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Current Admins</h2>
        {loadingAdmins ? (
          <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : admins.length === 0 ? (
          <p className="text-sm text-slate-400 py-3 text-center">No admins found.</p>
        ) : (
          <div className="space-y-3">
            {admins.map((admin) => (
              <div key={admin.uid} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center text-brand-700 dark:text-brand-300 font-bold text-sm">
                      {admin.name?.[0]?.toUpperCase() || "A"}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-slate-900 dark:text-white">{admin.name}</p>
                      <p className="text-xs text-slate-400">{admin.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={admin.scope === "super" ? "green" : "blue"}>
                      {admin.scope === "super" ? "Super Admin" : "Scoped Admin"}
                    </Badge>
                    {admin.uid !== profile.uid && (
                      <>
                        <Button size="xs" variant="outline" icon={<UserCog className="w-3.5 h-3.5" />}
                          onClick={() => editingUid === admin.uid ? setEditingUid(null) : startEdit(admin)}>
                          {editingUid === admin.uid ? "Cancel" : "Edit Role"}
                        </Button>
                        <Button size="xs" variant="danger" icon={<ShieldOff className="w-3.5 h-3.5" />}
                          onClick={() => revokeAdmin(admin.uid)}>
                          Revoke
                        </Button>
                      </>
                    )}
                    {admin.uid === profile.uid && (
                      <Badge variant="slate">You</Badge>
                    )}
                  </div>
                </div>

                {/* Inline editor */}
                {editingUid === admin.uid && (
                  <div className="border-t border-slate-100 dark:border-slate-700 pt-3 space-y-3 animate-slide-up">
                    <Select
                      label="Role"
                      value={editScope}
                      onChange={(e) => setEditScope(e.target.value as "super" | "defined")}
                      options={[
                        { value: "super", label: "Super Admin — full access" },
                        { value: "defined", label: "Scoped Admin — assigned courses only" },
                      ]}
                    />

                    {editScope === "defined" && (
                      <div>
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                          Assigned Courses
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {courses.map((course) => {
                            const checked = editCourses.includes(course.id);
                            return (
                              <label key={course.id}
                                className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg cursor-pointer border transition-colors ${
                                  checked
                                    ? "bg-brand-50 dark:bg-brand-950 border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300"
                                    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                                }`}
                              >
                                <input type="checkbox" className="accent-brand-600"
                                  checked={checked}
                                  onChange={(e) => {
                                    setEditCourses(
                                      e.target.checked
                                        ? [...editCourses, course.id]
                                        : editCourses.filter((id) => id !== course.id)
                                    );
                                  }}
                                />
                                <BookOpen className="w-3 h-3 shrink-0" />
                                <span className="truncate">{course.code} — {course.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditingUid(null)}>Cancel</Button>
                      <Button size="sm" icon={<Shield className="w-3.5 h-3.5" />}
                        loading={saving} onClick={saveEdit}>
                        Save Role
                      </Button>
                    </div>
                  </div>
                )}

                {/* Assigned courses display (view mode) */}
                {editingUid !== admin.uid && admin.scope === "defined" && (admin.assignedCourses?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {admin.assignedCourses!.map((cId) => {
                      const c = courses.find((x) => x.id === cId);
                      return c ? (
                        <span key={cId} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {c.code}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}

                {editingUid !== admin.uid && admin.scope === "defined" && !admin.assignedCourses?.length && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <Lock className="w-3 h-3" />
                    <span>No courses assigned yet</span>
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
