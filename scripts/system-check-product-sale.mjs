/**
 * Offline logic checks for simple vs menu product sales.
 * Run: node scripts/system-check-product-sale.mjs
 */

function normalizeSellKind(value) {
  return value === 'menu' ? 'menu' : 'simple';
}

function effectiveSellKind(product, recipes) {
  if (product.sellKind === 'menu') return 'menu';
  if (product.sellKind === 'simple') return 'simple';
  return recipes.some((r) => r.productId === product.id) ? 'menu' : 'simple';
}

function hasRecipe(productId, recipes) {
  return recipes.some((r) => r.productId === productId);
}

/** Mirrors kitchenOps.saleUsage shape for tests. */
function saleUsage(items, recipes) {
  const usage = {};
  for (const line of items) {
    if (!line.productId || !line.qty) continue;
    const recipe = recipes.find((r) => r.productId === line.productId);
    if (!recipe) continue;
    for (const part of recipe.lines) {
      usage[part.materialId] = (usage[part.materialId] || 0) + part.qty * line.qty;
    }
  }
  return usage;
}

function shouldRecordKitchenSale(shopType, items, recipes) {
  if (shopType !== 'kitchen') return false;
  return Object.keys(saleUsage(items, recipes)).length > 0;
}

const recipes = [
  {
    productId: 'burger',
    lines: [
      { materialId: 'bun', qty: 1 },
      { materialId: 'patty', qty: 1 },
    ],
  },
];

const coke = { id: 'coke', sellKind: 'simple' };
const burger = { id: 'burger', sellKind: 'menu' };
const oldFood = { id: 'burger', sellKind: undefined };

let failed = 0;
function assert(name, cond) {
  if (!cond) {
    failed += 1;
    console.error('FAIL', name);
  } else {
    console.log('OK  ', name);
  }
}

assert('coke is simple', effectiveSellKind(coke, recipes) === 'simple');
assert('burger marked menu', effectiveSellKind(burger, recipes) === 'menu');
assert('legacy with recipe → menu', effectiveSellKind(oldFood, recipes) === 'menu');
assert('normalize menu', normalizeSellKind('menu') === 'menu');
assert('has recipe burger', hasRecipe('burger', recipes));
assert('no recipe coke', !hasRecipe('coke', recipes));

const bill = [
  { productId: 'coke', qty: 2 },
  { productId: 'burger', qty: 1 },
];
const usage = saleUsage(bill, recipes);
assert('usage has bun', usage.bun === 1);
assert('usage has patty', usage.patty === 1);
assert('coke not in usage', usage.coke == null);
assert('retail skips kitchen record', shouldRecordKitchenSale('retail', bill, recipes) === false);
assert('kitchen records when recipe items', shouldRecordKitchenSale('kitchen', bill, recipes) === true);
assert(
  'kitchen skips coke-only bill',
  shouldRecordKitchenSale('kitchen', [{ productId: 'coke', qty: 1 }], recipes) === false,
);

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll system checks passed.');
