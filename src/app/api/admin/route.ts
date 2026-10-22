import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase-admin";
import { grantAdmin, resolveAdminTarget, clearCourseAssignments } from "@/lib/admin-grant";

interface AdminUser {
  uid: string;
  admin: boolean;
  scope?: "super" | "defined";
  [key: string]: unknown;
}

async function verifyAdmin(req: NextRequest): Promise<AdminUser | null> {
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

// GET /api/admin — list all admins (super only)
export async function GET(req: NextRequest) {
  const adminUser = await verifyAdmin(req);
  if (!adminUser || adminUser.scope !== "super") {
    return NextResponse.json({ error: "Super admin access required" }, { status: 403 });
  }
  try {
    const snap = await db.collection("users").where("admin", "==", true).get();
    const admins = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    return NextResponse.json({ admins });
  } catch (error) {
    console.error("Get admins error:", error);
    return NextResponse.json({ error: "Failed to fetch admins" }, { status: 500 });
  }
}

// POST /api/admin — grant admin access by email (same handler as /api/admin/add; the Manage Admins page uses this path)
export async function POST(req: NextRequest) {
  try {
    const { status, body } = await grantAdmin(req);
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("Grant admin error:", error);
    return NextResponse.json({ error: "Failed to grant admin access." }, { status: 500 });
  }
}

// PATCH /api/admin — update an admin's scope or assignedCourses (super only)
export async function PATCH(req: NextRequest) {
  const adminUser = await verifyAdmin(req);
  if (!adminUser || adminUser.scope !== "super") {
    return NextResponse.json({ error: "Super admin access required" }, { status: 403 });
  }
  try {
    const { uid, scope, assignedCourses } = await req.json();
    if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });
    if (uid === adminUser.uid) {
      return NextResponse.json({ error: "You cannot edit your own role." }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (scope !== undefined) update.scope = scope;
    if (assignedCourses !== undefined) {
      update.assignedCourses = assignedCourses;

      // Sync assignedAdmins array on each course doc
      const allCoursesSnap = await db.collection("courses").get();
      const batch = db.batch();

      for (const courseDoc of allCoursesSnap.docs) {
        const courseData = courseDoc.data();
        const currentAssigned: string[] = courseData.assignedAdmins || [];
        const shouldBeAssigned = (assignedCourses as string[]).includes(courseDoc.id);
        const isCurrentlyAssigned = currentAssigned.includes(uid);

        if (shouldBeAssigned && !isCurrentlyAssigned) {
          batch.update(courseDoc.ref, { assignedAdmins: [...currentAssigned, uid] });
        } else if (!shouldBeAssigned && isCurrentlyAssigned) {
          batch.update(courseDoc.ref, { assignedAdmins: currentAssigned.filter((id) => id !== uid) });
        }
      }
      await batch.commit();
    }

    await db.collection("users").doc(uid).update(update);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update admin error:", error);
    return NextResponse.json({ error: "Failed to update admin" }, { status: 500 });
  }
}

// DELETE /api/admin — revoke admin access (super only)
export async function DELETE(req: NextRequest) {
  const adminUser = await verifyAdmin(req);
  if (!adminUser || adminUser.scope !== "super") {
    return NextResponse.json({ error: "Super admin access required" }, { status: 403 });
  }
  try {
    // Accepts either { uid } (Admin Management page) or { email } (Manage Admins page)
    const uid = await resolveAdminTarget(await req.json());
    if (!uid) return NextResponse.json({ error: "No account found for that admin." }, { status: 404 });
    if (uid === adminUser.uid) {
      return NextResponse.json({ error: "You cannot revoke your own access." }, { status: 400 });
    }
    await db.collection("users").doc(uid).update({ admin: false, scope: null, assignedCourses: [] });
    await clearCourseAssignments(uid);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete admin error:", error);
    return NextResponse.json({ error: "Failed to revoke admin" }, { status: 500 });
  }
}
