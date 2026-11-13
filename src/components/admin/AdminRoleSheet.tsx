"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookOpen, CheckCircle2, Shield } from "lucide-react";
import GlideSheet from "@/components/ui/GlideSheet";
import { Button, Select } from "@/components/ui";
import ScopePicker from "@/components/admin/ScopePicker";
import { adminFetch } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import type { ScopeKey } from "@/constants/scopes";

export interface AdminRecord {
  uid: string;
  name: string;
  email: string;
  scope?: "super" | "defined";
  assignedCourses?: string[];
  /** What they effectively hold (defaults filled in for admins saved before scopes existed). */
  scopes?: ScopeKey[];
  /** False while they're still on the pre-scopes defaults. */
  scopesSaved?: boolean;
  scopeLimits?: { "student.mark"?: number | null };
  regNumber?: string;
  excludeFromExports?: boolean;
}

export interface CourseLite {
  id: string;
  name: string;
  code: string;
}

interface Props {
  admin: AdminRecord | null;
  courses: CourseLite[];
  onClose: () => void;
  onSaved: () => void;
}

/** Edit an admin's role, courses, scopes and the per-class mark cap. A bottom sheet on phones, a drawer on larger screens. */
export default function AdminRoleSheet({ admin, courses, onClose, onSaved }: Props) {
  const [role, setRole] = useState<"super" | "defined">("defined");
  const [assigned, setAssigned] = useState<string[]>([]);
  const [scopes, setScopes] = useState<ScopeKey[]>([]);
  const [markLimit, setMarkLimit] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!admin) return;
    setRole(admin.scope ?? "defined");
    setAssigned(admin.assignedCourses ?? []);
    setScopes(admin.scopes ?? []);
    const limit = admin.scopeLimits?.["student.mark"];
    setMarkLimit(typeof limit === "number" ? String(limit) : "");
  }, [admin]);

  const save = async () => {
    if (!admin) return;
    setSaving(true);
    const r = await adminFetch("/api/admin", {
      method: "PATCH",
      body: {
        uid: admin.uid,
        scope: role,
        assignedCourses: role === "defined" ? assigned : admin.assignedCourses ?? [],
        ...(role === "defined" ? { scopes, scopeLimits: { "student.mark": scopes.includes("student.mark") && markLimit.trim() ? Number(markLimit) : null } } : {}),
      },
    });
    setSaving(false);
    if (!r.ok) {
      if (!r.outOfScope) toast.error(r.error || "Failed to save.");
      return;
    }
    toast.success(`${admin.name || admin.email}'s role was updated.`);
    onClose();
    onSaved();
  };

  return (
    <GlideSheet open={!!admin} onClose={() => !saving && onClose()} icon={<Shield className="h-5 w-5" />} title="Edit role" subtitle={admin ? admin.name || admin.email : undefined}>
      {admin && (
        <div className="space-y-5">
          <Select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value as "super" | "defined")}
            options={[
              { value: "super", label: "Super Admin: full access" },
              { value: "defined", label: "Scoped Admin: assigned courses and scopes" },
            ]}
          />

          {role === "super" ? (
            <p className="rounded-2xl bg-brand-50 p-3 text-sm text-brand-800 dark:bg-brand-950/50 dark:text-brand-200">Super admins hold every scope on every course, with no limits.</p>
          ) : (
            <>
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Assigned courses</p>
                {courses.length === 0 ? (
                  <p className="text-xs text-slate-400">No courses exist yet.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {courses.map((c) => {
                      const on = assigned.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setAssigned(on ? assigned.filter((id) => id !== c.id) : [...assigned, c.id])}
                          className={cn(
                            "flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left text-sm transition-colors",
                            on ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "border-slate-200 text-slate-600 hover:border-brand-300 dark:border-slate-700 dark:text-slate-400"
                          )}
                        >
                          <BookOpen className="h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">{c.code}</span>
                            <span className="block truncate text-xs opacity-70">{c.name}</span>
                          </span>
                          {on && <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-500" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Scopes</p>
                {admin.scopesSaved === false && (
                  <p className="mb-3 text-xs text-amber-700 dark:text-amber-400">
                    This admin is still on the original defaults (start, end, pause, look up students and mark). Saving stores the list you pick here.
                  </p>
                )}
                <ScopePicker value={scopes} onChange={setScopes} markLimit={markLimit} onMarkLimitChange={setMarkLimit} disabled={saving} />
              </div>
            </>
          )}

          <div className="sticky bottom-0 -mx-6 flex gap-2 border-t border-slate-100 bg-white/90 px-6 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button className="flex-1" loading={saving} icon={<Shield className="h-4 w-4" />} onClick={save}>Save role</Button>
          </div>
        </div>
      )}
    </GlideSheet>
  );
}
