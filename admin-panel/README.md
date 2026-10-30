# KadaBook Admin Panel

Separate **React + Vite + TypeScript + Tailwind** web app for managing KadaBook shops. Visual design follows `../design/KadaBook-Admin-Panel.html` (exported from `C:\Users\kavit\Downloads\KadaBook Admin Panel.html`).

## Setup

```bash
cd admin-panel
cp .env.example .env
# Fill VITE_FIREBASE_* (same project as the mobile app)
npm install
npm run dev
```

## Deploy (Vercel)

- Root directory: `admin-panel`
- Build: `npm run build`
- Output: `dist`
- `vercel.json` included for SPA routing

## First admin user

1. Create an email/password user in Firebase Authentication.
2. Copy the UID.
3. Run seed (optional) or manually create Firestore doc:

```json
admins/{uid}  →  { "name": "You", "email": "...", "role": "super_admin", "active": true }
```

4. Sign in at `/login`. Non-admin accounts see **Access denied** and are signed out.

## Roles

| Role | Pages |
|------|--------|
| `super_admin` | All sidebar items |
| `staff` | Dashboard, Approvals, Payments, Support |

Routes and Firestore rules both enforce this.

## Seed demo shops

```bash
npm install firebase-admin   # dev dependency if not present
set GOOGLE_APPLICATION_CREDENTIALS=path\to\serviceAccount.json
set FIREBASE_PROJECT_ID=your-project
set SUPER_ADMIN_UID=your-firebase-auth-uid
node scripts/seed-demo.mjs
```

## Firestore

Deploy rules from repo root:

```bash
firebase deploy --only firestore:rules
```

Rules live in `firebase/firestore.rules`.

## Design reference

Extract pages from the HTML bundle:

```bash
node ../scripts/extract-admin-design.mjs
```

Colors used in UI: sidebar `#0F172A`, brand `#1D5FE0`, canvas `#F4F6FA`, cards white with `#E5E7EB` borders, 14px radius — matching the bundled design export.
