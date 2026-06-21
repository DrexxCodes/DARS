import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase-admin";

type SuperAdmin = {
  uid: string;
  admin: boolean;
  scope: "super" | "defined";
  name?: string;
  assignedCourses?: string[];
};

async function verifySuperAdmin(req: NextRequest): Promise<SuperAdmin | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const decoded = await auth.verifyIdToken(token);
    const userDoc = await db.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) return null;
    const user = userDoc.data() as {
      admin?: boolean;
      scope?: string;
      name?: string;
      assignedCourses?: string[];
    };
    if (!user.admin || user.scope !== "super") return null;
    return {
      uid: decoded.uid,
      admin: true,
      scope: "super",
      name: user.name,
      assignedCourses: user.assignedCourses,
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const superAdmin = await verifySuperAdmin(req);
  if (!superAdmin) return NextResponse.json({ error: "Super admin access required" }, { status: 403 });

  try {
    const { email, scope, assignedCourses } = await req.json();
    if (!email || !scope) return NextResponse.json({ error: "Email and scope are required" }, { status: 400 });
    if (!["super", "defined"].includes(scope)) return NextResponse.json({ error: "Scope must be super or defined" }, { status: 400 });

    const userRecord = await auth.getUserByEmail(email);
    const userDoc = await db.collection("users").doc(userRecord.uid).get();
    if (!userDoc.exists) return NextResponse.json({ error: "User profile not found. They must register first." }, { status: 404 });

    await db.collection("users").doc(userRecord.uid).update({
      admin: true,
      scope,
      assignedCourses: assignedCourses || [],
    });

    // If defined admin is assigned to courses, update those course records too
    if (scope === "defined" && assignedCourses?.length) {
      for (const courseId of assignedCourses) {
        const courseDoc = await db.collection("courses").doc(courseId).get();
        if (courseDoc.exists) {
          const existing = courseDoc.data()?.assignedAdmins || [];
          if (!existing.includes(userRecord.uid)) {
            await db.collection("courses").doc(courseId).update({
              assignedAdmins: [...existing, userRecord.uid],
            });
          }
        }
      }
    }

    await db.collection("activityLog").add({
      action: "grant_admin",
      targetEmail: email,
      targetUid: userRecord.uid,
      scope,
      adminUid: superAdmin.uid,
      adminName: superAdmin.name,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true, uid: userRecord.uid });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === "auth/user-not-found") {
      return NextResponse.json({ error: "No account found with that email." }, { status: 404 });
    }
    console.error("Grant admin error:", error);
    return NextResponse.json({ error: "Failed to grant admin access" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const superAdmin = await verifySuperAdmin(req);
  if (!superAdmin) return NextResponse.json({ error: "Super admin access required" }, { status: 403 });

  try {
    const body = await req.json();
    let uid = body.uid;

    // Allow revoking by email
    if (!uid && body.email) {
      const userRecord = await auth.getUserByEmail(body.email);
      uid = userRecord.uid;
    }

    if (!uid) return NextResponse.json({ error: "uid or email required" }, { status: 400 });

    await db.collection("users").doc(uid).update({
      admin: false,
      scope: null,
      assignedCourses: [],
    });

    await db.collection("activityLog").add({
      action: "revoke_admin",
      targetUid: uid,
      adminUid: superAdmin.uid,
      adminName: superAdmin.name,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === "auth/user-not-found") {
      return NextResponse.json({ error: "No account found with that email." }, { status: 404 });
    }
    console.error("Revoke admin error:", error);
    return NextResponse.json({ error: "Failed to revoke admin" }, { status: 500 });
  }
}
