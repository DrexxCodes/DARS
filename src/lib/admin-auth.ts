import type { NextRequest } from "next/server";
import { db, auth } from "@/lib/firebase-admin";

export interface AdminUser {
  uid: string;
  name: string;
  admin: boolean;
  scope?: "super" | "defined";
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
