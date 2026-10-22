import type { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db, auth } from "@/lib/firebase-admin";
import { verifyAdmin, isSuperAdmin } from "@/lib/admin-auth";

export interface GrantResult {
  status: number;
  body: Record<string, unknown>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fail = (status: number, error: string, code?: string): GrantResult => ({ status, body: { error, ...(code ? { code } : {}) } });

/** Finds the DARS user doc for an email: the users collection first, then Firebase Auth as a fallback. */
async function findUserByEmail(email: string) {
  const snap = await db.collection("users").where("email", "==", email).limit(1).get();
  if (!snap.empty) return snap.docs[0];
  try {
    const record = await auth.getUserByEmail(email);
    const doc = await db.collection("users").doc(record.uid).get();
    return doc.exists ? doc : null;
  } catch {
    return null;
  }
}

/** Grants admin access by email. Super admins only. Shared by POST /api/admin/add and POST /api/admin. */
export async function grantAdmin(req: NextRequest): Promise<GrantResult> {
  const caller = await verifyAdmin(req);
  if (!isSuperAdmin(caller)) return fail(403, "Super admin access required", "FORBIDDEN");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid request.");
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) return fail(400, "Enter a valid email address.", "INVALID_EMAIL");

  // The grant card only sends an email, so default to the safest role: a scoped admin with no courses until edited.
  const scope = body.scope === "super" ? "super" : "defined";
  const requested = Array.isArray(body.assignedCourses) ? body.assignedCourses.filter((c): c is string => typeof c === "string") : [];

  const userDoc = await findUserByEmail(email);
  if (!userDoc) return fail(404, "No DARS account found for that email. They need to register first.", "USER_NOT_FOUND");

  const user = userDoc.data()!;
  if (user.banned) return fail(403, "That account is banned. Unban it before granting admin access.", "USER_BANNED");
  if (user.admin) return fail(409, `${email} is already an admin. Use Edit Role to change their access.`, "ALREADY_ADMIN");

  let assignedCourses: string[] = [];
  if (scope === "defined" && requested.length) {
    const courseSnaps = await db.getAll(...[...new Set(requested)].map((id) => db.collection("courses").doc(id)));
    if (courseSnaps.some((s) => !s.exists)) return fail(400, "One or more selected courses no longer exist.", "UNKNOWN_COURSE");
    assignedCourses = courseSnaps.map((s) => s.id);
  }

  const batch = db.batch();
  batch.update(userDoc.ref, { admin: true, scope, assignedCourses });
  for (const courseId of assignedCourses) {
    batch.update(db.collection("courses").doc(courseId), { assignedAdmins: FieldValue.arrayUnion(userDoc.id) });
  }
  batch.create(db.collection("activityLog").doc(), {
    action: "grant_admin",
    targetUid: userDoc.id,
    targetEmail: email,
    scope,
    courseIds: assignedCourses,
    adminUid: caller.uid,
    adminName: caller.name,
    timestamp: Date.now(),
  });
  await batch.commit();

  return { status: 201, body: { success: true, uid: userDoc.id, name: user.name ?? null, scope } };
}

/** Resolves a revoke target from a uid or an email. */
export async function resolveAdminTarget(body: { uid?: unknown; email?: unknown }): Promise<string | null> {
  if (typeof body.uid === "string" && body.uid) return body.uid;
  if (typeof body.email === "string" && body.email.trim()) {
    const doc = await findUserByEmail(body.email.trim().toLowerCase());
    return doc?.id ?? null;
  }
  return null;
}

/** Removes a revoked admin from every course's assignedAdmins list so no stale access is left behind. */
export async function clearCourseAssignments(uid: string) {
  const snap = await db.collection("courses").where("assignedAdmins", "array-contains", uid).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.update(d.ref, { assignedAdmins: FieldValue.arrayRemove(uid) }));
  await batch.commit();
}
