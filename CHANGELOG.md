# DARS Changelog

## v2.0.0 — Multi-Session Attendance + Role Management

### Breaking Schema Changes

#### `classes/{courseId}/sessions/{autoId}` (was `/{dateKey}`)
- Sessions now use **auto-generated Firestore document IDs** (`classId`) instead of `YYYY-MM-DD` date keys.
- New fields: `classId` (mirrored), `date` (ISO string, stored for display), `courseId`, `locationId`, `locationName`.
- The same course can now hold **multiple classes per day**.

#### `globals/{courseId}`
- Added `currentClassId: string | null` — points to the active session's document ID, or `null` when no class is running.
- `currentClassId` is set to `null` when a class ends, so the mark page correctly shows "No classes right now!".

#### `courses/{courseId}`
- Added `totalClasses: number` — a **denormalized counter** incremented on class start and decremented on class deletion.
- Used instead of live collection counts, reducing Firestore reads on student lookup and exports.

#### `students/{regNumber}/attendance/{courseId}/records/{classId}`
- Records are now **keyed by `classId`** (was `dateKey`).
- New fields: `classId`, `date`, `courseId`, `markedBy`.
- Duplicate check uses `classId` — a student can attend two classes on the same day if the course runs twice.

### New Features

#### Multi-Session Classes
- Each course can hold unlimited class sessions per semester.
- Every "Start Class" creates a new unique session under `classes/{courseId}/sessions/{autoId}`.
- Attendance percentage is calculated as `sessionsAttended / totalClasses * 100`.

#### Delete a Single Class Session (Super Admin)
- Super admins can delete individual sessions from the Class History panel.
- All student attendance records for that specific `classId` are atomically removed.
- Each affected student's attendance is decremented honestly — no phantom records.
- `totalClasses` counter is decremented on the course doc.

#### Delete Entire Course (Super Admin)
- Deletes the course doc, all sessions, all student attendance records, the globals doc, and all activity log entries tied to the course.

#### Scoped Admin Role Management (Super Admin)
- Super admins can edit any scoped admin's role and course assignments inline on the Admin Management page.
- Changing a scoped admin's `assignedCourses` atomically syncs the `assignedAdmins` array on every affected course doc.
- Super admins can also promote a scoped admin to super or revoke access entirely.

#### Locked Course Cards (Scoped Admins)
- When a scoped admin searches a student, courses they are not assigned to are shown as **greyed-out, locked cards** ("Restricted — Not assigned to you").
- The API returns `locked: true` for unassigned courses and makes zero Firestore reads for them — just the course metadata from an in-memory loop.

#### Colour-Coded PDF Exports
- The "attended" column in all PDF exports renders **green cells for Present** and **red cells for Absent**.
- All classes are listed per export — students with no record for a session show "Absent".
- CSV exports contain "Present" / "Absent" in the attended column for easy spreadsheet filtering.

#### Location Picked at Class Start
- Admins must select a location tag before starting a class.
- The selected location is stored on the session doc for historical reference.
- If no location tags exist, a warning prompts the admin to create one on the Tags page first.

### Migration Notes

> Existing attendance records keyed by `dateKey` are **not** automatically migrated.
> Run the one-off migration script below or flush old data from Firestore Console before deploying v2.

```bash
# One-off migration: convert dateKey records to classId records
# Run this from a Node script with Firebase Admin SDK credentials
# See /scripts/migrate-v1-to-v2.md for full instructions
```

New deployments are unaffected — create courses fresh and `totalClasses` will always be in sync.

---

_Built by Drexx Technologies · DARS for UNIZIK Political Science Department_
