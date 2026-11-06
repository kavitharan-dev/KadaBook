import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, addDoc, deleteDoc, getDoc, getDocs, collection, deleteField, query, where, runTransaction, Timestamp } from 'firebase/firestore';
import { BURGER_SHOP_TEST_ITEMS, planCount, planPurchase, planSale, planSend, previewAssemble, stockRowId } from '../../src/lib/stockEngine.ts';

const env = await initializeTestEnvironment({
  projectId: 'demo-kadabook',
  firestore: { rules: readFileSync(process.argv[2], 'utf8') },
});

const OWNER = 'owner1', CA = 'cashierA', CB = 'cashierB', MALL = 'managerAll', MA = 'managerA';
const CTICK = 'cashierExtras', MCUT = 'managerCut', OLD = 'oldCashier', OFF = 'cashierOff', NOPE = 'outsider';
const DAY = '2026-11-04';
const now = Timestamp.now();

const members = {
  [CA]: { role: 'cashier', active: true, name: 'A', branchId: 'A' },
  [CB]: { role: 'cashier', active: true, name: 'B', branchId: 'B' },
  [MALL]: { role: 'manager', active: true, name: 'M', branchId: 'all' },
  [MA]: { role: 'manager', active: true, name: 'MA', branchId: 'A' },
  [CTICK]: { role: 'cashier', active: true, name: 'T', branchId: 'A', permissions: { addExpense: true, editSale: true, closeDay: false, addSale: true } },
  [MCUT]: { role: 'manager', active: true, name: 'C', branchId: 'all', permissions: { addExpense: false, editSale: false, manageProducts: false, manageStock: false } },
  [OLD]: { role: 'cashier', active: true, name: 'Old' },
  [OFF]: { role: 'cashier', active: false, name: 'Off', branchId: 'A' },
};

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', OWNER), { shopName: 'Shop', status: 'active', nextInvoice: 5, openingBalances: { [DAY]: 500 }, closedDays: {} });
    await setDoc(doc(db, 'subscriptions', OWNER), { status: 'active', plan: 'paid', expiresAt: Timestamp.fromMillis(Date.now() + 864e5) });
    for (const [id, m] of Object.entries(members)) await setDoc(doc(db, 'users', OWNER, 'members', id), m);
    await setDoc(doc(db, 'users', OWNER, 'products', 'p1'), { name: 'Tea', sellingPrice: 100, stock: 10 });
    await setDoc(doc(db, 'users', OWNER, 'sales', 's1'), { amount: 100, createdAt: now, branchId: 'A', soldByUid: CA, settled: false, note: 'x' });
    await setDoc(doc(db, 'users', OWNER, 'expenses', 'e1'), { amount: 10, category: 'Other', createdAt: now });
    await setDoc(doc(db, 'users', OWNER, 'branchDays', `A_${DAY}`), { branchId: 'A', day: DAY, opening: 300 });
    await setDoc(doc(db, 'users', OWNER, 'branchDays', `B_${DAY}`), { branchId: 'B', day: DAY });
    await setDoc(doc(db, 'users', OWNER, 'sales', 'sB'), { amount: 70, createdAt: now, branchId: 'B', soldByUid: CB, settled: true });
    await setDoc(doc(db, 'users', OWNER, 'sales', 'old'), { amount: 9, createdAt: now });
    await setDoc(doc(db, 'users', OWNER, 'expenses', 'eA'), { amount: 10, category: 'Other', createdAt: now, branchId: 'A' });
    await setDoc(doc(db, 'users', OWNER, 'expenses', 'eB'), { amount: 10, category: 'Other', createdAt: now, branchId: 'B' });
    await setDoc(doc(db, 'users', OWNER, 'creditPayments', 'cA'), { amount: 1, customerId: 'c', method: 'cash', createdAt: now, branchId: 'A' });
    await setDoc(doc(db, 'users', OWNER, 'returns', 'rA'), { saleId: 's1', refundAmount: 1, createdAt: now, branchId: 'A' });
    await setDoc(doc(db, 'users', OWNER, 'savedOrders', 'dA'), { total: 5, savedAt: now, branchId: 'A' });
    await setDoc(doc(db, 'users', OWNER, 'stock', 'A_i1'), { branchId: 'A', itemId: 'i1', qty: 10, avgCost: 5 });
    await setDoc(doc(db, 'users', OWNER, 'stock', 'B_i1'), { branchId: 'B', itemId: 'i1', qty: 10, avgCost: 5 });
    await setDoc(doc(db, 'users', OWNER, 'stockMoves', 'mA'), { type: 'purchase', branchId: 'A', qty: { i1: 10 }, cost: { i1: 50 }, createdAt: now });
    await setDoc(doc(db, 'users', OWNER, 'stockMoves', 'mB'), { type: 'transferIn', branchId: 'B', qty: { i1: 10 }, cost: { i1: 50 }, createdAt: now });
    await setDoc(doc(db, 'users', OWNER, 'audit', 'a1'), { action: 'x', createdAt: now });
  });
}
const db = (u) => env.authenticatedContext(u).firestore();
const p = (u, ...path) => doc(db(u), 'users', OWNER, ...path);
const col = (u, name) => collection(db(u), 'users', OWNER, name);
const sale = (u, branchId, extra = {}) => addDoc(col(u, 'sales'), { amount: 50, createdAt: now, ...(branchId ? { branchId } : {}), soldByUid: u, soldByName: 'x', ...extra });
const day = (u, b, data, d = DAY) => setDoc(p(u, 'branchDays', `${b}_${d}`), { branchId: b, day: d, ...data }, { merge: true });

