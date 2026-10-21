# DARS Changelog

## v2.0.5 — Revoke a student's attendance for a day + Admin Reset

### Revoke attendance for a day (any admin)
- **Students page** (`src/app/admin/students/page.tsx`): new **Revoke a day** button next to the searched student.
- **`src/components/admin/RevokeAttendanceDialog.tsx`** (new): pick a day and a course (or all your courses), **Find attendance** shows exactly which records would go (course, time, late), then **Revoke N records** confirms. Nothing is removed until that last click.
- **`src/app/api/admin/students/[regNumber]/revoke/route.ts`** (new): `GET` previews, `POST` revokes. One Firestore transaction deletes the records and decrements the student's `totalPresence` and each session's `totalPresence`, so a double-click can't decrement twice. Scoped admins can only revoke in courses they're assigned to. Logged to `activityLog` as `revoke_attendance`.
- The day is matched against the `date` stored when the student marked (a UTC date, as `/api/mark` already writes it).
- The device claims from the original mark are kept, so the same phone can't simply re-mark that class. If a revoke was a mistake, use **Mark for another student**, which skips the device check.

### Admin Reset (super admins only)
- **`src/app/admin/reset/page.tsx`** (new) + nav item **Admin Reset** (`useNavItems.ts`, appears in the sidebar and under More on mobile). Shows live counts, what is deleted and kept, and requires typing `sudo reset` exactly before the button enables.
- **`src/app/api/admin/reset/route.ts`** (new): `GET` returns counts; `POST` requires `{ confirmation: "sudo reset" }` (checked again on the server). Order: (1) end every live class and zero `totalClasses` so nobody can mark mid-reset, (2) recursively delete `classes/` (all sessions and their device claims), (3) delete every student's `attendance` history and set `totalPresence` to 0, (4) write a `reset_all` entry to `activityLog`.
- **Kept:** students, courses, admins, location tags, and the activity log.
- It is idempotent. If it times out on a large database, run it again to finish. `maxDuration` is set to 60 s.
- **`src/constants/reset.ts`**, **`src/types/admin.ts`**, **`src/lib/admin-auth.ts`** (new): shared phrase, types, and `verifyAdmin` / course-scope helpers used by the new routes.

## v2.0.4 — Location tags: accuracy shown and checked at capture

- **`src/lib/location-accuracy.ts`** (new): accuracy bands for a captured centre point: good ≤ 20 m, fair ≤ 50 m, poor above 50 m.
- **`src/lib/geolocation-client.ts`**: new `getBestPosition()`. It listens for GPS readings for up to 10 s (stopping early at ≤ 15 m) and keeps the most accurate one, instead of trusting the first rough fix. `getFreshPosition()` (used when students mark) is unchanged.
- **`src/app/admin/tags/page.tsx`**: capture uses `getBestPosition()`. After capture the form shows "Accuracy ±N m" with a good/fair/poor message, and a **Recapture** button when it isn't good. A poor fix shows a red warning but doesn't block saving. Name and range are kept when recapturing.
- **`src/app/api/admin/locations/route.ts`**: stores `capturedAccuracyMeters` on new tags (null if not provided). Existing tags are unaffected.
- Student marking is unchanged: the 150 m accuracy cap and the radius check work as before.

## v2.0.3 — Anti-proxy marking: one device per class (IP + fingerprint)

### Rule (enforced per class session, so a student can still mark two different courses from one phone)
A self-mark is rejected with *"Couldn't mark this attendance. Something looks sketchy."* (`DEVICE_CONFLICT`, 403) when, for the same `classId`:
1. the same browser profile (`deviceId`) already marked, **or**
2. the same device fingerprint **on the same IP** already marked (incognito, other browser, installed app vs Safari on one phone).

The same IP alone is allowed (hotspots, shared mobile-carrier IPs) and the same fingerprint alone is allowed (identical phone models on different networks). Admin "mark for another student" skips the check.

### Changes
- **`src/types/device.ts`** (new): `DeviceSignals` type shared by client and server.
- **`src/lib/device-fingerprint.ts`** (new, client): SHA-256 fingerprint of traits that are the same in a normal tab, a private tab and the installed app, plus a random `deviceId` in localStorage. Canvas/audio hashes and window size are deliberately excluded because Safari adds noise in private mode. Memoised and pre-warmed on mount.
- **`src/lib/device-check.ts`** (new, server): `getClientIp` (first `x-forwarded-for` entry, IPv6 reduced to /64), input validation, salted hashing, and `buildDeviceClaims`, which creates two deterministic claim docs at `classes/{courseId}/sessions/{classId}/claims/{d_<device> | p_<fp>_<ip>}`. Only hashes are stored.
- **`src/app/api/mark/route.ts`**: checks claims with one `getAll`, and writes them in the same atomic batch as the attendance record, so racing requests can't both pass. The route now reads globals + student in parallel, then location + user + duplicate + claims in parallel (was 6 sequential reads, so this is net faster). Rate limiting now uses `getClientIp`. Conflicts are logged as `[device-conflict]` with the registration number that already marked.
- **`src/components/mark/MarkButton.tsx`**: sends `fingerprint` and `deviceId` with the mark request.
- **`.env.local.example`**: added `DEVICE_HASH_SALT`.

