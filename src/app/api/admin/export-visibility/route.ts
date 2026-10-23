import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { verifyAdmin, isSuperAdmin } from "@/lib/admin-auth";

/**
 * PATCH /api/admin/export-visibility  { exclude: boolean, uid?: string }
 *
 * Sets whether an admin's own attendance records are left out of PDF exports.
 * - No `uid` (or your own uid): any admin changes their own setting.
 * - Another admin's `uid`: super admins only (they can override anyone's choice).
 */
export async function PATCH(req: NextRequest) {
  const caller = await verifyAdmin(req);
  if (!caller) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.exclude !== "boolean") return NextResponse.json({ error: "exclude must be true or false." }, { status: 400 });

    const targetUid = typeof body.uid === "string" && body.uid ? body.uid : caller.uid;
    if (targetUid !== caller.uid && !isSuperAdmin(caller)) {
      return NextResponse.json({ error: "Only super admins can change another admin's export setting." }, { status: 403 });
    }

    const ref = db.collection("users").doc(targetUid);
    const target = await ref.get();
    if (!target.exists || !target.data()?.admin) return NextResponse.json({ error: "That account is not an admin." }, { status: 404 });
    if (target.data()?.excludeFromExports === body.exclude) return NextResponse.json({ success: true, excludeFromExports: body.exclude });

    await ref.update({ excludeFromExports: body.exclude });
    await db.collection("activityLog").add({
      action: "set_export_visibility",
      targetUid,
      targetName: target.data()?.name ?? null,
      excludeFromExports: body.exclude,
      adminUid: caller.uid,
      adminName: caller.name,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true, excludeFromExports: body.exclude });
  } catch (error) {
    console.error("Export visibility error:", error);
    return NextResponse.json({ error: "Failed to update the setting." }, { status: 500 });
  }
}