let failed = 0, n = 0;
async function t(name, expect, fn) {
  await seed();
  n += 1;
  try {
    await (expect === 'allow' ? assertSucceeds(fn()) : assertFails(fn()));
    console.log(`PASS  ${expect.padEnd(5)} ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`FAIL  ${expect.padEnd(5)} ${name} :: ${String(e.message).slice(0, 80)}`);
  }
}

// ── Staff really can bill (these were the bugs) ──
await t('cashier takes an invoice number', 'allow', () => setDoc(doc(db(CA), 'users', OWNER), { nextInvoice: 6 }, { merge: true }));
await t('cashier saves a sale at own branch', 'allow', () => sale(CA, 'A'));
await t('cashier reduces stock when selling', 'allow', () => updateDoc(p(CA, 'products', 'p1'), { stock: 9 }));
await t('cashier collects credit: marks bill settled', 'allow', () => updateDoc(p(CA, 'sales', 's1'), { settled: true }));
await t('cashier records credit payment at own branch', 'allow', () => addDoc(col(CA, 'creditPayments'), { customerId: 'c', amount: 5, method: 'cash', branchId: 'A', createdAt: now }));
await t('owner edits a bill', 'allow', () => updateDoc(p(OWNER, 'sales', 's1'), { note: 'new', editedAt: 1 }));
await t('manager edits a bill', 'allow', () => updateDoc(p(MALL, 'sales', 's1'), { note: 'new', editedAt: 1 }));
await t('off login reads own member row', 'allow', () => getDoc(p(OFF, 'members', OFF)));

// ── Phase 1: branch lock + cashier signature ──
await t('cashier sale at another branch', 'deny', () => sale(CA, 'B'));
await t('cashier sale with no branch', 'deny', () => sale(CA, null));
await t('cashier signs sale as someone else', 'deny', () => sale(CA, 'A', { soldByUid: CB }));
await t('all-branch manager sells at any branch', 'allow', () => sale(MALL, 'B'));
await t('one-branch manager at other branch', 'deny', () => sale(MA, 'B'));
await t('owner sells at any branch', 'allow', () => sale(OWNER, 'B', { soldByUid: OWNER }));
await t('older cashier with no branch can still sell', 'allow', () => sale(OLD, 'A'));
await t('old-app sale with no cashier field still saves', 'allow', () => addDoc(col(OLD, 'sales'), { amount: 5, createdAt: now }));
await t('off login cannot sell', 'deny', () => sale(OFF, 'A'));
await t('outsider cannot sell', 'deny', () => sale(NOPE, 'A'));
await t('sale cannot be moved to another branch', 'deny', () => updateDoc(p(OWNER, 'sales', 's1'), { branchId: 'B' }));
await t('sale amount cannot be edited', 'deny', () => updateDoc(p(MALL, 'sales', 's1'), { amount: 1 }));
await t('cashier cannot change anything else on a settle', 'deny', () => updateDoc(p(CA, 'sales', 's1'), { settled: true, amount: 1 }));
await t('cashier stock write cannot change price', 'deny', () => updateDoc(p(CA, 'products', 'p1'), { stock: 9, sellingPrice: 1 }));
await t('cashier cannot set negative stock', 'deny', () => updateDoc(p(CA, 'products', 'p1'), { stock: -1 }));
await t('staff cannot change branch of member doc', 'deny', () => updateDoc(p(CA, 'members', CA), { branchId: 'B' }));
await t('staff cannot tick own permissions', 'deny', () => updateDoc(p(CA, 'members', CA), { permissions: { viewReports: true } }));
await t('owner assigns branch and ticks', 'allow', () => updateDoc(p(OWNER, 'members', CA), { branchId: 'B', permissions: { viewReports: true } }));

// ── Per-branch cash ──
await t('cashier adds opening for own branch', 'allow', () => day(CB, 'B', { opening: 100 }));
await t('cashier adds opening, new day doc', 'allow', () => day(CA, 'A', { opening: 100 }, '2026-11-05'));
await t('cashier cannot change saved opening', 'deny', () => day(CA, 'A', { opening: 999 }));
await t('cashier cannot remove saved opening', 'deny', () => updateDoc(p(CA, 'branchDays', `A_${DAY}`), { opening: deleteField() }));
await t('cashier cannot add opening for other branch', 'deny', () => day(CA, 'B', { opening: 100 }));
await t('wrong document id rejected', 'deny', () => setDoc(p(CA, 'branchDays', `A_2020-01-01`), { branchId: 'A', day: DAY, opening: 1 }));
await t('all-branch manager adds opening anywhere', 'allow', () => day(MALL, 'B', { opening: 100 }));
await t('manager cannot change saved opening', 'deny', () => day(MALL, 'A', { opening: 999 }));
await t('owner changes saved opening', 'allow', () => day(OWNER, 'A', { opening: 999 }));
await t('cashier closes own branch', 'allow', () => day(CA, 'A', { closedAt: 123 }));
await t('cashier resumes own branch', 'allow', () => day(CA, 'A', { closedAt: null }));
await t('cashier cannot close other branch', 'deny', () => day(CA, 'B', { closedAt: 123 }));
await t('tied cashier cannot write shop-wide close', 'deny', () => updateDoc(doc(db(CA), 'users', OWNER), { [`closedDays.${DAY}`]: 1 }));
await t('tied cashier cannot write shop-wide opening', 'deny', () => setDoc(doc(db(CA), 'users', OWNER), { openingBalances: { '2026-11-05': 1 } }, { merge: true }));
await t('older cashier adds shop-wide opening', 'allow', () => setDoc(doc(db(OLD), 'users', OWNER), { openingBalances: { '2026-11-05': 1 } }, { merge: true }));
await t('older cashier cannot change shop-wide opening', 'deny', () => setDoc(doc(db(OLD), 'users', OWNER), { openingBalances: { [DAY]: 1 } }, { merge: true }));
await t('older cashier closes shop-wide day', 'allow', () => updateDoc(doc(db(OLD), 'users', OWNER), { [`closedDays.${DAY}`]: 1 }));
await t('staff cannot rename the shop', 'deny', () => updateDoc(doc(db(CA), 'users', OWNER), { shopName: 'x' }));
await t('staff cannot change plan status', 'deny', () => updateDoc(doc(db(CA), 'users', OWNER), { status: 'suspended', nextInvoice: 6 }));
await t('owner cannot change own status', 'deny', () => updateDoc(doc(db(OWNER), 'users', OWNER), { status: 'trial' }));

// ── Phase 3: ticks ──
await t('template: cashier cannot add expense', 'deny', () => addDoc(col(CA, 'expenses'), { amount: 5, category: 'x', createdAt: now, branchId: 'A' }));
await t('tick on: cashier adds expense', 'allow', () => addDoc(col(CTICK, 'expenses'), { amount: 5, category: 'x', createdAt: now, branchId: 'A' }));
await t('tick on: expense still locked to branch', 'deny', () => addDoc(col(CTICK, 'expenses'), { amount: 5, category: 'x', createdAt: now, branchId: 'B' }));
await t('template: cashier cannot edit bill', 'deny', () => updateDoc(p(CA, 'sales', 's1'), { note: 'n', editedAt: 1 }));
await t('tick on: cashier edits bill', 'allow', () => updateDoc(p(CTICK, 'sales', 's1'), { note: 'n', editedAt: 1 }));
await t('template: cashier cannot delete bill', 'deny', () => deleteDoc(p(CA, 'sales', 's1')));
await t('tick on: cashier deletes bill', 'allow', () => deleteDoc(p(CTICK, 'sales', 's1')));
await t('tick off: cashier cannot close day', 'deny', () => day(CTICK, 'A', { closedAt: 1 }));
await t('tick off: cashier can still add opening', 'allow', () => day(CTICK, 'A', { opening: 300 }));
await t('tick off: manager cannot add expense', 'deny', () => addDoc(col(MCUT, 'expenses'), { amount: 5, category: 'x', createdAt: now }));
await t('tick off: manager cannot delete bill', 'deny', () => deleteDoc(p(MCUT, 'sales', 's1')));
await t('tick off: manager cannot edit price', 'deny', () => updateDoc(p(MCUT, 'products', 'p1'), { name: 'Tea', sellingPrice: 1 }));
await t('tick off: manager cannot touch materials', 'deny', () => setDoc(p(MCUT, 'materials', 'm1'), { name: 'Rice' }));
await t('manager template edits price', 'allow', () => updateDoc(p(MALL, 'products', 'p1'), { name: 'Tea', sellingPrice: 1 }));
await t('manager template adds material', 'allow', () => setDoc(p(MALL, 'materials', 'm1'), { name: 'Rice' }));
await t('cashier cannot add material', 'deny', () => setDoc(p(CA, 'materials', 'm1'), { name: 'Rice' }));
await t('cashier with sale tick writes stock usage', 'allow', () => setDoc(p(CA, 'stockMoves', 'sale_x'), { type: 'sale', branchId: 'A' }));
await t('cashier cannot delete stock entry', 'deny', () => deleteDoc(p(CA, 'stockMoves', 'x')));
await t('owner adds a branch', 'allow', () => setDoc(p(OWNER, 'branches', 'C'), { name: 'New' }));
await t('manager cannot add a branch', 'deny', () => setDoc(p(MALL, 'branches', 'C'), { name: 'New' }));

// ── A cashier at one branch cannot see another branch ──
const only = (u, name, b) => getDocs(query(col(u, name), where('branchId', '==', b)));
for (const name of ['sales', 'expenses', 'creditPayments', 'returns', 'savedOrders', 'stock', 'stockMoves', 'branchDays']) {
  await t(`Branch B cashier: all of ${name} refused`, 'deny', () => getDocs(col(CB, name)));
  await t(`Branch B cashier: Main's ${name} refused`, 'deny', () => only(CB, name, 'A'));
  await t(`Branch B cashier: own ${name} allowed`, 'allow', () => only(CB, name, 'B'));
  await t(`owner: all of ${name} allowed`, 'allow', () => getDocs(col(OWNER, name)));
  await t(`all-branch manager: all of ${name} allowed`, 'allow', () => getDocs(col(MALL, name)));
}
await t('Branch B cashier: one Main sale refused', 'deny', () => getDoc(p(CB, 'sales', 's1')));
await t('Branch B cashier: own sale allowed', 'allow', () => getDoc(p(CB, 'sales', 'sB')));
await t('Branch B cashier: old unstamped sale refused', 'deny', () => getDoc(p(CB, 'sales', 'old')));
await t('Branch B cashier: Main stock row refused', 'deny', () => getDoc(p(CB, 'stock', 'A_i1')));
await t('Branch B cashier: Main ledger entry refused', 'deny', () => getDoc(p(CB, 'stockMoves', 'mA')));
await t('Branch B cashier: Main day refused', 'deny', () => getDoc(p(CB, 'branchDays', `A_${DAY}`)));
await t('Branch B cashier: staff list refused', 'deny', () => getDocs(col(CB, 'members')));
await t('Branch B cashier: audit log refused', 'deny', () => getDocs(col(CB, 'audit')));
await t('one-branch manager: audit log refused', 'deny', () => getDocs(col(MA, 'audit')));
await t('one-branch manager: other branch sale refused', 'deny', () => getDoc(p(MA, 'sales', 'sB')));
await t('all-branch manager: audit log allowed', 'allow', () => getDocs(col(MALL, 'audit')));

// ── Old rows belong to Main: only the owner stamps them, once ──
await t('owner stamps the main branch on an old sale', 'allow', () => updateDoc(p(OWNER, 'sales', 'old'), { branchId: 'A' }));
await t('owner stamps an old expense', 'allow', () => updateDoc(p(OWNER, 'expenses', 'e1'), { branchId: 'A' }));
await t('owner cannot re-stamp a sale to another branch', 'deny', () => updateDoc(p(OWNER, 'sales', 's1'), { branchId: 'B' }));
await t('stamp cannot carry other changes', 'deny', () => updateDoc(p(OWNER, 'sales', 'old'), { branchId: 'A', amount: 1 }));
await t('staff cannot stamp', 'deny', () => updateDoc(p(MALL, 'sales', 'old'), { branchId: 'A' }));

// ── Stock rows and ledger ──
const row = (b, qty, avgCost = 5) => ({ branchId: b, itemId: 'i1', qty, avgCost });
await t('cashier sale lowers own branch stock', 'allow', () => setDoc(p(CB, 'stock', 'B_i1'), row('B', 9)));
await t('cashier sale may go below zero', 'allow', () => setDoc(p(CB, 'stock', 'B_i1'), row('B', -3)));
await t('sale before first delivery starts a negative row', 'allow', () => setDoc(p(CB, 'stock', 'B_new'), { branchId: 'B', itemId: 'new', qty: -1, avgCost: 0 }));
await t('cashier cannot raise stock', 'deny', () => setDoc(p(CB, 'stock', 'B_i1'), row('B', 11)));
await t('cashier cannot change average cost', 'deny', () => setDoc(p(CB, 'stock', 'B_i1'), row('B', 9, 1)));
await t('cashier cannot touch Main stock', 'deny', () => setDoc(p(CB, 'stock', 'A_i1'), row('A', 9)));
await t('cashier cannot create stock from nothing', 'deny', () => setDoc(p(CB, 'stock', 'B_new'), { branchId: 'B', itemId: 'new', qty: 5, avgCost: 0 }));
await t('row id must match branch and item', 'deny', () => setDoc(p(OWNER, 'stock', 'wrong'), row('B', 1)));
await t('stock rows cannot be deleted', 'deny', () => deleteDoc(p(OWNER, 'stock', 'A_i1')));
await t('owner moves stock anywhere', 'allow', () => setDoc(p(OWNER, 'stock', 'A_i1'), row('A', 1, 9)));
await t('tick on: cashier with stock tick counts own branch', 'allow', async () => {
  await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'users', OWNER, 'members', CB), { permissions: { manageStock: true } }));
  await setDoc(p(CB, 'stock', 'B_i1'), row('B', 20));
});
await t('one-branch manager cannot write Main stock', 'deny', () => setDoc(p(MA, 'stock', 'B_i1'), row('B', 1)));
const move = (u, type, b) => addDoc(col(u, 'stockMoves'), { type, branchId: b, qty: {}, cost: {}, createdAt: now });
await t('cashier ledger: sale at own branch', 'allow', () => move(CB, 'sale', 'B'));
await t('cashier ledger: no sale at Main', 'deny', () => move(CB, 'sale', 'A'));
await t('cashier ledger: no transfer', 'deny', () => move(CB, 'transferIn', 'B'));
await t('cashier ledger: no adjustment', 'deny', () => move(CB, 'adjust', 'B'));
await t('owner ledger: transfer', 'allow', () => move(OWNER, 'transferIn', 'B'));
await t('ledger is append only: no edit', 'deny', () => updateDoc(p(OWNER, 'stockMoves', 'mA'), { note: 'x' }));
await t('ledger is append only: no delete', 'deny', () => deleteDoc(p(OWNER, 'stockMoves', 'mA')));

