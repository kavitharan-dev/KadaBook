/**
 * Kitchen and Stock: raw materials, recipes, branches and one stock-movement ledger.
 * Stock of a material at a branch = the sum of its movement quantities at that branch.
 */

export type MaterialUnit = 'g' | 'kg' | 'ml' | 'l' | 'pcs';
export const MATERIAL_UNITS: MaterialUnit[] = ['pcs', 'g', 'kg', 'ml', 'l'];

export type Branch = {
  id: string;
  name: string;
  isMain: boolean;
  createdAt: number;
};

/** One ingredient line: how much of a material. */
export type MaterialQty = { materialId: string; qty: number };

export type RawMaterial = {
  id: string;
  name: string;
  unit: MaterialUnit;
  /** Weighted average cost of one unit, in rupees. Updated on every purchase and production. */
  avgCost: number;
  reorderLevel: number;
  /** A prepared item (e.g. "Burger (ready)") lists what one unit of it is made from. */
  inputs?: MaterialQty[];
  createdAt: number;
};

/** A menu item (a product on the New Sale screen) and the materials one of it uses. */
export type Recipe = {
  productId: string;
  lines: MaterialQty[];
  updatedAt: number;
};

export type MoveType =
  | 'purchase'
  | 'sale'
  | 'transferOut'
  | 'transferIn'
  | 'productionIn'
  | 'productionOut'
  | 'wastage'
  | 'adjust';

export const MOVE_LABEL: Record<MoveType, string> = {
  purchase: 'Purchase',
  sale: 'Sales usage',
  transferOut: 'Transfer out',
  transferIn: 'Transfer in',
  productionIn: 'Produced',
  productionOut: 'Used in production',
  wastage: 'Wastage',
  adjust: 'Stock count',
};

/**
 * One event at one branch. `qty` is signed per material (+ in, − out); `cost` is the
 * rupee value of the same quantities. Sales usage is one document per branch per day.
 */
export type StockMove = {
  id: string;
  type: MoveType;
  branchId: string;
  qty: Record<string, number>;
  cost: Record<string, number>;
  /** Stock count only: what was physically counted. */
  counted?: Record<string, number>;
  /** Links the two halves of a transfer, or the two sides of a production run. */
  refId?: string;
  /** Other branch of a transfer. */
  otherBranchId?: string;
  supplier?: string;
  note?: string;
  createdAt: number;
};

export type KitchenData = {
  branches: Branch[];
  materials: RawMaterial[];
  recipes: Recipe[];
  moves: StockMove[];
};

export const EMPTY_KITCHEN: KitchenData = { branches: [], materials: [], recipes: [], moves: [] };

/** 'all' shows every branch together in reports and stock. */
export type BranchScope = string | 'all';
