# KadaBook system test report

**Date:** 2026-10-29  
**Firebase project:** `kadabook-b8b8d`

---

## Automated checks (run on dev machine)

| Check | Command | Result |
|--------|---------|--------|
| Mobile TypeScript | `npm run typecheck` | **Pass** |
| Admin TypeScript | `cd admin-panel && npx tsc -b` | **Pass** |
| Admin production build | `cd admin-panel && npm run build` | **Pass** (Vite → `admin-panel/dist`) |
| Firestore rules compile + deploy | `npm run deploy:rules` | **Pass** (deployed earlier this session) |
| EAS account | `npx eas whoami` | **kavitharan** |

---

## What is implemented (system scope)

### Mobile
- Real-time gate: `users`, `subscriptions`, `appConfig`, access matrix, announcements
- Screens: pending, rejected, suspended, maintenance, update required
- Trial chip, grace banner, expired renew bar, access-blocked dialog (EN/TA/SI)
- Sign-up: shop name, owner, phone, district → `status: pending`
- `useAccess` / `canAccess` on Home, New Sale, Add Expense, Products, Reports export
- Auth wait before Firestore sync (reduces false permission errors)

### Admin
- Add subscription (batch: subscription, user status, payment, audit)
- Access control matrix + shop overrides
- Announcements (EN/TA, preview, metrics)
- Approvals, subscriptions list, payments, app control, audit, admins

### Firestore rules
- `effectiveShopStatus` from `expiresAt` + `graceDays`
- `shopCanFeature` from matrix + overrides
- `users/{uid}/seen` for announcements

### Optional
- Daily status sync script: `admin-panel/scripts/sync-shop-status.mjs`
- Demo seed: `admin-panel/scripts/seed-demo.mjs` (includes `appConfig/access` + `plans/trial`)

---

## Manual end-to-end tests (you run on device + admin)

Use [TEST_CHECKLIST.md](./TEST_CHECKLIST.md). Minimum smoke path:

1. **Seed** (optional): service account → `FIREBASE_PROJECT_ID=kadabook-b8b8d` → `node admin-panel/scripts/seed-demo.mjs`
2. **Admin**: open [LINKS.md](./LINKS.md) admin URL → login → **Access Control** → Saved
3. **Mobile**: install **latest APK** (with EAS Firebase env) → sign up → **Approvals** → approve
4. **Plan**: **Subscriptions** → Add subscription → pick shop + **Monthly** plan → save
5. **Sale**: mobile Home → New Sale → save (should succeed when active/trial)
6. **Expired**: set old `expiresAt` in Firestore → renew bar + blocked sale + rules deny write

Automated UI tests were **not** run (no Detox/E2E in repo). Status: **ready for manual QA**.

---

## APK vs source note

Finished APKs on Expo may be from an **older Git commit** until you run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Push-EasFirebaseEnv.ps1
npm run build:apk
```

Use the new **Application Archive URL** from https://expo.dev/accounts/kavitharan/projects/kadabook/builds for gating + sync fixes in this repo.

---

## Deploy admin website

```powershell
npm run deploy:admin
```

Then use **https://kadabook-b8b8d.web.app** (see [LINKS.md](./LINKS.md)).