// ── The owner's acceptance test, as real transactions under the rules ──
await seed();
const MAIN = 'A', BR = 'B';
const items = BURGER_SHOP_TEST_ITEMS.map((s) => ({
  id: s.name.replace(/ /g, '-'), name: s.name, unit: s.unit, kind: s.kind, avgCost: 0, reorderLevel: 0, createdAt: 0,
  ...(s.recipe ? { inputs: s.recipe.map((n) => ({ materialId: n.replace(/ /g, '-'), qty: 1 })) } : {}),
}));
const BUN = 'Burger-bun', PATTY = 'Chicken-burger-(patty)', BURGER = 'Chicken-Burger', CHIPS = 'Chips-potato';
const everyRow = [MAIN, BR].flatMap((b) => items.map((i) => stockRowId(b, i.id)));
async function run(u, plan, extra) {
  const store = db(u);
  const stockDoc = (id) => doc(store, 'users', OWNER, 'stock', id);
  return runTransaction(store, async (tx) => {
    // A cashier may only read their own branch's rows, like the app.
    const mine = u === CB ? everyRow.filter((id) => id.startsWith(BR + '_')) : everyRow;
    const snaps = await Promise.all(mine.map((id) => tx.get(stockDoc(id))));
    const rows = {};
    snaps.forEach((s, i) => { if (s.exists()) rows[mine[i]] = s.data(); });
    const planned = plan(rows);
    for (const [id, r] of Object.entries(planned.rows)) tx.set(stockDoc(id), r);
    for (const m of planned.moves) tx.set(doc(collection(store, 'users', OWNER, 'stockMoves')), { ...m, createdAt: now });
    extra?.(tx, store);
    return planned;
  });
}
const stored = async (b, item) => {
  let out = 0;
  await env.withSecurityRulesDisabled(async (ctx) => {
    const s = await getDoc(doc(ctx.firestore(), 'users', OWNER, 'stock', stockRowId(b, item)));
    out = s.data()?.qty ?? 0;
  });
  return out;
};
const same = async (name, b, item, want) => {
  n += 1;
  const got = await stored(b, item);
  if (got === want) console.log(`PASS  flow  ${name}`);
  else { failed += 1; console.log(`FAIL  flow  ${name} :: wanted ${want}, got ${got}`); }
};
const sell = (qty, item = BURGER) => run(CB, (rows) => planSale(rows, items, { branchId: BR, lines: [{ itemId: item, qty }] }), (tx, store) => {
  tx.set(doc(collection(store, 'users', OWNER, 'sales')), { amount: 100, createdAt: now, branchId: BR, soldByUid: CB, soldByName: 'B' });
});
await run(OWNER, (rows) => planPurchase(rows, items, { branchId: MAIN, lines: [{ itemId: BUN, qty: 200, unitCost: 30 }, { itemId: PATTY, qty: 100, unitCost: 120 }] }));
await same('purchase: Main buns 200', MAIN, BUN, 200);
await same('purchase: Main patties 100', MAIN, PATTY, 100);
const first = [{ itemId: BUN, qty: 10 }, { itemId: PATTY, qty: 10 }];
await run(OWNER, (rows) => planSend(rows, items, { fromId: MAIN, toId: BR, refId: 't1', lines: first, assemble: [{ itemId: BURGER, qty: previewAssemble(first, items)[0].qty }] }));
await same('send 10+10: Main bun 190', MAIN, BUN, 190);
await same('send 10+10: Main patty 90', MAIN, PATTY, 90);
await same('send 10+10: Branch B raw bun 0', BR, BUN, 0);
await same('send 10+10: Branch B raw patty 0', BR, PATTY, 0);
await same('send 10+10: Branch B Chicken Burger 10', BR, BURGER, 10);
await sell(7);
await same('cashier sells 7: Branch B Chicken Burger 3', BR, BURGER, 3);
await same('cashier sells 7: Main bun unchanged', MAIN, BUN, 190);
await same('cashier sells 7: Main patty unchanged', MAIN, PATTY, 90);
const second = [{ itemId: BUN, qty: 8 }, { itemId: PATTY, qty: 10 }];
await run(OWNER, (rows) => planSend(rows, items, { fromId: MAIN, toId: BR, refId: 't2', lines: second, assemble: [{ itemId: BURGER, qty: previewAssemble(second, items)[0].qty }] }));
await same('send 8+10: only 8 made (3 + 8 = 11)', BR, BURGER, 11);
await same('send 8+10: 2 patty stay raw', BR, PATTY, 2);
await run(OWNER, (rows) => planPurchase(rows, items, { branchId: MAIN, lines: [{ itemId: CHIPS, qty: 5000, unitCost: 0.8 }] }));
await run(OWNER, (rows) => planSend(rows, items, { fromId: MAIN, toId: BR, refId: 't3', lines: [{ itemId: CHIPS, qty: 5000 }] }));
await sell(300, CHIPS);
await same('chips: 5,000 g less 2 × 150 g = 4,700 g', BR, CHIPS, 4700);
await sell(8);
await same('before count: system shows 3', BR, BURGER, 3);
const counted = await run(OWNER, (rows) => planCount(rows, items, { branchId: BR, counted: { [BURGER]: 2 } }));
await same('count 2: Chicken Burger 2', BR, BURGER, 2);
n += 1;
if (counted.moves[0].cost[BURGER] === -150) console.log('PASS  flow  count: loss of 1 × recipe cost (Rs 150)');
else { failed += 1; console.log('FAIL  flow  count value', counted.moves[0].cost); }
await t('flow: cashier cannot see Main after all that', 'deny', () => getDocs(query(col(CB, 'stock'), where('branchId', '==', MAIN))));

await env.cleanup();
console.log(failed ? `\n${failed} of ${n} FAILED` : `\nALL ${n} PASSED`);
process.exit(failed ? 1 : 0);
