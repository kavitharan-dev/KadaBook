/**
 * The owner's acceptance test, run on the stock engine with no storage.
 * Run: npm run test:stock
 */
import assert from 'node:assert/strict';
import {
  BURGER_SHOP_TEST_ITEMS,
  makeNeeds,
  planCount,
  planMake,
  planPurchase,
  planSale,
  planSaleReturn,
  planSend,
  previewAssemble,
  productUnitCost,
  saleStockLines,
  stockRowId,
  type StockPlan,
  type StockRows,
} from '../../src/lib/stockEngine';
import type { RawMaterial } from '../../src/data/kitchenTypes';

const items: RawMaterial[] = BURGER_SHOP_TEST_ITEMS.map((seed) => ({
  id: seed.name,
  name: seed.name,
  unit: seed.unit,
  kind: seed.kind,
  avgCost: 0,
  reorderLevel: 0,
  createdAt: 0,
  ...(seed.recipe ? { inputs: seed.recipe.map((materialId) => ({ materialId, qty: 1 })) } : {}),
}));

const MAIN = 'main';
const B = 'branchB';
const PATTY = 'Chicken burger (patty)';
const CRISPY = 'Crispy burger (patty)';
const VEG = 'Vegetable burger (patty)';
const CHIPS = 'Chips potato';
let rows: StockRows = {};
const ledger: StockPlan['moves'] = [];
const apply = (plan: StockPlan) => {
  rows = { ...rows, ...plan.rows };
  ledger.push(...plan.moves);
};
const qty = (branch: string, item: string) => rows[stockRowId(branch, item)]?.qty ?? 0;
const avg = (branch: string, item: string) => rows[stockRowId(branch, item)]?.avgCost ?? 0;

let count = 0;
const ok = (name: string, fn: () => void) => {
  fn();
  count += 1;
  console.log(`PASS  ${name}`);
};

ok('purchase 200 Burger bun and 100 Chicken burger (patty) at Main', () => {
  apply(planPurchase(rows, items, {
    branchId: MAIN,
    lines: [
      { itemId: 'Burger bun', qty: 200, unitCost: 30 },
      { itemId: PATTY, qty: 100, unitCost: 120 },
    ],
  }));
  assert.equal(qty(MAIN, 'Burger bun'), 200);
  assert.equal(qty(MAIN, PATTY), 100);
});

ok('send 10 + 10: preview says 10 Chicken Burger', () => {
  const preview = previewAssemble([{ itemId: 'Burger bun', qty: 10 }, { itemId: PATTY, qty: 10 }], items);
  assert.deepEqual(preview.map((p) => [p.name, p.qty, p.short.length]), [['Chicken Burger', 10, 0]]);
});

ok('confirm: Main bun 190, Main patty 90, Branch B raw 0, Branch B Chicken Burger 10', () => {
  const plan = planSend(rows, items, {
    fromId: MAIN,
    toId: B,
    refId: 't1',
    lines: [{ itemId: 'Burger bun', qty: 10 }, { itemId: PATTY, qty: 10 }],
    assemble: [{ itemId: 'Chicken Burger', qty: 10 }],
  });
  assert.deepEqual(plan.moves.map((m) => m.type), ['transferOut', 'transferIn', 'assembleOut', 'assembleIn']);
  apply(plan);
  assert.equal(qty(MAIN, 'Burger bun'), 190);
  assert.equal(qty(MAIN, PATTY), 90);
  assert.equal(qty(B, 'Burger bun'), 0);
  assert.equal(qty(B, PATTY), 0);
  assert.equal(qty(B, 'Chicken Burger'), 10);
});

ok('finished cost = sum of recipe ingredient average costs', () => {
  assert.equal(avg(B, 'Chicken Burger'), 150);
});

const burgerProduct = { id: 'p-burger', stockItemId: 'Chicken Burger' };
const chipsProduct = { id: 'p-chips', stockItemId: CHIPS, portionQty: 150 };

