/**
 * Final system logic checks for KadaBook subscription model.
 * Run: node scripts/audit-subscription-logic.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apk = fs.readFileSync(path.join(root, 'src/lib/tiers.ts'), 'utf8');
const adm = fs.readFileSync(path.join(root, 'admin-panel/src/lib/planFeatures.ts'), 'utf8');
const quota = fs.readFileSync(path.join(root, 'src/lib/planQuota.ts'), 'utf8');
const useTier = fs.readFileSync(path.join(root, 'src/lib/useTier.ts'), 'utf8');
const home = fs.readFileSync(path.join(root, 'src/screens/HomeScreen.tsx'), 'utf8');
const sale = fs.readFileSync(path.join(root, 'src/screens/NewSaleScreen.tsx'), 'utf8');
const upgrade = fs.readFileSync(path.join(root, 'src/screens/SettingsScreens.tsx'), 'utf8');
const shopOps = fs.readFileSync(path.join(root, 'admin-panel/src/lib/shopOps.ts'), 'utf8');
const payments = fs.readFileSync(path.join(root, 'admin-panel/src/pages/PaymentsPage.tsx'), 'utf8');
const access = fs.readFileSync(path.join(root, 'admin-panel/src/pages/AccessControlPage.tsx'), 'utf8');

function extractArray(src, name) {
  const re = new RegExp(`export const ${name}[^=]*=\\s*\\[([\\s\\S]*?)\\]`);
  const m = src.match(re);
  if (!m) return [];
  return [...m[1].matchAll(/'([a-zA-Z]+)'/g)].map((x) => x[1]);
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
}

const apkAll = extractArray(apk, 'ALL_FEATURES');
const admAll = extractArray(adm, 'ALL_FEATURES');
check('Catalog parity ALL_FEATURES', JSON.stringify(apkAll) === JSON.stringify(admAll), `apk=${apkAll.length} adm=${admAll.length}`);
check('Catalog parity BASIC', JSON.stringify(extractArray(apk, 'BASIC_FEATURES')) === JSON.stringify(extractArray(adm, 'BASIC_FEATURES')));
check('Catalog parity STANDARD', JSON.stringify(extractArray(apk, 'STANDARD_FEATURES')) === JSON.stringify(extractArray(adm, 'STANDARD_FEATURES')));

check('Grandfather when !featuresConfigured', useTier.includes('!subscription?.featuresConfigured'));
check('Trial unlocks all', useTier.includes("status === 'trial'"));
check('Upgrade Plan WhatsApp only (no setDoc featuresConfigured)', !/setDoc[\s\S]{0,200}featuresConfigured/.test(upgrade) && upgrade.includes('openRenewWhatsApp'));
check('Admin activate writes featuresConfigured', shopOps.includes('featuresConfigured: true'));
check('Admin activate writes staffSeats/branchLimit', shopOps.includes('staffSeats: 2') && shopOps.includes('branchLimit: 2'));
check('Payments uses pickCurrentPlans', payments.includes('pickCurrentPlans'));
check('Access Control clarifies status ≠ plans', access.includes('Manage Shops') && access.includes('Basic'));
check('Home tiles use plan has()', home.includes('planAny') && home.includes('useTier'));
check('Home kitchen gated by kitchenStock', home.includes("has('kitchenStock')"));
check('Sale gates barcode/discount/pay', sale.includes("has('barcode')") && sale.includes("has('discount')") && sale.includes("has('paymentModes')"));
check('Quota respects branches add-on', quota.includes("featureOn(subscription, 'branches')") && quota.includes('SINGLE_BRANCH'));
check('Quota respects staff add-on', quota.includes("featureOn(subscription, 'staff')"));

// Runtime quota simulation
function featureOn(sub, key) {
  return Array.isArray(sub.enabledFeatures) && sub.enabledFeatures.includes(key);
}
function planLimits(subscription) {
  if (!subscription?.featuresConfigured) {
    return { staffSeats: null, branches: null, grandfather: true };
  }
  const staffOn = featureOn(subscription, 'staff');
  const branchesOn = featureOn(subscription, 'branches');
  const staffSeats = staffOn ? subscription.staffSeats || 2 : null;
  const branches = branchesOn ? subscription.branchLimit || 2 : 1;
  return { staffSeats, branches, grandfather: false };
}

check('Sim: live shop unlimited', planLimits({ featuresConfigured: false }).grandfather === true);
check(
  'Sim: standard no branches → 1',
  planLimits({ featuresConfigured: true, enabledFeatures: ['quickSale', 'products'] }).branches === 1,
);
check(
  'Sim: branches tick → 2',
  planLimits({ featuresConfigured: true, enabledFeatures: ['branches'], branchLimit: 2 }).branches === 2,
);
check(
  'Sim: no staff → seats null',
  planLimits({ featuresConfigured: true, enabledFeatures: ['quickSale'] }).staffSeats === null,
);
check(
  'Sim: staff tick → 2',
  planLimits({ featuresConfigured: true, enabledFeatures: ['staff'] }).staffSeats === 2,
);

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ' · ' + r.detail : ''}`);
}
console.log('---');
console.log(`${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
