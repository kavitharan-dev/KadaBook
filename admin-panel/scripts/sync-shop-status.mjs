/**
 * Daily job (run via cron / Cloud Scheduler + Cloud Run):
 * Syncs users/{uid}.status from subscriptions.expiresAt + appConfig graceDays.
 * Flags users expiring within 7 days with expiringSoon: true.
 *
 * Usage: node admin-panel/scripts/sync-shop-status.mjs
 * Requires GOOGLE_APPLICATION_CREDENTIALS or firebase admin key in env.
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function millis(v) {
  if (typeof v === 'number') return v;
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  return 0;
}

function effectiveStatus(stored, sub, graceDays, now) {
  if (['pending', 'rejected', 'suspended'].includes(stored)) return stored;
  if (!sub?.expiresAt) return stored === 'trial' ? 'trial' : 'expired';
  const exp = millis(sub.expiresAt);
  const graceEnd = exp + graceDays * 86400000;
  if (now <= exp) return sub.status === 'trial' || sub.plan === 'trial' ? 'trial' : 'active';
  if (now <= graceEnd) return 'grace';
  return 'expired';
}

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}')),
  });
const db = getFirestore(app);

const mainSnap = await db.doc('appConfig/main').get();
const graceDays = Number(mainSnap.data()?.graceDays) || 7;
const now = Date.now();
const subsSnap = await db.collection('subscriptions').get();
let updated = 0;

for (const subDoc of subsSnap.docs) {
  const uid = subDoc.id;
  const sub = subDoc.data();
  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  if (!userSnap.exists) continue;
  const stored = userSnap.data().status || 'active';
  const next = effectiveStatus(stored, sub, graceDays, now);
  const exp = millis(sub.expiresAt);
  const expiringSoon = exp > now && exp <= now + 7 * 86400000;
  const patch = {};
  if (next !== stored) patch.status = next;
  if (expiringSoon !== userSnap.data().expiringSoon) patch.expiringSoon = expiringSoon;
  if (Object.keys(patch).length) {
    await userRef.set(patch, { merge: true });
    updated++;
  }
}

console.log(`Synced ${updated} shop statuses (graceDays=${graceDays}).`);
