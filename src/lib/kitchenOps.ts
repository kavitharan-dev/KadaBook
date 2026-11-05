import type { Sale } from '../data/types';
import type { Branch, BranchScope, KitchenData, MoveType, RawMaterial, StockMove } from '../data/kitchenTypes';
import { itemKind, roundMoney, roundQty } from './stockEngine';

export { roundMoney, roundQty };

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

/** Current stock per item in the scope, from the stock rows. */
export function stockLevels(data: Pick<KitchenData, 'stock'>, scope: BranchScope): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of Object.values(data.stock)) {
    if (!inScope(row.branchId, scope)) continue;
    out[row.itemId] = roundQty((out[row.itemId] ?? 0) + row.qty);
  }
  return out;
}

/** Rupee value of the stock in the scope, each branch at its own average cost. */
export function stockValue(data: Pick<KitchenData, 'stock'>, scope: BranchScope) {
  return roundMoney(
    Object.values(data.stock)
      .filter((row) => inScope(row.branchId, scope))
      .reduce((sum, row) => sum + Math.max(0, row.qty) * row.avgCost, 0),
  );
}

export function isSellable(item: RawMaterial) {
  return itemKind(item) !== 'raw';
}

/* ------------------------------------------------------------------ */
/* Branch card and branch report                                       */
/* ------------------------------------------------------------------ */

const RECEIVED: MoveType[] = ['purchase', 'transferIn', 'assembleIn', 'productionIn'];
const SOLD: MoveType[] = ['sale', 'saleReturn'];
const USED: MoveType[] = ['transferOut', 'assembleOut', 'productionOut'];
const ADJUSTED: MoveType[] = ['adjust', 'wastage'];

/** Between branches a transfer is real; across the whole shop it is only moving stock around. */
function countsInScope(move: StockMove, scope: BranchScope) {
  return !(scope === 'all' && (move.type === 'transferIn' || move.type === 'transferOut'));
}

function periodMoves(data: KitchenData, scope: BranchScope, start: number, end: number) {
  return data.moves.filter(
    (m) => inScope(m.branchId, scope) && m.createdAt >= start && m.createdAt < end && countsInScope(m, scope),
  );
}

function sumMoves(moves: StockMove[], types: MoveType[], field: 'qty' | 'cost', itemId: string) {
  return moves.filter((m) => types.includes(m.type)).reduce((sum, m) => sum + (m[field][itemId] ?? 0), 0);
}

export type UnitTotals = Record<string, number>;
export type BranchCard = { received: UnitTotals; sold: UnitTotals; inStock: UnitTotals };

/** Home card: sellable items only, added up per unit so pieces and grams never mix. */
export function branchCard(data: KitchenData, scope: BranchScope, start: number, end: number): BranchCard {
  const moves = periodMoves(data, scope, start, end);
  const levels = stockLevels(data, scope);
  const card: BranchCard = { received: {}, sold: {}, inStock: {} };
  const add = (bucket: UnitTotals, unit: string, qty: number) => {
    if (qty !== 0) bucket[unit] = roundQty((bucket[unit] ?? 0) + qty);
  };
  for (const item of data.materials.filter(isSellable)) {
    add(card.received, item.unit, sumMoves(moves, RECEIVED, 'qty', item.id));
    add(card.sold, item.unit, -sumMoves(moves, SOLD, 'qty', item.id));
    add(card.inStock, item.unit, levels[item.id] ?? 0);
  }
  return card;
}

export function formatUnitTotals(totals: UnitTotals) {
  const parts = Object.entries(totals).map(([unit, qty]) => formatQty(qty, unit));
  return parts.length ? parts.join(' · ') : '0';
}

export type BranchReportRow = {
  item: RawMaterial;
  received: number;
  sold: number;
  /** Sent to another branch, or used to assemble or make something. */
  usedOrSent: number;
  /** Counted against the book, plus wastage: negative is a loss. */
  adjustQty: number;
  adjustValue: number;
  remaining: number;
};

export type BranchReport = {
  rows: BranchReportRow[];
  adjustValue: number;
  sales: number;
  cost: number;
  grossProfit: number;
};

export function branchReport(data: KitchenData, sales: Sale[], scope: BranchScope, start: number, end: number): BranchReport {
  const moves = periodMoves(data, scope, start, end);
  const levels = stockLevels(data, scope);
  const rows = data.materials
    .map((item): BranchReportRow => ({
      item,
      received: roundQty(sumMoves(moves, RECEIVED, 'qty', item.id)),
      sold: roundQty(-sumMoves(moves, SOLD, 'qty', item.id)),
      usedOrSent: roundQty(-sumMoves(moves, USED, 'qty', item.id)),
      adjustQty: roundQty(sumMoves(moves, ADJUSTED, 'qty', item.id)),
      adjustValue: roundMoney(sumMoves(moves, ADJUSTED, 'cost', item.id)),
      remaining: levels[item.id] ?? 0,
    }))
    .filter((r) => r.received || r.sold || r.usedOrSent || r.adjustQty || r.remaining);
  const period = sales.filter(
    (s) => inScope(saleBranch(s, data.branches), scope) && s.createdAt >= start && s.createdAt < end,
  );
  const salesTotal = period.reduce((sum, s) => sum + s.amount, 0);
  // The cost frozen on each bill line, so this never moves when average costs change later.
  const cost = roundMoney(
    period.reduce((sum, s) => sum + (s.items ?? []).reduce((lines, l) => lines + (l.unitCost ?? 0) * l.qty, 0), 0),
  );
  return {
    rows,
    adjustValue: roundMoney(rows.reduce((sum, r) => sum + r.adjustValue, 0)),
    sales: salesTotal,
    cost,
    grossProfit: roundMoney(salesTotal - cost),
  };
}
