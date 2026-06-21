import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase-admin";

interface SuperAdmin {
  uid: string;
  admin: boolean;
  scope: "super" | "defined";
  name?: string;
}

async function verifySuperAdmin(req: NextRequest): Promise<SuperAdmin | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const decoded = await auth.verifyIdToken(token);
    const userDoc = await db.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) return null;
    const user = userDoc.data()!;
    if (!user.admin || user.scope !== "super") return null;
    return { uid: decoded.uid, admin: true, scope: "super", name: user.name };
  } catch {
    return null;
  }
}

// Anchor document that owns the `locations` subcollection inside `globals`.
const locationsCollection = () =>
  db.collection("globals").doc("locationConfig").collection("locations");

// GET — list all location tags. Any authenticated admin can read (needed when
// picking a location during class creation), but only super admins can write.
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const decoded = await auth.verifyIdToken(token);
    const userDoc = await db.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists || !userDoc.data()?.admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const snap = await locationsCollection().orderBy("createdAt", "desc").get();
    const locations = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ locations });
  } catch (error) {
    console.error("List locations error:", error);
    return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 });
  }
}

// POST — create a new location tag. Super admin only.
export async function POST(req: NextRequest) {
  const superAdmin = await verifySuperAdmin(req);
  if (!superAdmin) return NextResponse.json({ error: "Super admin access required" }, { status: 403 });

  try {
    const { name, lat, lng, radiusMeters, isPrimary } = await req.json();

    if (!name || typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ error: "Name and captured coordinates are required." }, { status: 400 });
    }

    const radius = Number(radiusMeters);
    if (!radius || radius <= 0) {
      return NextResponse.json({ error: "A valid radius (in meters) is required." }, { status: 400 });
    }

    const now = Date.now();
    const colRef = locationsCollection();

    // If this is the first location ever, force it to be primary regardless of input.
    const existingSnap = await colRef.limit(1).get();
    const mustBePrimary = existingSnap.empty || !!isPrimary;

    const ref = colRef.doc();

    if (mustBePrimary) {
      // Demote any currently-primary location first.
      const primarySnap = await colRef.where("isPrimary", "==", true).get();
      const batch = db.batch();
      primarySnap.docs.forEach((d) => batch.update(d.ref, { isPrimary: false }));
      batch.set(ref, {
        name,
        lat,
        lng,
        radiusMeters: radius,
        isPrimary: true,
        createdAt: now,
        createdBy: superAdmin.uid,
      });
      await batch.commit();
    } else {
      await ref.set({
        name,
        lat,
        lng,
        radiusMeters: radius,
        isPrimary: false,
        createdAt: now,
        createdBy: superAdmin.uid,
      });
    }

    return NextResponse.json({ success: true, id: ref.id }, { status: 201 });
  } catch (error) {
    console.error("Create location error:", error);
    return NextResponse.json({ error: "Failed to create location" }, { status: 500 });
  }
}

// PATCH — rename a location, change its radius, or set it as primary. Super admin only.
export async function PATCH(req: NextRequest) {
  const superAdmin = await verifySuperAdmin(req);
  if (!superAdmin) return NextResponse.json({ error: "Super admin access required" }, { status: 403 });

  try {
    const { id, name, radiusMeters, setPrimary } = await req.json();
    if (!id) return NextResponse.json({ error: "Location id is required." }, { status: 400 });

    const colRef = locationsCollection();
    const ref = colRef.doc(id);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: "Location not found." }, { status: 404 });

    if (setPrimary) {
      const primarySnap = await colRef.where("isPrimary", "==", true).get();
      const batch = db.batch();
      primarySnap.docs.forEach((d) => {
        if (d.id !== id) batch.update(d.ref, { isPrimary: false });
      });
      batch.update(ref, { isPrimary: true });
      await batch.commit();
    }

    const update: Record<string, unknown> = {};
    if (name) update.name = name;
    if (radiusMeters !== undefined) {
      const radius = Number(radiusMeters);
      if (!radius || radius <= 0) {
        return NextResponse.json({ error: "A valid radius (in meters) is required." }, { status: 400 });
      }
      update.radiusMeters = radius;
    }
    if (Object.keys(update).length) await ref.update(update);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update location error:", error);
    return NextResponse.json({ error: "Failed to update location" }, { status: 500 });
  }
}

// DELETE — remove a location tag. Super admin only. Cannot delete the only
// remaining location, and cannot delete the primary while other tags exist
// (set another one as primary first).
export async function DELETE(req: NextRequest) {
  const superAdmin = await verifySuperAdmin(req);
  if (!superAdmin) return NextResponse.json({ error: "Super admin access required" }, { status: 403 });

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Location id is required." }, { status: 400 });

    const colRef = locationsCollection();
    const ref = colRef.doc(id);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: "Location not found." }, { status: 404 });

    const data = doc.data()!;
    const allSnap = await colRef.get();

    if (allSnap.size === 1) {
      return NextResponse.json({ error: "You must keep at least one location." }, { status: 400 });
    }

    if (data.isPrimary) {
      return NextResponse.json(
        { error: "Set another location as primary before deleting this one." },
        { status: 400 }
      );
    }

    await ref.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete location error:", error);
    return NextResponse.json({ error: "Failed to delete location" }, { status: 500 });
  }
}