ok('sell 7 at Branch B: Branch B Chicken Burger 3, Main raw unchanged', () => {
  const lines = saleStockLines([{ productId: burgerProduct.id, qty: 7 }], [burgerProduct, chipsProduct]);
  const plan = planSale(rows, items, { branchId: B, lines });
  apply(plan);
  assert.equal(qty(B, 'Chicken Burger'), 3);
  assert.equal(qty(MAIN, 'Burger bun'), 190);
  assert.equal(qty(MAIN, PATTY), 90);
  assert.equal(qty(B, 'Burger bun'), 0, 'sale must never touch raw');
  assert.equal(productUnitCost(burgerProduct, plan.unitCost), 150, 'cost snapshot on the sale line');
});

ok('send 8 bun + 10 patty: only 8 burgers, warning shows, 2 patty stay raw at Branch B', () => {
  const lines = [{ itemId: 'Burger bun', qty: 8 }, { itemId: PATTY, qty: 10 }];
  const preview = previewAssemble(lines, items);
  assert.equal(preview[0].qty, 8);
  assert.deepEqual(preview[0].short.map((s) => [s.name, s.qty]), [['Burger bun', 2]]);
  apply(planSend(rows, items, { fromId: MAIN, toId: B, refId: 't2', lines, assemble: [{ itemId: 'Chicken Burger', qty: preview[0].qty }] }));
  assert.equal(qty(B, 'Chicken Burger'), 11);
  assert.equal(qty(B, PATTY), 2);
  assert.equal(qty(B, 'Burger bun'), 0);
  assert.equal(qty(MAIN, 'Burger bun'), 182);
  assert.equal(qty(MAIN, PATTY), 80);
});

ok('send 5,000 g chips, portion 150 g, sell 2: Branch B chips 4,700 g', () => {
  apply(planPurchase(rows, items, { branchId: MAIN, lines: [{ itemId: CHIPS, qty: 10000, unitCost: 0.8 }] }));
  apply(planSend(rows, items, { fromId: MAIN, toId: B, refId: 't3', lines: [{ itemId: CHIPS, qty: 5000 }] }));
  assert.equal(avg(B, CHIPS), 0.8, 'cost per gram follows the sender');
  const lines = saleStockLines([{ productId: chipsProduct.id, qty: 2 }], [burgerProduct, chipsProduct]);
  assert.deepEqual(lines, [{ itemId: CHIPS, qty: 300 }]);
  const plan = planSale(rows, items, { branchId: B, lines });
  apply(plan);
  assert.equal(qty(B, CHIPS), 4700);
  assert.equal(productUnitCost(chipsProduct, plan.unitCost), 120, '150 g at Rs 0.80');
});

ok('count 2 when the system shows 3: adjustment of 1 x recipe cost, shown as loss', () => {
  apply(planSale(rows, items, { branchId: B, lines: [{ itemId: 'Chicken Burger', qty: 8 }] }));
  assert.equal(qty(B, 'Chicken Burger'), 3);
  const plan = planCount(rows, items, { branchId: B, counted: { 'Chicken Burger': 2 } });
  apply(plan);
  assert.equal(qty(B, 'Chicken Burger'), 2);
  assert.equal(plan.moves[0].type, 'adjust');
  assert.equal(plan.moves[0].qty['Chicken Burger'], -1);
  assert.equal(plan.moves[0].cost['Chicken Burger'], -150, 'negative value is the loss');
});

/* Beyond the owner's list: the rules around the edges. */

