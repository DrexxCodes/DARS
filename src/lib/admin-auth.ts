import type { NextRequest } from "next/server";
import { db, auth } from "@/lib/firebase-admin";

export interface AdminUser {
  uid: string;
  name: string;
  admin: boolean;
  scope?: "super" | "defined";
  /** Scoped admins only. Missing = the pre-scopes defaults (see LEGACY_DEFAULT_SCOPES). */
  scopes?: string[];
  scopeLimits?: { "student.mark"?: number | null };
  [key: string]: unknown;
}

export interface CourseInfo {
  id: string;
  name: string;
  code: string;
}

/** Resolves the caller from the Bearer token and returns them only if they are an admin. */
export async function verifyAdmin(req: NextRequest): Promise<AdminUser | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const decoded = await auth.verifyIdToken(token);
    const userDoc = await db.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) return null;
    const user = userDoc.data()!;
    if (!user.admin) return null;
    return { uid: decoded.uid, ...user } as AdminUser;
  } catch {
    return null;
  }
}

export const isSuperAdmin = (admin: AdminUser | null): admin is AdminUser =>
  !!admin && admin.scope === "super";

/** Courses this admin may act on: all for super admins, only assigned ones for scoped admins. */
export async function getAccessibleCourses(admin: AdminUser, onlyCourseId?: string | null): Promise<CourseInfo[]> {
  const snap = await db.collection("courses").get();
  return snap.docs
    .filter((d) => admin.scope !== "defined" || (d.data().assignedAdmins as string[] | undefined)?.includes(admin.uid))
    .filter((d) => !onlyCourseId || d.id === onlyCourseId)
    .map((d) => ({ id: d.id, name: d.data().name ?? d.id, code: d.data().code ?? "" }));
}

/** Scoped admins may only act on courses they're assigned to. Super admins: any course. Returns false if the course is missing. */
export async function canAccessCourse(admin: AdminUser, courseId: string): Promise<boolean> {
  if (admin.scope === "super") return true;
  const snap = await db.collection("courses").doc(courseId).get();
  return snap.exists && ((snap.data()!.assignedAdmins as string[] | undefined) ?? []).includes(admin.uid);
}
