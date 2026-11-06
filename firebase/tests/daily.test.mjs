/**
 * The daily report numbers. dayClose.ts imports phone-only modules for printing and sharing,
 * so it is bundled here with those stubbed. The maths under test is the real file.
 * Run: npm run test:daily
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = mkdtempSync(join(tmpdir(), 'kb-daily-'));
const outfile = join(dir, 'dayClose.mjs');
await build({
  entryPoints: [new URL('../../src/lib/dayClose.ts', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  logLevel: 'silent',
  plugins: [{
    name: 'stub-phone-modules',
    setup(b) {
      b.onResolve({ filter: /^react-native$|printReceipt$/ }, (args) => ({ path: args.path, namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
        contents: 'export const Linking = {}; export const Share = {}; export const printTextReport = () => {};',
      }));
    },
  }],
});
const { buildDayCloseSummary, buildDayCloseReportText, isStockPurchase } = await import(pathToFileURL(outfile).href);

const now = Date.now();
const line = (qty, unitPrice, unitCost) => ({ name: 'x', qty, unitPrice, lineTotal: qty * unitPrice, unitCost });
const books = {
  products: [],
  meta: { nextInvoice: 1, openingBalances: { [new Date(now).toLocaleDateString('sv')]: 1000 }, quickSaleProfitPercent: 10 },
  sales: [
    { id: 'cash', amount: 1000, createdAt: now, kind: 'bill', paymentMode: 'cash', settled: true, items: [line(2, 500, 150)] },
    { id: 'card', amount: 600, createdAt: now, kind: 'bill', paymentMode: 'card', settled: true, items: [line(2, 300, 150)] },
    { id: 'credit', amount: 400, createdAt: now, kind: 'bill', paymentMode: 'credit', settled: false, paidAmount: 100, items: [line(1, 400, 150)] },
  ],
  expenses: [
    { id: 'buy', amount: 16000, category: 'Stock Purchase', createdAt: now },
    { id: 'supplier', amount: 173, category: 'Supplier Payment', createdAt: now },
    { id: 'rent', amount: 200, category: 'Other', createdAt: now },
  ],
  creditPayments: [
    { id: 'p1', customerId: 'c', amount: 50, method: 'cash', createdAt: now },
    { id: 'p2', customerId: 'c', amount: 70, method: 'card', createdAt: now },
  ],
};
const day = buildDayCloseSummary(books, now);

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`PASS  ${name}`); };

ok('stock purchases and supplier payments are not running costs', () => {
  assert.equal(isStockPurchase({ category: 'Stock Purchase' }), true);
  assert.equal(isStockPurchase({ category: 'Supplier Payment' }), true);
  assert.equal(isStockPurchase({ category: 'Rent' }), false);
  assert.equal(day.stockPurchase, 16173);
  assert.equal(day.operatingExpenses, 200);
});
ok('fix 1: profit takes off running expenses only, never stock purchases', () => {
  // Product profit: (1000 − 300) + (600 − 300) + (400 − 150) = 1250. Less rent 200.
  assert.equal(day.productProfit, 1250);
  assert.equal(day.netProfit, 1050);
});
ok('fix 2: cash in drawer leaves out card sales and card collections', () => {
  // 1000 opening + 1000 cash sales + (50 cash + 100 paid on the credit bill) − 200 − 16173.
  assert.equal(day.cardSales, 600);
  assert.equal(day.cashSales, 1000);
  assert.equal(day.cashCollected, 150);
  assert.equal(day.expectedCash, -14223);
});
ok('fix 3: opening cash is not sales', () => {
  assert.equal(day.todaySales, day.totalSales);
  assert.equal(day.totalSales, 1600);
});
ok('the printed report uses the new labels', () => {
  const text = buildDayCloseReportText('Shop', day);
  assert.match(text, /Cash in drawer/);
  assert.match(text, /Stock purchases/);
  assert.doesNotMatch(text, /Expected cash|Total expenses/);
});
ok('a cost in cents stays exact on the bill line', () => {
  const grams = { ...books, expenses: [], creditPayments: [], sales: [{ id: 'g', amount: 300, createdAt: now, kind: 'bill', paymentMode: 'cash', settled: true, items: [line(1, 300, 120.5)] }] };
  assert.equal(buildDayCloseSummary(grams, now).productProfit, 180);
});

rmSync(dir, { recursive: true, force: true });
console.log(`\nALL ${n} PASSED`);