ok('a sale is never blocked: stock goes negative', () => {
  const plan = planSale(rows, items, { branchId: B, lines: [{ itemId: 'Veg Burger', qty: 2 }] });
  assert.equal(plan.rows[stockRowId(B, 'Veg Burger')].qty, -2);
});
ok('buns are shared across items of the same bun type', () => {
  const preview = previewAssemble(
    [{ itemId: 'Burger bun', qty: 8 }, { itemId: PATTY, qty: 5 }, { itemId: CRISPY, qty: 5 }],
    items,
  );
  assert.deepEqual(preview.map((p) => [p.name, p.qty]), [['Chicken Burger', 5], ['Crispy Burger', 3]]);
  assert.deepEqual(preview[1].short.map((s) => s.qty), [2]);
});
ok('the bun type comes from the recipe: submarine buns make no burgers', () => {
  const preview = previewAssemble([{ itemId: 'Submarine bun', qty: 5 }, { itemId: PATTY, qty: 5 }], items);
  assert.equal(preview[0].name, 'Chicken Burger');
  assert.equal(preview[0].qty, 0);
  assert.deepEqual(preview[0].short.map((s) => [s.name, s.qty]), [['Burger bun', 5]]);
});
ok('buns alone suggest nothing', () => {
  assert.deepEqual(previewAssemble([{ itemId: 'Burger bun', qty: 5 }], items), []);
});
ok('hotdog + submarine bun makes Hot Dog Bun', () => {
  const preview = previewAssemble([{ itemId: 'Hotdog', qty: 4 }, { itemId: 'Submarine bun', qty: 4 }], items);
  assert.deepEqual(preview.map((p) => [p.name, p.qty]), [['Hot Dog Bun', 4]]);
});
ok('owner can edit N, but not past the raw at the far branch', () => {
  assert.throws(
    () => planSend(rows, items, { fromId: MAIN, toId: B, refId: 'x', lines: [{ itemId: 'Burger bun', qty: 1 }], assemble: [{ itemId: 'Chicken Burger', qty: 5 }] }),
    /Not enough/,
  );
});
ok('cannot send more than the branch has; nothing is half done', () => {
  const before = JSON.stringify(rows);
  assert.throws(() => planSend(rows, items, { fromId: MAIN, toId: B, refId: 'x', lines: [{ itemId: 'Drumstick', qty: 1 }] }), /Not enough/);
  assert.equal(JSON.stringify(rows), before);
});
ok('send already-made finished items directly', () => {
  apply(planPurchase(rows, items, { branchId: MAIN, lines: [{ itemId: 'Drumstick', qty: 5, unitCost: 100 }, { itemId: 'Submarine bun', qty: 5, unitCost: 40 }] }));
  apply(planMake(rows, items, { branchId: MAIN, finishedId: 'Drumstick Bun', qty: 3, refId: 'm1' }));
  assert.equal(qty(MAIN, 'Drumstick Bun'), 3);
  assert.equal(qty(MAIN, 'Drumstick'), 2);
  assert.equal(avg(MAIN, 'Drumstick Bun'), 140);
  apply(planSend(rows, items, { fromId: MAIN, toId: B, refId: 't4', lines: [{ itemId: 'Drumstick Bun', qty: 2 }] }));
  assert.equal(qty(MAIN, 'Drumstick Bun'), 1);
  assert.equal(qty(B, 'Drumstick Bun'), 2);
  assert.equal(avg(B, 'Drumstick Bun'), 140);
});
ok('make shows raw needed against available, and stops when short', () => {
  const needs = makeNeeds(rows, items, MAIN, 'Drumstick Bun', 4);
  assert.deepEqual(needs.map((n) => [n.name, n.need, n.have]), [['Drumstick', 4, 2], ['Submarine bun', 4, 2]]);
  assert.throws(() => planMake(rows, items, { branchId: MAIN, finishedId: 'Drumstick Bun', qty: 4, refId: 'm2' }), /Not enough/);
});
ok('weighted average cost when a dearer batch arrives', () => {
  const start = planPurchase({}, items, { branchId: MAIN, lines: [{ itemId: VEG, qty: 10, unitCost: 100 }] });
  const next = planPurchase(start.rows, items, { branchId: MAIN, lines: [{ itemId: VEG, qty: 10, unitCost: 200 }] });
  assert.equal(next.rows[stockRowId(MAIN, VEG)].avgCost, 150);
});
ok('a returned bill goes back to stock at that branch', () => {
  const before = qty(B, 'Chicken Burger');
  apply(planSaleReturn(rows, items, { branchId: B, lines: [{ itemId: 'Chicken Burger', qty: 1 }] }));
  assert.equal(qty(B, 'Chicken Burger'), before + 1);
  assert.equal(avg(B, 'Chicken Burger'), 150);
});
ok('a count that matches writes no difference', () => {
  const plan = planCount(rows, items, { branchId: B, counted: { 'Chicken Burger': qty(B, 'Chicken Burger') } });
  assert.deepEqual(plan.moves[0].qty, {});
});

console.log(`\nALL ${count} PASSED`);
