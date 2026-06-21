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

- **Mark Attendance** — open to all; students enter reg number to mark per course
- **Course-based sessions** — admins start/end/pause classes per course
- **2-hour auto-expiry** — class window closes automatically after 2 hours
- **Late tagging** — marks after 90 mins are flagged as late
- **Student Dashboard** — Recharts attendance breakdown per course
- **Admin Panel** — search students, view attendance rate, ban/unban
- **Class Management** — start, end, pause, resume per course
- **Admin Management** — super admins grant defined/super roles, assign courses
- **Bulk CSV Upload** — super admin registers multiple students at once
- **Export** — per-student or all-students export as CSV or PDF
- **Activity Log** — tracks every class start/end/pause with admin name + timestamp
- **Rate Limiting** — mark endpoint limited to 20 req/min per IP
- **PWA** — installable on Android/iOS, splash screen preloader
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
        timestamp, late, courseId, dateKey, regNumber

courses/{courseId}
  name, code, description, assignedAdmins[], active, createdAt, createdBy

globals/{courseId}
  classActive, checkinPaused, currentDate, startTime, endTime

classes/{courseId}/sessions/{yyyy-mm-dd}
  courseId, dateKey, startTime, endTime, totalPresence, startedBy

activityLog/{logId}
  action, courseId, dateKey, adminUid, adminName, timestamp
```

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
| `super` | Create courses, grant/revoke admins, see all courses, bulk upload |
| `defined` | Start/end/pause classes and view attendance for assigned courses only |

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

5. Run dev server:
   ```bash
   npm run dev
   ```

6. Build and deploy:
   ```bash
   npm run build && npm start
   ```

---

## PWA Icons

Place your app icons at:
- `public/icons/icon-192.png` (192×192)
- `public/icons/icon-512.png` (512×512)

Use a green background (`#16a34a`) with a white checkmark for brand consistency.

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
