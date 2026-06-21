# DARS — Digital Attendance Recording System

**Digital Attendance Recording System** for the Political Science Department, Nnamdi Azikiwe University (UNIZIK), Awka.

Built by **Drexx Technologies**.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15, Tailwind CSS v3 |
| Backend | Next.js API Routes |
| Database | Firebase Firestore (via Admin SDK) |
| Auth | Firebase Auth (client) + Admin SDK (server verification) |
| Charts | Recharts |
| Exports | jsPDF + jspdf-autotable, PapaParse |
| PWA | next-pwa |

---

## Features

- **Mark Attendance** — requires sign-in; signed-in students mark for themselves with one tap
- **Admin-assisted marking** — admins can mark attendance on behalf of another student from the mark page
- **Location Tags** — super admins define named campus locations (GPS + radius) in Firestore; one is always set as primary
- **Per-class location** — admins pick which location tag a class is held at when starting it; check-in is geofenced against that specific tag
- **Course-based sessions** — admins start/end/pause classes per course
- **2-hour auto-expiry** — class window closes automatically after 2 hours
- **Late tagging** — marks after 90 mins are flagged as late
- **Student Dashboard** — Recharts attendance breakdown per course
- **Admin Panel** — search students, view attendance rate, ban/unban
- **Class Management** — start, end, pause, resume per course
- **Delete Course** — super admins can permanently delete a course and all its sessions, attendance records, and activity log entries
- **Admin Management** — super admins grant defined/super roles, assign courses
- **Bulk CSV Upload** — super admin registers multiple students at once
- **Export** — per-student or all-students export as CSV or PDF
- **Activity Log** — tracks every class start/end/pause with admin name + timestamp
- **Rate Limiting** — mark endpoint limited to 20 req/min per IP
- **PWA** — installable on Android/iOS, splash screen preloader, app icon sourced from `public/icon.png`
- **Dark mode** — full light/dark toggle
- **Offline page** — branded fallback when there's no connection

---

## Firestore Schema

```
users/{uid}
  name, email, regNumber, admin, scope (super|defined), assignedCourses[], banned

students/{regNumber}
  uid, name, email, totalPresence
  └── attendance/{courseId}/records/{yyyy-mm-dd}
        timestamp, late, courseId, dateKey, regNumber, markedBy

courses/{courseId}
  name, code, description, assignedAdmins[], active, createdAt, createdBy

globals/{courseId}
  classActive, checkinPaused, currentDate, startTime, endTime, locationId, locationName

globals/locationConfig/locations/{locationId}
  name, lat, lng, radiusMeters, isPrimary, createdAt, createdBy

classes/{courseId}/sessions/{yyyy-mm-dd}
  courseId, dateKey, startTime, endTime, totalPresence, startedBy, locationId, locationName

activityLog/{logId}
  action, courseId, dateKey, adminUid, adminName, timestamp
```

`globals/locationConfig` is an anchor document (it holds no class state itself) that owns the
`locations` subcollection. Exactly one location is always flagged `isPrimary: true` — it's the
default selected when an admin starts a class without explicitly choosing one. A location can't
be deleted while it's primary or while it's the only location on file; set another one as primary
first.

---

## Registration Number Format

UNIZIK Political Science:
- Full-time: `20YY134XXX` (134 = full-time)
- Part-time: `20YY133XXX` (133 = part-time)

Regex: `^20\d{2}(133|134)\d{3}$`

---

## Admin Scopes

| Scope | Can do |
|---|---|
| `super` | Create courses, delete courses, grant/revoke admins, manage location tags, see all courses, bulk upload |
| `defined` | Start/end/pause classes and view attendance for assigned courses only |

---

## Location Tags & Geofencing

Campus locations are stored in Firestore instead of environment variables, so classes can be held
at a different building without a redeploy.

- **Tags page** (`/admin/tags`, super admin only) — click **Tag**, DARS captures your current GPS
  position (shown in a "Please hold as DARS captures your location..." dialog), then name the
  location and set its check-in range in meters. Optionally mark it as primary.
- **Primary location** — exactly one location is always primary. It's used automatically when an
  admin starts a class without picking a specific location.
- **Per-class location** — on the Class Management page (`/admin/create`), before starting a class
  the admin picks which saved location it's being held at. That choice is stored on the class
  session and on `globals/{courseId}`.
- **Enforcement** — when a student (or admin marking on their behalf) hits `/api/mark`, the server
  looks up the location tied to that specific class and rejects the request if the submitted GPS
  coordinates fall outside its radius.

---

## Marking Attendance (Auth Required)

The mark page (`/mark`) now requires a signed-in DARS account — there is no anonymous, free-text
reg-number entry anymore.

- **Students** sign in, pick a course, grant location access, and tap **Mark Attendance** — it
  marks for their own `regNumber` automatically.
- **Admins** see an extra "Mark for another student" toggle on the same screen, letting them enter
  a reg number and mark on that student's behalf (still subject to the same location/class-window
  checks). Nobody else can mark for anyone but themselves.
- The **Logout** button only appears in the navbar for admins; regular students don't see it.

---

## Setup

1. Clone repo and install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.local.example` to `.env.local` and fill in your Firebase credentials.

3. In Firebase Console:
   - Enable **Authentication** (Email/Password provider)
   - Create a **Firestore** database
   - Generate a **service account** key for Admin SDK

4. Create your first super admin manually in Firestore:
   ```
   users/{uid} → { admin: true, scope: "super", ... }
   ```

5. Sign in as that super admin and visit `/admin/tags` to create your first location tag — it
   will automatically become primary. Classes can't be started until at least one location exists.

6. Run dev server:
   ```bash
   npm run dev
   ```

7. Build and deploy:
   ```bash
   npm run build && npm start
   ```

---

## PWA Icons

App icons are generated from `public/icon.png` (the DARS brand mark) and saved as:
- `public/icons/icon-192.png` (192×192)
- `public/icons/icon-512.png` (512×512)

If you replace `public/icon.png`, regenerate the two sizes from it so the navbar logo, browser
favicon, and installed PWA icon all stay in sync:

```bash
python3 -c "
from PIL import Image
im = Image.open('public/icon.png').convert('RGBA')
for size in (192, 512):
    im.resize((size, size), Image.LANCZOS).save(f'public/icons/icon-{size}.png')
"
```

---

## Bulk CSV Format

```csv
name,email,regNumber
John Doe,johndoe@example.com,2023134001
Jane Smith,janesmith@example.com,2023133002
```

Default password for bulk-registered students is their **registration number**. Advise them to change it after first login.

---

## Developed by Drexx Technologies

> Onyekwelu I. Michael — CTO & Co-Founder, Spotix Nigeria