### Setup
- **Optional but recommended:** set `DEVICE_HASH_SALT` (Vercel: Project Settings → Environment Variables) to a long random string, then redeploy. Without it a built-in default salt is used; the check still works, but stored hashes are slightly easier to reverse if the database ever leaked.
- **Optional, cleanup only: Firestore TTL.** In the Google Cloud console (not the Firebase console): Firestore → Time-to-live (TTL) → Create policy, collection group `claims`, timestamp field `expiresAt`. Or run `gcloud firestore fields ttls update expiresAt --collection-group=claims --enable-ttl`.
  - **If you skip it, nothing breaks.** Claim docs are keyed by class session, so old ones are never read again and can't affect a new class. They just stay in Firestore (about 2 tiny docs per mark, far under the free storage tier).
  - You can add the policy later. It will start deleting docs from then on, including any already expired.
  - Deletion is a background job and can lag expiry by up to a day or so. Nothing depends on its timing.
- Vercel overwrites `x-forwarded-for` with the real client IP, so no extra proxy configuration is needed. Other hosts that don't do this would let clients spoof their IP.
- Old cached clients that don't send the signals get "Please refresh the app and try again." (`SIGNALS_REQUIRED`).

## v2.0.2 — Fix: mobile/installed-app behaviour (zoom, toast, pull-to-refresh)

### Changes
- **`src/app/globals.css`**: on touch devices every text input/select/textarea is forced to 16px, which stops iOS zooming in on focus. `html`/`body` now use `overscroll-behavior: none` and `touch-action: pan-x pan-y`, which blocks pinch and double-tap zoom while keeping scrolling.
- **`src/app/layout.tsx`**: viewport now sets `maximumScale: 1` and `userScalable: false`. The `<Toaster>` gets a safe-area-aware top offset (`env(safe-area-inset-top) + 12px`) on desktop and mobile, so toasts no longer sit under the notch or status bar on iPhone 11 and similar. Mounts `ViewportLock`.
- **`src/components/pwa/ViewportLock.tsx`** (new): cancels Safari's `gesturestart/change/end` events and multi-touch `touchmove`, since iOS ignores `user-scalable=no`.
- **`src/components/pwa/PullToRefresh.tsx`**: the header-dragging bug had two causes.
  1. `overscroll-behavior-y` was set to `contain` from JS after hydration. `contain` still allows the iOS rubber-band, so the whole page (header included) bounced. It's now `none` in CSS and applies from first paint; the JS effect is removed.
  2. The gesture was only claimed after an 8px move and only if `scrollY` was 0 at `touchstart`. A touch during momentum scrolling could start a native bounce instead. The handler now re-baselines until the page is at the top, then claims the gesture from the first pixel (`preventDefault` when cancelable).

### Notes
- Disabling zoom reduces accessibility for low-vision users. Remove `maximumScale`/`userScalable` and the `touch-action` rule if you want to restore it.
- Re-add the app to the Home Screen (or fully close and reopen it) so iOS picks up the new viewport.

## v2.0.1 — Fix: offline screen not showing in the PWA

### Root cause
- `next-pwa@5` is webpack-only; Next 16 builds with Turbopack, so the plugin never generated a working service worker. With no worker, the browser showed its default "This site can't be reached" page.
- Even when a worker was generated, `fallbacks.document: "/offline"` pointed at a client-rendered Next route whose JS chunks weren't guaranteed to be cached.

### Changes
- **`public/sw.js`** (new): hand-written service worker. Precaches `/offline.html` + icons, network-first navigations with offline fallback, cache-first for `/_next/static/*`, never touches `/api/*`. Uses navigation preload and cleans up old workbox caches on activate.
- **`public/offline.html`** (new): self-contained offline page (inline CSS/JS, no Next chunks) with the same design, jokes and "Check connection" flow; follows the app's light/dark theme; reloads the original URL once back online.
- **`src/components/pwa/ServiceWorkerRegister.tsx`** (new): registers the worker in production only.
- **`src/app/layout.tsx`**: mounts `ServiceWorkerRegister`.
- **`next.config.js`**: removed `next-pwa`; added no-cache headers for `/sw.js` and `/offline.html`.
- **`package.json`**: removed `next-pwa` and `babel-loader` (unused). Run `pnpm install` / `npm install` to refresh lockfiles.
- **`src/app/layout.tsx`**: manifest link now rendered manually with `crossOrigin="use-credentials"` so the manifest loads through ngrok-free's interstitial (Chrome showed "This app cannot be installed" with a placeholder "N" icon).
- **`InstallPrompt.tsx`**: install sheet now appears on every page load/reload until the app is installed. "Maybe later"/close/Esc hide it for the current page view only (7-day snooze removed). Stale "installed" flag is cleared if Chromium fires `beforeinstallprompt` again (app was uninstalled).
- **`PullToRefresh.tsx`**: pull-to-refresh animation now enabled on all touch devices (mobile browser tabs too, not just installed/standalone). Sets `overscroll-behavior-y: contain` so Chrome's native pull-to-refresh doesn't double up.
- **`src/types/css.d.ts`** (new): declares `*.css` modules, fixing TS2882 "Cannot find module or type declarations for side-effect import of './globals.css'" in `layout.tsx`.
- **`src/components/pwa/OpenInAppHint.tsx`** (new): when DARS is installed but opened in a normal browser tab, shows a dismissible card (per tab session) telling the user to open the installed app, with platform-specific wording. Detects installs via the `dars:installed` flag (also set whenever the app runs standalone) and `getInstalledRelatedApps()` where supported; clears itself if Chromium reports the app is no longer installed.
- **`src/lib/pwa.ts`** (new): shared PWA helpers (`detectPlatform`, `isStandalone`, storage helpers, `INSTALLED_KEY`), now used by `InstallPrompt.tsx` and `OpenInAppHint.tsx`.
- `src/app/offline/page.tsx` is no longer used by the worker and can be deleted.

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
