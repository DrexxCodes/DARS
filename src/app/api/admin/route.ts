import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { verifyAdmin, isSuperAdmin } from "@/lib/admin-auth";
import { grantAdmin, resolveAdminTarget, clearCourseAssignments } from "@/lib/admin-grant";
import { parseScopeInput, resolveScopes } from "@/constants/scopes";

// GET /api/admin — list all admins (super only)
export async function GET(req: NextRequest) {
  const adminUser = await verifyAdmin(req);
  if (!isSuperAdmin(adminUser)) {
    return NextResponse.json({ error: "Super admin access required" }, { status: 403 });
  }
  try {
    const snap = await db.collection("users").where("admin", "==", true).get();
    // users/{uid} is shared with NPS (bank details, phone, date of birth...), so only the fields this page needs are sent
    const admins = snap.docs.map((d) => {
      const u = d.data();
      return {
        uid: d.id,
        name: u.name ?? u.fullName ?? "",
        email: u.email ?? "",
        regNumber: u.regNumber ?? undefined,
        scope: u.scope ?? undefined,
        assignedCourses: Array.isArray(u.assignedCourses) ? u.assignedCourses : [],
        scopes: resolveScopes({ admin: true, scope: u.scope, scopes: u.scopes }),
        scopesSaved: Array.isArray(u.scopes),
        scopeLimits: u.scopeLimits ?? {},
        excludeFromExports: u.excludeFromExports === true,
      };
    });
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

// PATCH /api/admin — update an admin's role, scopes or assigned courses (super only)
export async function PATCH(req: NextRequest) {
  const adminUser = await verifyAdmin(req);
  if (!isSuperAdmin(adminUser)) {
    return NextResponse.json({ error: "Super admin access required" }, { status: 403 });
  }
  try {
    const { uid, scope, assignedCourses, scopes, scopeLimits } = await req.json();
    if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });
    if (uid === adminUser.uid) {
      return NextResponse.json({ error: "You cannot edit your own role." }, { status: 400 });
    }
    if (scope !== undefined && scope !== "super" && scope !== "defined") {
      return NextResponse.json({ error: "Role must be super or defined." }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (scope !== undefined) update.scope = scope;

    if (scope === "super") {
      // Super admins hold every scope, so a stored list would only be stale data
      update.scopes = [];
      update.scopeLimits = {};
    } else if (scopes !== undefined || scopeLimits !== undefined) {
      const parsed = parseScopeInput(scopes ?? [], scopeLimits);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      update.scopes = parsed.scopes;
      update.scopeLimits = parsed.scopeLimits;
    }

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
    await db.collection("activityLog").add({
      action: "edit_admin_role",
      targetUid: uid,
      scope: update.scope ?? null,
      scopes: (update.scopes as string[] | undefined) ?? null,
      adminUid: adminUser.uid,
      adminName: adminUser.name,
      timestamp: Date.now(),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update admin error:", error);
    return NextResponse.json({ error: "Failed to update admin" }, { status: 500 });
  }
}

// DELETE /api/admin — revoke admin access (super only)
export async function DELETE(req: NextRequest) {
  const adminUser = await verifyAdmin(req);
  if (!isSuperAdmin(adminUser)) {
    return NextResponse.json({ error: "Super admin access required" }, { status: 403 });
  }
  try {
    // Accepts either { uid } (Admin Management page) or { email } (Manage Admins page)
    const uid = await resolveAdminTarget(await req.json());
    if (!uid) return NextResponse.json({ error: "No account found for that admin." }, { status: 404 });
    if (uid === adminUser.uid) {
      return NextResponse.json({ error: "You cannot revoke your own access." }, { status: 400 });
    }
    await db.collection("users").doc(uid).update({ admin: false, scope: null, assignedCourses: [], scopes: [], scopeLimits: {} });
    await clearCourseAssignments(uid);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete admin error:", error);
    return NextResponse.json({ error: "Failed to revoke admin" }, { status: 500 });
  }
}
