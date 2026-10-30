/**
 * Seed demo data for KadaBook admin panel (Firebase Admin SDK).
 *
 * Usage:
 *   1. Download a service account JSON from Firebase Console.
 *   2. set GOOGLE_APPLICATION_CREDENTIALS=path\to\serviceAccount.json
 *   3. set FIREBASE_PROJECT_ID=your-project
 *   4. node scripts/seed-demo.mjs
 *
 * Creates: appConfig/main, plans, demo users, subscriptions, payments sample,
 * and admins doc for SUPER_ADMIN_UID env if set.
 */
import admin from 'firebase-admin';

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) {
  console.error('Set FIREBASE_PROJECT_ID');
  process.exit(1);
}

admin.initializeApp({ projectId });
const db = admin.firestore();

const demoShops = [
  { id: 'demo_shop_1', shopName: 'Lanka Rice Mart', ownerName: 'Kumar', district: 'Colombo', status: 'pending' },
  { id: 'demo_shop_2', shopName: 'Jaffna Tea House', ownerName: 'Maya', district: 'Jaffna', status: 'trial' },
  { id: 'demo_shop_3', shopName: 'Kandy Groceries', ownerName: 'Nimal', district: 'Kandy', status: 'active' },
];

async function main() {
  await db.doc('appConfig/main').set(
    {
      maintenance: false,
      minVersion: '1.0.0',
      trialDays: 14,
      graceDays: 7,
      renewWhatsApp: '94771234567',
      features: { tamil: true, sinhala: true, reportExport: true, signupsOpen: true },
    },
    { merge: true },
  );

  await db.doc('plans/monthly').set({ name: 'Monthly', days: 30, price: 2500 });
  await db.doc('plans/quarterly').set({ name: 'Quarterly', days: 90, price: 6500 });
  await db.doc('plans/trial').set({ name: 'Free trial', days: 14, price: 0 });

  await db.doc('appConfig/access').set(
    {
      matrix: {
        pending: {
          useApp: true,
          viewReports: false,
          addSale: false,
          addExpense: false,
          manageProducts: false,
          exportData: false,
          editProfile: true,
        },
        trial: {
          useApp: true,
          viewReports: true,
          addSale: true,
          addExpense: true,
          manageProducts: true,
          exportData: true,
          editProfile: true,
        },
        active: {
          useApp: true,
          viewReports: true,
          addSale: true,
          addExpense: true,
          manageProducts: true,
          exportData: true,
          editProfile: true,
        },
        grace: {
          useApp: true,
          viewReports: true,
          addSale: true,
          addExpense: true,
          manageProducts: true,
          exportData: true,
          editProfile: true,
        },
        expired: {
          useApp: true,
          viewReports: true,
          addSale: false,
          addExpense: false,
          manageProducts: false,
          exportData: true,
          editProfile: true,
        },
        suspended: {
          useApp: false,
          viewReports: false,
          addSale: false,
          addExpense: false,
          manageProducts: false,
          exportData: false,
          editProfile: false,
        },
        rejected: {
          useApp: false,
          viewReports: false,
          addSale: false,
          addExpense: false,
          manageProducts: false,
          exportData: false,
          editProfile: false,
        },
      },
    },
    { merge: true },
  );

  const now = Date.now();
  for (const shop of demoShops) {
    await db.doc(`users/${shop.id}`).set(
      {
        shopName: shop.shopName,
        ownerName: shop.ownerName,
        district: shop.district,
        phone: '94770000000',
        status: shop.status,
        createdAt: now - Math.floor(Math.random() * 14 * 86400000),
        lastActiveAt: now,
      },
      { merge: true },
    );
    if (shop.status !== 'pending') {
      await db.doc(`subscriptions/${shop.id}`).set({
        plan: shop.status === 'trial' ? 'trial' : 'monthly',
        startsAt: now - 7 * 86400000,
        expiresAt: now + (shop.status === 'trial' ? 7 : 23) * 86400000,
        status: shop.status === 'trial' ? 'trial' : 'active',
      });
    }
  }

  await db.collection('payments').add({
    uid: 'demo_shop_3',
    plan: 'Monthly',
    amount: 2500,
    method: 'bank',
    reference: 'DEMO-001',
    paidAt: now - 86400000,
    recordedBy: 'seed',
  });

  const superUid = process.env.SUPER_ADMIN_UID;
  if (superUid) {
    await db.doc(`admins/${superUid}`).set({
      name: 'Super Admin',
      email: process.env.SUPER_ADMIN_EMAIL ?? 'admin@kadabook.app',
      role: 'super_admin',
      active: true,
    });
    console.log('Admin doc created for', superUid);
  } else {
    console.log('Tip: set SUPER_ADMIN_UID to create admins/{uid} for your login.');
  }

  console.log('Seed complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
