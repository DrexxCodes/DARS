import { clientAuth } from "@/lib/firebase-client";
import { handleOutOfScope } from "@/lib/scope-events";

export interface RelistOutcome {
  ok: boolean;
  error?: string;
}

/** A super admin adds a delisted student back to a course. Their old attendance for it stays cleared. */
export async function relistCourse(courseId: string, regNumber: string): Promise<RelistOutcome> {
  try {
    const token = await clientAuth.currentUser?.getIdToken();
    const res = await fetch(`/api/admin/students/${encodeURIComponent(regNumber)}/relist`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ courseId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: handleOutOfScope(res.status, data) ? "" : data.error || "Couldn't add the student back." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error. Please check your connection." };
  }
}
