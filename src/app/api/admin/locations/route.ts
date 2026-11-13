import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { verifyAdmin } from "@/lib/admin-auth";
import { requireScope } from "@/lib/scopes";
import { RADIUS_LIMITS } from "@/constants/location";

const radiusError = `Check-in range must be between ${RADIUS_LIMITS.MIN_M} and ${RADIUS_LIMITS.MAX_M} meters.`;
const radiusOk = (r: number) => Number.isFinite(r) && r >= RADIUS_LIMITS.MIN_M && r <= RADIUS_LIMITS.MAX_M;

// Anchor document that owns the `locations` subcollection inside `globals`.
const locationsCollection = () =>
  db.collection("globals").doc("locationConfig").collection("locations");

// GET — list all location tags. Any admin can read (needed when picking a location during class creation).
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  try {
    const snap = await locationsCollection().orderBy("createdAt", "desc").get();
    const locations = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ locations });
  } catch (error) {
    console.error("List locations error:", error);
    return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 });
  }
}

// POST — create a new location tag. Scope: tags.create
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const denied = requireScope(admin, "tags.create");
  if (denied) return denied;

  try {
    const { name, lat, lng, accuracy, radiusMeters, isPrimary } = await req.json();

    if (!name || typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ error: "Name and captured coordinates are required." }, { status: 400 });
    }

    const radius = Number(radiusMeters);
    if (!radiusOk(radius)) return NextResponse.json({ error: radiusError }, { status: 400 });

    const now = Date.now();
    const colRef = locationsCollection();
    // Stored for reference: how precise the GPS fix was when the centre point was captured
    const capturedAccuracyMeters = typeof accuracy === "number" && Number.isFinite(accuracy) ? Math.round(accuracy) : null;

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
        capturedAccuracyMeters,
        isPrimary: true,
        createdAt: now,
        createdBy: admin.uid,
      });
      await batch.commit();
    } else {
      await ref.set({
        name,
        lat,
        lng,
        radiusMeters: radius,
        capturedAccuracyMeters,
        isPrimary: false,
        createdAt: now,
        createdBy: admin.uid,
      });
    }

    return NextResponse.json({ success: true, id: ref.id }, { status: 201 });
  } catch (error) {
    console.error("Create location error:", error);
    return NextResponse.json({ error: "Failed to create location" }, { status: 500 });
  }
}

// PATCH — rename a location, change its radius, or set it as primary. Scope: tags.edit
export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const denied = requireScope(admin, "tags.edit");
  if (denied) return denied;

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
      if (!radiusOk(radius)) return NextResponse.json({ error: radiusError }, { status: 400 });
      update.radiusMeters = Math.round(radius);
    }
    if (Object.keys(update).length) await ref.update(update);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update location error:", error);
    return NextResponse.json({ error: "Failed to update location" }, { status: 500 });
  }
}

// DELETE — remove a location tag. Scope: tags.delete. Cannot delete the only
// remaining location, and cannot delete the primary while other tags exist
// (set another one as primary first).
export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const denied = requireScope(admin, "tags.delete");
  if (denied) return denied;

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

    // Don't let a location be deleted while a live class is using it
    const inUse = await db.collection("globals")
      .where("locationId", "==", id).where("classActive", "==", true).limit(1).get();
    if (!inUse.empty) {
      return NextResponse.json({ error: "A class is currently running at this location. End it first." }, { status: 400 });
    }

    await ref.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete location error:", error);
    return NextResponse.json({ error: "Failed to delete location" }, { status: 500 });
  }
}
