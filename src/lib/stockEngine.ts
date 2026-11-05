import type { ItemKind, MoveType, RawMaterial, StockMove, StockRow } from '../data/kitchenTypes';
import { MR_CHEF_MATERIALS, MR_CHEF_RECIPES } from './mrChefCatalog';

/**
 * Every stock change is planned here as a pure function: given the stock rows read inside a
 * transaction, return the new rows and the ledger movements to write with them. No storage here,
 * so the same rules run on Firestore, on the phone-only store and in the tests.
 */

export type StockRows = Record<string, StockRow>;
export type PlannedMove = Omit<StockMove, 'id' | 'createdAt'> & { createdAt?: number };
export type StockPlan = { rows: StockRows; moves: PlannedMove[] };
export type ItemQty = { itemId: string; qty: number };

export function stockRowId(branchId: string, itemId: string) {
  return `${branchId}_${itemId}`;
}

export function roundQty(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/** Older items have no kind: anything made from a recipe or tied to a product is finished. */
export function itemKind(item: Pick<RawMaterial, 'kind' | 'inputs' | 'productId'>): ItemKind {
  if (item.kind) return item.kind;
  return item.productId || item.inputs?.length ? 'finished' : 'raw';
}

function foldLines(lines: ItemQty[]) {
  const out = new Map<string, number>();
  for (const line of lines) {
    if (!line.itemId) continue;
    if (!Number.isFinite(line.qty) || line.qty <= 0) throw new Error('Enter a quantity greater than 0.');
    out.set(line.itemId, roundQty((out.get(line.itemId) ?? 0) + line.qty));
  }
  if (!out.size) throw new Error('Add at least one item with a quantity.');
  return out;
}

/** Working copy of the rows, plus the helpers every plan shares. */
function workspace(rows: StockRows, items: RawMaterial[]) {
  const changed: StockRows = {};
  const read = (branchId: string, itemId: string): StockRow => {
    const id = stockRowId(branchId, itemId);
    return changed[id] ?? rows[id] ?? { branchId, itemId, qty: 0, avgCost: 0 };
  };
  const label = (itemId: string) => items.find((i) => i.id === itemId);
  return {
    changed,
    read,
    label,
    /** Weighted average: negative stock (sold before it arrived) counts as none on hand. */
    addIn(branchId: string, itemId: string, qty: number, unitCost: number) {
      const row = read(branchId, itemId);
      const onHand = Math.max(0, row.qty);
      const total = onHand + qty;
      const avgCost = total > 0 ? roundMoney((onHand * row.avgCost + qty * unitCost) / total) : row.avgCost;
      changed[stockRowId(branchId, itemId)] = { branchId, itemId, qty: roundQty(row.qty + qty), avgCost };
    },
    takeOut(branchId: string, itemId: string, qty: number) {
      const row = read(branchId, itemId);
      changed[stockRowId(branchId, itemId)] = { ...row, qty: roundQty(row.qty - qty) };
      return row.avgCost;
    },
    assertHas(branchId: string, itemId: string, qty: number) {
      const have = read(branchId, itemId).qty;
      if (qty > have + 1e-9) {
        const item = label(itemId);
        throw new Error(`Not enough ${item?.name ?? itemId}: need ${roundQty(qty)} ${item?.unit ?? ''}, have ${roundQty(have)}.`.replace(' ,', ','));
      }
    },
  };
}

type Workspace = ReturnType<typeof workspace>;

function moveOf(type: MoveType, branchId: string, entries: [string, number, number][], extra: Partial<PlannedMove> = {}): PlannedMove {
  return {
    type,
    branchId,
    qty: Object.fromEntries(entries.map(([id, qty]) => [id, roundQty(qty)])),
    cost: Object.fromEntries(entries.map(([id, qty, unitCost]) => [id, roundMoney(qty * unitCost)])),
    ...extra,
  };
}

/* ------------------------------------------------------------------ */
/* Purchase                                                            */
/* ------------------------------------------------------------------ */

export function planPurchase(
  rows: StockRows,
  items: RawMaterial[],
  input: { branchId: string; lines: (ItemQty & { unitCost: number })[]; supplier?: string; note?: string; expiry?: Record<string, string> },
): StockPlan {
  const ws = workspace(rows, items);
  const folded = new Map<string, { qty: number; value: number }>();
  for (const line of input.lines) {
    if (!Number.isFinite(line.qty) || line.qty <= 0) throw new Error('Enter a quantity greater than 0.');
    if (!Number.isFinite(line.unitCost) || line.unitCost < 0) throw new Error('Enter a valid unit cost.');
    const row = folded.get(line.itemId) ?? { qty: 0, value: 0 };
    folded.set(line.itemId, { qty: row.qty + line.qty, value: row.value + line.qty * line.unitCost });
  }
  if (!folded.size) throw new Error('Add at least one item with a quantity.');
  const entries: [string, number, number][] = [];
  for (const [itemId, { qty, value }] of folded) {
    ws.addIn(input.branchId, itemId, qty, value / qty);
    entries.push([itemId, qty, value / qty]);
  }
  return {
    rows: ws.changed,
    moves: [
      moveOf('purchase', input.branchId, entries, {
        ...(input.supplier ? { supplier: input.supplier } : {}),
        ...(input.note ? { note: input.note } : {}),
        ...(input.expiry && Object.keys(input.expiry).length ? { expiry: input.expiry } : {}),
      }),
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Assemble preview                                                    */
/* ------------------------------------------------------------------ */

export type AssembleSuggestion = {
  finishedId: string;
  name: string;
  /** How many the transfer makes. The owner can edit this before confirming. */
  qty: number;
  /** Shared ingredients (buns) that ran out before the fillings did. */
  short: { itemId: string; name: string; qty: number }[];
};

/**
 * What the raw items in a transfer can make. The filling (an ingredient only one recipe uses)
 * decides the item; shared ingredients (buns) are split between items in recipe order.
 */
export function previewAssemble(lines: ItemQty[], items: RawMaterial[]): AssembleSuggestion[] {
  const pool = new Map<string, number>();
  for (const line of lines) {
    if (line.itemId && line.qty > 0) pool.set(line.itemId, roundQty((pool.get(line.itemId) ?? 0) + line.qty));
  }
  const recipes = items.filter((item) => itemKind(item) === 'finished' && item.inputs?.length);
  const usedBy = new Map<string, number>();
  for (const recipe of recipes) {
    for (const part of recipe.inputs ?? []) usedBy.set(part.materialId, (usedBy.get(part.materialId) ?? 0) + 1);
  }
  const out: AssembleSuggestion[] = [];
  for (const recipe of recipes) {
    const parts = recipe.inputs ?? [];
    const fillings = parts.filter((part) => usedBy.get(part.materialId) === 1);
    const deciding = fillings.length ? fillings : parts;
    if (!deciding.every((part) => (pool.get(part.materialId) ?? 0) > 0)) continue;
    const wanted = Math.min(...deciding.map((part) => Math.floor((pool.get(part.materialId) ?? 0) / part.qty)));
    if (wanted <= 0) continue;
    const qty = Math.min(wanted, ...parts.map((part) => Math.floor((pool.get(part.materialId) ?? 0) / part.qty)));
    const short = parts
      .map((part) => ({ part, missing: roundQty(wanted * part.qty - (pool.get(part.materialId) ?? 0)) }))
      .filter((row) => row.missing > 0)
      .map(({ part, missing }) => ({
        itemId: part.materialId,
        name: items.find((i) => i.id === part.materialId)?.name ?? part.materialId,
        qty: missing,
      }));
    for (const part of parts) pool.set(part.materialId, roundQty((pool.get(part.materialId) ?? 0) - part.qty * qty));
    out.push({ finishedId: recipe.id, name: recipe.name, qty, short });
  }
  return out;
}

function makeFinished(
  ws: Workspace,
  branchId: string,
  finishedId: string,
  qty: number,
  outType: MoveType,
  inType: MoveType,
  extra: Partial<PlannedMove>,
): PlannedMove[] {
  const recipe = ws.label(finishedId);
  if (!recipe?.inputs?.length) throw new Error(`Set the recipe for ${recipe?.name ?? 'this item'} first.`);
  let unitCost = 0;
  const entries: [string, number, number][] = [];
  for (const part of recipe.inputs) {
    const need = roundQty(part.qty * qty);
    ws.assertHas(branchId, part.materialId, need);
    const avg = ws.takeOut(branchId, part.materialId, need);
    unitCost += avg * part.qty;
    entries.push([part.materialId, -need, avg]);
  }
  ws.addIn(branchId, finishedId, qty, unitCost);
  return [moveOf(outType, branchId, entries, extra), moveOf(inType, branchId, [[finishedId, qty, unitCost]], extra)];
}

/* ------------------------------------------------------------------ */
/* Send: branch to branch, any mix, with assembly at the far end       */
/* ------------------------------------------------------------------ */

export function planSend(
  rows: StockRows,
  items: RawMaterial[],
  input: { fromId: string; toId: string; lines: ItemQty[]; assemble?: ItemQty[]; refId: string; note?: string },
): StockPlan {
  if (input.fromId === input.toId) throw new Error('Choose two different branches.');
  const ws = workspace(rows, items);
  const folded = foldLines(input.lines);
  const extra = { refId: input.refId, ...(input.note ? { note: input.note } : {}) };
  const outEntries: [string, number, number][] = [];
  const inEntries: [string, number, number][] = [];
  for (const [itemId, qty] of folded) {
    ws.assertHas(input.fromId, itemId, qty);
    const avg = ws.takeOut(input.fromId, itemId, qty);
    ws.addIn(input.toId, itemId, qty, avg);
    outEntries.push([itemId, -qty, avg]);
    inEntries.push([itemId, qty, avg]);
  }
  const moves = [
    moveOf('transferOut', input.fromId, outEntries, { ...extra, otherBranchId: input.toId }),
    moveOf('transferIn', input.toId, inEntries, { ...extra, otherBranchId: input.fromId }),
  ];
  for (const run of input.assemble ?? []) {
    if (!Number.isFinite(run.qty) || run.qty < 0 || !Number.isInteger(run.qty)) throw new Error('Enter a whole number to make.');
    if (run.qty === 0) continue;
    moves.push(...makeFinished(ws, input.toId, run.itemId, run.qty, 'assembleOut', 'assembleIn', extra));
  }
  return { rows: ws.changed, moves };
}

/* ------------------------------------------------------------------ */
/* Make (production at any branch)                                     */
/* ------------------------------------------------------------------ */

export function planMake(
  rows: StockRows,
  items: RawMaterial[],
  input: { branchId: string; finishedId: string; qty: number; refId: string; note?: string },
): StockPlan {
  if (!Number.isFinite(input.qty) || input.qty <= 0) throw new Error('Enter how many to make.');
  const ws = workspace(rows, items);
  const extra = { refId: input.refId, ...(input.note ? { note: input.note } : {}) };
  const moves = makeFinished(ws, input.branchId, input.finishedId, input.qty, 'productionOut', 'productionIn', extra);
  return { rows: ws.changed, moves };
}

/** Raw needed against raw on hand, for the Make screen. */
export function makeNeeds(rows: StockRows, items: RawMaterial[], branchId: string, finishedId: string, qty: number) {
  const recipe = items.find((i) => i.id === finishedId);
  return (recipe?.inputs ?? []).map((part) => ({
    itemId: part.materialId,
    name: items.find((i) => i.id === part.materialId)?.name ?? part.materialId,
    need: roundQty(part.qty * qty),
    have: rows[stockRowId(branchId, part.materialId)]?.qty ?? 0,
  }));
}

/* ------------------------------------------------------------------ */
/* Sale, return, count, wastage                                        */
/* ------------------------------------------------------------------ */

/** Never blocks: stock may go negative, the cashier only gets a warning. Average cost is untouched. */
export function planSale(
  rows: StockRows,
  items: RawMaterial[],
  input: { branchId: string; lines: ItemQty[]; refId?: string },
): StockPlan & { unitCost: Record<string, number> } {
  const ws = workspace(rows, items);
  const unitCost: Record<string, number> = {};
  const entries: [string, number, number][] = [];
  for (const [itemId, qty] of foldLines(input.lines)) {
    const avg = ws.takeOut(input.branchId, itemId, qty);
    unitCost[itemId] = avg;
    entries.push([itemId, -qty, avg]);
  }
  return {
    rows: ws.changed,
    moves: [moveOf('sale', input.branchId, entries, input.refId ? { refId: input.refId } : {})],
    unitCost,
  };
}

/** A returned bill puts the item back at the branch, at that branch's current average cost. */
export function planSaleReturn(
  rows: StockRows,
  items: RawMaterial[],
  input: { branchId: string; lines: ItemQty[]; refId?: string },
): StockPlan {
  const ws = workspace(rows, items);
  const entries: [string, number, number][] = [];
  for (const [itemId, qty] of foldLines(input.lines)) {
    const avg = ws.read(input.branchId, itemId).avgCost;
    ws.addIn(input.branchId, itemId, qty, avg);
    entries.push([itemId, qty, avg]);
  }
  return {
    rows: ws.changed,
    moves: [moveOf('saleReturn', input.branchId, entries, input.refId ? { refId: input.refId } : {})],
  };
}

export function planWastage(
  rows: StockRows,
  items: RawMaterial[],
  input: { branchId: string; lines: ItemQty[]; note?: string },
): StockPlan {
  const ws = workspace(rows, items);
  const entries: [string, number, number][] = [];
  for (const [itemId, qty] of foldLines(input.lines)) {
    entries.push([itemId, -qty, ws.takeOut(input.branchId, itemId, qty)]);
  }
  return { rows: ws.changed, moves: [moveOf('wastage', input.branchId, entries, input.note ? { note: input.note } : {})] };
}

/** Day-end count: the counted figure becomes the stock; the difference is a gain or loss at average cost. */
export function planCount(
  rows: StockRows,
  items: RawMaterial[],
  input: { branchId: string; counted: Record<string, number>; note?: string },
): StockPlan {
  const ws = workspace(rows, items);
  const entries: [string, number, number][] = [];
  const counted: Record<string, number> = {};
  for (const [itemId, value] of Object.entries(input.counted)) {
    if (!Number.isFinite(value) || value < 0) throw new Error('Enter a valid counted quantity.');
    counted[itemId] = roundQty(value);
    const row = ws.read(input.branchId, itemId);
    const diff = roundQty(value - row.qty);
    if (diff === 0) continue;
    ws.changed[stockRowId(input.branchId, itemId)] = { ...row, qty: roundQty(value) };
    entries.push([itemId, diff, row.avgCost]);
  }
  if (!Object.keys(counted).length) throw new Error('Enter at least one counted quantity.');
  return {
    rows: ws.changed,
    moves: [moveOf('adjust', input.branchId, entries, { counted, ...(input.note ? { note: input.note } : {}) })],
  };
}

/* ------------------------------------------------------------------ */
/* Sale lines                                                          */
/* ------------------------------------------------------------------ */

type LinkedProduct = { id: string; stockItemId?: string; portionQty?: number };

/**
 * Stock a bill takes: finished items one each, gram items portion × qty. Burgers never touch raw
 * materials here; raw left the stock when they were assembled or made.
 */
export function saleStockLines(lines: { productId?: string; qty: number }[], products: LinkedProduct[]): ItemQty[] {
  const out: ItemQty[] = [];
  for (const line of lines) {
    const product = products.find((p) => p.id === line.productId);
    if (!product?.stockItemId) continue;
    out.push({ itemId: product.stockItemId, qty: roundQty(line.qty * (product.portionQty && product.portionQty > 0 ? product.portionQty : 1)) });
  }
  return out;
}

/** Cost of one sold unit of a product: the item's average cost × its portion. */
export function productUnitCost(product: LinkedProduct, unitCostByItem: Record<string, number>) {
  if (!product.stockItemId) return undefined;
  return roundMoney((unitCostByItem[product.stockItemId] ?? 0) * (product.portionQty && product.portionQty > 0 ? product.portionQty : 1));
}

/* ------------------------------------------------------------------ */
/* Starter list for a burger shop (owner edits everything afterwards)  */
/* ------------------------------------------------------------------ */

export type SeedItem = { name: string; kind: ItemKind; unit: 'pcs' | 'g'; recipe?: string[] };

/** App seed: Mr Chef buy-list only (12 items). Owner adds finished recipes later. */
export const BURGER_SHOP_SEED: SeedItem[] = MR_CHEF_MATERIALS.map((row) => ({
  name: row.name,
  kind: row.kind,
  unit: row.unit === 'g' ? 'g' : 'pcs',
}));

/** Engine / acceptance tests: buy list + the same finished recipes the app seeds. */
export const BURGER_SHOP_TEST_ITEMS: SeedItem[] = [
  ...BURGER_SHOP_SEED,
  ...MR_CHEF_RECIPES.map((row) => ({
    name: row.name,
    kind: row.kind,
    unit: (row.unit === 'g' ? 'g' : 'pcs') as 'pcs' | 'g',
    recipe: row.recipe,
  })),
];
