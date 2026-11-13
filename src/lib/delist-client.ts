import { clientAuth } from "@/lib/firebase-client";
import { handleOutOfScope } from "@/lib/scope-events";

export interface DelistOutcome {
  ok: boolean;
  recordsCleared?: number;
  error?: string;
}

/**
 * Delists a course. Without `regNumber` the signed-in student drops it themselves; with one, a super admin delists that
 * student. Either way it's permanent and the student's attendance for the course is wiped.
 */
export async function delistCourse(courseId: string, regNumber?: string): Promise<DelistOutcome> {
  try {
    const token = await clientAuth.currentUser?.getIdToken();
    const res = await fetch(regNumber ? `/api/admin/students/${encodeURIComponent(regNumber)}/delist` : "/api/mark/delist", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ courseId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: handleOutOfScope(res.status, data) ? "" : data.error || "Couldn't delist the course." };
    return { ok: true, recordsCleared: data.recordsCleared ?? 0 };
  } catch {
    return { ok: false, error: "Network error. Please check your connection." };
  }
}
