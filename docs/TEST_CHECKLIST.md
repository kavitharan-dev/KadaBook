# KadaBook gating & admin — test checklist

## Deploy

- [ ] `npx firebase-tools deploy --only firestore:rules` (from repo root; rules in `firebase/firestore.rules`)
- [ ] Seed `appConfig/access` with `{ matrix: … }` (defaults match `src/lib/shopAccessTypes.ts` / `admin-panel/src/lib/accessMatrix.ts`) or save once from **Access Control** page
- [ ] Ensure `plans/` documents exist for **Add subscription** form

## Mobile — account gates

- [ ] New sign-up: `users/{uid}` has `status: pending`, fields shopName, ownerName, phone, district
- [ ] **Pending**: only waiting screen; no sales/expense tabs usable
- [ ] **Rejected**: reason + WhatsApp button
- [ ] **Suspended**: contact screen
- [ ] **Maintenance** (`appConfig/main.maintenance`): “Back soon”
- [ ] **minVersion** above `APP_VERSION` in `src/config/build.ts`: update required screen

## Mobile — subscription states

- [ ] **Trial**: full app + trial chip on Home (EN/TA)
- [ ] **Grace** (expiresAt < now ≤ expiresAt + graceDays): banner with days left
- [ ] **Expired**: read-only — view sales/reports, print/export if `exportData`; New Sale / Add Expense blocked + renew bar; Firestore rejects new sale/expense writes

## Mobile — access matrix & overrides

- [ ] Toggle `addSale` off for **expired** in admin matrix → app dialog + rules deny create
- [ ] Per-shop override `overrides.addSale: false` → blocked even if status allows

## Mobile — announcements

- [ ] Banner on Home for matching audience & schedule
- [ ] Popup on open (one at a time, priority); dismiss → local storage + `users/{uid}/seen/{id}`
- [ ] `showOnce` not shown again after dismiss
- [ ] Popups do not appear on pending/rejected/suspended/maintenance gates

## Admin panel

- [ ] **Add subscription**: shop + plan, extend/today, bonus days, payment; confirm dialog; batch updates `subscriptions/{uid}`, `users.status`, `payments`, `auditLogs`; skip payment for free/trial plan
- [ ] **Access control**: matrix debounced save + toast; override form writes `users/{uid}.overrides`
- [ ] **Announcements**: EN/TA, type, audience, dates, preview; list shows view/dismiss counts

## Status engine

- [ ] Client `effectiveStatus()` matches rules `effectiveShopStatus()` for trial/active/grace/expired
- [ ] Optional: run `node admin-panel/scripts/sync-shop-status.mjs` (daily cron) to sync `users.status` and flag shops expiring in 7 days

## Types reference

- Mobile: `src/lib/shopAccessTypes.ts`, `src/lib/statusEngine.ts`, `src/lib/accessControl.ts`
- Admin: `admin-panel/src/lib/accessMatrix.ts`, `admin-panel/src/types/models.ts`
