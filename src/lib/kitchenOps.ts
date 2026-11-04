import type { Sale, SaleLine } from '../data/types';
import type {
  Branch,
  BranchScope,
  KitchenData,
  MaterialQty,
  MoveType,
  RawMaterial,
  Recipe,
  StockMove,
} from '../data/kitchenTypes';

/** Keeps quantities tidy: 3 decimals is plenty for g / ml / pcs. */
export function roundQty(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatQty(value: number, unit: string) {
  const v = roundQty(value);
  return `${v.toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${unit}`;
}

export function inScope(branchId: string, scope: BranchScope) {
  return scope === 'all' || branchId === scope;
}

/** The branch a sale belongs to. Sales from before branches existed count as the main branch. */
export function saleBranch(sale: Sale, branches: Branch[]) {
  return sale.branchId ?? branches.find((b) => b.isMain)?.id ?? branches[0]?.id ?? '';
}

/** Current stock per material in the scope. */
export function stockLevels(data: KitchenData, scope: BranchScope, until = Infinity): Record<string, number> {
  const out: Record<string, number> = {};
  for (const move of data.moves) {
    if (!inScope(move.branchId, scope) || move.createdAt >= until) continue;
    for (const [materialId, qty] of Object.entries(move.qty)) {
      out[materialId] = roundQty((out[materialId] ?? 0) + qty);
    }
  }
  return out;
}

/**
 * Weighted average cost after receiving `qty` at `unitCost`:
 * (current stock × current average + qty × unit cost) / (current stock + qty).
 * Negative stock (sold before the purchase was entered) is treated as zero.
 */
export function nextAvgCost(material: RawMaterial, stockAllBranches: number, qty: number, unitCost: number) {
  const onHand = Math.max(0, stockAllBranches);
  const total = onHand + qty;
  if (total <= 0) return roundMoney(unitCost);
  return roundMoney((onHand * material.avgCost + qty * unitCost) / total);
}

/** Cost of one item from its ingredient lines at today's average costs. */
export function linesCost(lines: MaterialQty[], materials: RawMaterial[]) {
  return roundMoney(
    lines.reduce((sum, line) => {
      const material = materials.find((m) => m.id === line.materialId);
      return sum + (material ? material.avgCost * line.qty : 0);
    }, 0),
  );
}

export function recipeFor(productId: string | undefined, recipes: Recipe[]) {
  return productId ? recipes.find((r) => r.productId === productId) : undefined;
}

/** Kitchen-ready material linked to a sell product (Produce → Transfer to Foods). */
export function readyMaterialFor(productId: string | undefined, materials: RawMaterial[]) {
  return productId ? materials.find((m) => m.productId === productId) : undefined;
}

/** Materials a bill uses, from the recipes of its items. Items without a recipe use nothing. */
export function saleUsage(items: SaleLine[], recipes: Recipe[]): Record<string, number> {
  const usage: Record<string, number> = {};
  for (const line of items) {
    const recipe = recipeFor(line.productId, recipes);
    if (!recipe) continue;
    for (const part of recipe.lines) {
      usage[part.materialId] = roundQty((usage[part.materialId] ?? 0) + part.qty * line.qty);
    }
  }
  return usage;
}

/** Rupee value of quantities at average cost, with the same signs. */
export function valueAt(qty: Record<string, number>, materials: RawMaterial[]) {
  const out: Record<string, number> = {};
  for (const [materialId, q] of Object.entries(qty)) {
    const material = materials.find((m) => m.id === materialId);
    out[materialId] = roundMoney(q * (material?.avgCost ?? 0));
  }
  return out;
}

export function dayKeyOf(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export type VarianceRow = {
  material: RawMaterial;
  opening: number;
  purchases: number;
  transfersIn: number;
  transfersOut: number;
  produced: number;
  /** Sales × recipe, plus what production used. */
  expected: number;
  wastage: number;
  /** Physically counted at the latest stock count in the period, if any. */
  counted: number | null;
  /** opening + purchases + transfers in − transfers out + produced − counted closing. */
  actual: number | null;
  /** actual − expected − recorded wastage. Positive = more went than the recipes explain. */
  variance: number | null;
  varianceValue: number | null;
  closing: number;
};

function sumType(moves: StockMove[], types: MoveType[], materialId: string) {
  return roundQty(
    moves.filter((m) => types.includes(m.type)).reduce((sum, m) => sum + (m.qty[materialId] ?? 0), 0),
  );
}

/**
 * Expected usage (sales × recipe) against actual usage from the stock count.
 * The stock count's own adjustment is left out of "actual", because it is the answer we are checking.
 */
export function varianceReport(data: KitchenData, scope: BranchScope, start: number, end: number): VarianceRow[] {
  const period = data.moves.filter((m) => inScope(m.branchId, scope) && m.createdAt >= start && m.createdAt < end);
  const opening = stockLevels(data, scope, start);
  const closing = stockLevels(data, scope, end);
  const counts = period.filter((m) => m.type === 'adjust' && m.counted).sort((a, b) => b.createdAt - a.createdAt);

  return data.materials.map((material) => {
    const id = material.id;
    const open = opening[id] ?? 0;
    const purchases = sumType(period, ['purchase'], id);
    const transfersIn = sumType(period, ['transferIn'], id);
    const transfersOut = -sumType(period, ['transferOut'], id);
    const produced = sumType(period, ['productionIn'], id);
    const expected = -sumType(period, ['sale', 'productionOut'], id);
    const wastage = -sumType(period, ['wastage'], id);

    // Latest count per branch for this material; with "all branches" the counts are added up.
    const seen = new Set<string>();
    let counted: number | null = null;
    for (const move of counts) {
      if (move.counted?.[id] === undefined || seen.has(move.branchId)) continue;
      seen.add(move.branchId);
      counted = roundQty((counted ?? 0) + move.counted[id]);
    }
    const actual = counted === null ? null : roundQty(open + purchases + transfersIn - transfersOut + produced - counted);
    const variance = actual === null ? null : roundQty(actual - expected - wastage);
    return {
      material,
      opening: open,
      purchases,
      transfersIn,
      transfersOut,
      produced,
      expected,
      wastage,
      counted,
      actual,
      variance,
      varianceValue: variance === null ? null : roundMoney(variance * material.avgCost),
      closing: closing[id] ?? 0,
    };
  });
}

export type CogsSummary = {
  openingValue: number;
  purchasesValue: number;
  transfersInValue: number;
  transfersOutValue: number;
  closingValue: number;
  /** opening + purchases + transfers in − transfers out − closing. */
  cogs: number;
  sales: number;
  grossProfit: number;
  marginPercent: number;
};

/** COGS = opening stock + purchases − closing stock (per branch, transfers count as in/out at cost). */
export function cogsSummary(data: KitchenData, sales: Sale[], scope: BranchScope, start: number, end: number): CogsSummary {
  const value = (levels: Record<string, number>) =>
    Object.entries(levels).reduce((sum, [id, q]) => {
      const material = data.materials.find((m) => m.id === id);
      return sum + Math.max(0, q) * (material?.avgCost ?? 0);
    }, 0);
  const period = data.moves.filter((m) => inScope(m.branchId, scope) && m.createdAt >= start && m.createdAt < end);
  const costOf = (types: MoveType[]) =>
    period
      .filter((m) => types.includes(m.type))
      .reduce((sum, m) => sum + Object.values(m.cost).reduce((a, b) => a + b, 0), 0);

  const openingValue = roundMoney(value(stockLevels(data, scope, start)));
  const closingValue = roundMoney(value(stockLevels(data, scope, end)));
  const purchasesValue = roundMoney(costOf(['purchase']));
  // With all branches together, transfers cancel out.
  const transfersInValue = scope === 'all' ? 0 : roundMoney(costOf(['transferIn']));
  const transfersOutValue = scope === 'all' ? 0 : roundMoney(-costOf(['transferOut']));
  const cogs = roundMoney(openingValue + purchasesValue + transfersInValue - transfersOutValue - closingValue);
  const salesTotal = sales
    .filter((s) => inScope(saleBranch(s, data.branches), scope) && s.createdAt >= start && s.createdAt < end)
    .reduce((sum, s) => sum + s.amount, 0);
  const grossProfit = roundMoney(salesTotal - cogs);
  return {
    openingValue,
    purchasesValue,
    transfersInValue,
    transfersOutValue,
    closingValue,
    cogs,
    sales: salesTotal,
    grossProfit,
    marginPercent: salesTotal > 0 ? Math.round((grossProfit / salesTotal) * 1000) / 10 : 0,
  };
}

/** How much of each material went out to each branch (transfers), for "who got what". */
export function transferSummary(data: KitchenData, start: number, end: number) {
  const rows: { fromId: string; toId: string; materialId: string; qty: number; value: number }[] = [];
  for (const move of data.moves) {
    if (move.type !== 'transferOut' || move.createdAt < start || move.createdAt >= end) continue;
    for (const [materialId, q] of Object.entries(move.qty)) {
      const key = rows.find((r) => r.fromId === move.branchId && r.toId === move.otherBranchId && r.materialId === materialId);
      const value = -(move.cost[materialId] ?? 0);
      if (key) {
        key.qty = roundQty(key.qty - q);
        key.value = roundMoney(key.value + value);
      } else {
        rows.push({ fromId: move.branchId, toId: move.otherBranchId ?? '', materialId, qty: roundQty(-q), value: roundMoney(value) });
      }
    }
  }
  return rows;
}
