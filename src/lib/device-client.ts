import { clientAuth } from "@/lib/firebase-client";

/** A super admin unlinks a student's phone/browser so their next mark links a new one. */
export async function resetStudentDevice(regNumber: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const token = await clientAuth.currentUser?.getIdToken();
    const res = await fetch(`/api/admin/students/${encodeURIComponent(regNumber)}/device`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || "Couldn't reset the device." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error. Please check your connection." };
  }
}
