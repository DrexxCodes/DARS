"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Badge, Select } from "@/components/ui";
import { clientAuth } from "@/lib/firebase-client";
import { toast } from "sonner";
import { validateRegNumber, normalizeRegNumber } from "@/lib/utils";
import Papa from "papaparse";
import {
  UserPlus, Upload, ShieldCheck, ShieldOff,
  CheckCircle2, AlertCircle, Loader2, BookOpen
} from "lucide-react";

interface Course { id: string; name: string; code: string; }

interface UploadRow { name: string; email: string; regNumber: string; status?: "pending" | "success" | "error"; error?: string; }

export default function AdminAddPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminScope, setAdminScope] = useState<"super" | "defined">("defined");
  const [assignedCourses, setAssignedCourses] = useState<string[]>([]);
  const [grantingAdmin, setGrantingAdmin] = useState(false);

  const [csvRows, setCsvRows] = useState<UploadRow[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && (!profile || profile.scope !== "super")) router.push("/");
  }, [authLoading, profile, router]);

  const getToken = async () => clientAuth.currentUser?.getIdToken();

  const fetchCourses = useCallback(async () => {
    const token = await getToken();
    const res = await fetch("/api/courses?all=true", { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setCourses(data.courses || []);
  }, []);

  useEffect(() => { if (profile?.scope === "super") fetchCourses(); }, [profile, fetchCourses]);

  const handleGrantAdmin = async () => {
    if (!adminEmail) { toast.error("Email is required"); return; }
    setGrantingAdmin(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: adminEmail, scope: adminScope, assignedCourses }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(`Admin access granted to ${adminEmail}`);
      setAdminEmail("");
      setAssignedCourses([]);
    } catch { toast.error("Failed to grant admin."); } finally { setGrantingAdmin(false); }
  };

  const handleRevokeAdmin = async () => {
    if (!adminEmail) { toast.error("Enter the user's email first"); return; }
    try {
      // First look up uid from email
      const token = await getToken();
      const searchRes = await fetch(`/api/auth/verify-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: adminEmail }),
      });
      // Simplified: call admin DELETE with email
      const res = await fetch("/api/admin", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: adminEmail }),
      });
      void searchRes;
      if (!res.ok) { toast.error("User not found or revoke failed"); return; }
      toast.success("Admin access revoked");
      setAdminEmail("");
    } catch { toast.error("Revoke failed."); }
  };

  const handleCSVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse<{ name: string; email: string; regNumber: string }>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows: UploadRow[] = result.data.map((r) => ({
          name: r.name?.trim() || "",
          email: r.email?.trim() || "",
          regNumber: r.regNumber?.trim() || "",
          status: "pending",
        }));
        setCsvRows(rows);
        setUploadProgress(0);
      },
    });
  };

  const handleBulkUpload = async () => {
    if (!csvRows.length) return;
    setUploading(true);
    const updated = [...csvRows];
    let done = 0;

    for (let i = 0; i < updated.length; i++) {
      const row = updated[i];
      // Validate
      if (!row.name || !row.email || !row.regNumber) {
        updated[i] = { ...row, status: "error", error: "Missing fields" };
        done++;
        setUploadProgress(Math.round((done / updated.length) * 100));
        setCsvRows([...updated]);
        continue;
      }
      if (!validateRegNumber(normalizeRegNumber(row.regNumber))) {
        updated[i] = { ...row, status: "error", error: "Invalid reg number" };
        done++;
        setUploadProgress(Math.round((done / updated.length) * 100));
        setCsvRows([...updated]);
        continue;
      }

      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: row.name,
            email: row.email,
            regNumber: normalizeRegNumber(row.regNumber),
            password: normalizeRegNumber(row.regNumber), // default password = reg number
          }),
        });
        const data = await res.json();
        if (res.ok) {
          updated[i] = { ...row, status: "success" };
        } else {
          updated[i] = { ...row, status: "error", error: data.error };
        }
      } catch {
        updated[i] = { ...row, status: "error", error: "Network error" };
      }

      done++;
      setUploadProgress(Math.round((done / updated.length) * 100));
      setCsvRows([...updated]);
    }

    setUploading(false);
    const successes = updated.filter((r) => r.status === "success").length;
    toast.success(`Bulk upload complete: ${successes}/${updated.length} registered`);
  };

  const toggleCourse = (id: string) => {
    setAssignedCourses((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  if (authLoading || !profile || profile.scope !== "super") return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Manage Admins</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Grant or revoke admin access · Bulk register students</p>
      </div>

      {/* Grant admin */}
      <Card className="p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-brand-500" /> Grant Admin Access
        </h2>

        <Input
          label="User Email"
          type="email"
          placeholder="user@example.com"
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          hint="The user must have a DARS account already."
        />

        <Select
          label="Admin Scope"
          value={adminScope}
          onChange={(e) => setAdminScope(e.target.value as "super" | "defined")}
          options={[
            { value: "defined", label: "Defined — assigned courses only" },
            { value: "super", label: "Super — full access to all courses" },
          ]}
        />

        {adminScope === "defined" && courses.length > 0 && (
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Assign Courses</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {courses.map((c) => (
                <button
                  key={c.id}
                  onClick={() => toggleCourse(c.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-sm text-left transition-all ${
                    assignedCourses.includes(c.id)
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-brand-300"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  <div>
                    <p className="font-medium">{c.code}</p>
                    <p className="text-xs opacity-70">{c.name}</p>
                  </div>
                  {assignedCourses.includes(c.id) && (
                    <CheckCircle2 className="w-4 h-4 ml-auto text-brand-500" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button icon={<UserPlus className="w-4 h-4" />} loading={grantingAdmin} onClick={handleGrantAdmin}>
            Grant Access
          </Button>
          <Button variant="danger" icon={<ShieldOff className="w-4 h-4" />} onClick={handleRevokeAdmin}>
            Revoke Access
          </Button>
        </div>
      </Card>

      {/* Bulk student upload */}
      <Card className="p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
          <Upload className="w-4 h-4 text-brand-500" /> Bulk Student Registration (CSV)
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Upload a CSV with columns: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">name, email, regNumber</code>.
          Default password will be the student&apos;s reg number.
        </p>

        <div
          className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center cursor-pointer hover:border-brand-400 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="w-6 h-6 mx-auto mb-2 text-slate-400" />
          <p className="text-sm text-slate-500">Click to upload CSV file</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSVFile} />
        </div>

        {csvRows.length > 0 && (
          <>
            {/* Progress */}
            {uploading && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Uploading...</span><span>{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            {/* Row preview */}
            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {csvRows.map((row, i) => (
                <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs ${
                  row.status === "success" ? "bg-brand-50 dark:bg-brand-950"
                    : row.status === "error" ? "bg-red-50 dark:bg-red-950"
                    : "bg-slate-50 dark:bg-slate-800"
                }`}>
                  <div className="shrink-0">
                    {row.status === "success" ? <CheckCircle2 className="w-3.5 h-3.5 text-brand-500" />
                      : row.status === "error" ? <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                      : uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                      : <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-slate-900 dark:text-white">{row.name}</span>
                    <span className="text-slate-400 ml-2">{row.email}</span>
                    <span className="font-mono text-slate-400 ml-2">{row.regNumber}</span>
                  </div>
                  {row.status === "error" && (
                    <Badge variant="red">{row.error}</Badge>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button icon={<Upload className="w-4 h-4" />} loading={uploading} onClick={handleBulkUpload}>
                Upload {csvRows.length} Students
              </Button>
              <Button variant="outline" onClick={() => { setCsvRows([]); setUploadProgress(0); }}>
                Clear
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
