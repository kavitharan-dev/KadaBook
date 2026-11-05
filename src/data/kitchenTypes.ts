/**
 * Kitchen and Stock: stock items, recipes, branches, per-branch stock and one movement ledger.
 * Stock of an item at a branch lives in stock/{branchId}_{itemId}, changed in the same
 * transaction as its ledger movement (see lib/stockEngine.ts).
 */

/** raw = used in recipes; finished = sold, made from a recipe; direct = sold as it comes, no recipe. */
export type ItemKind = 'raw' | 'finished' | 'direct';

export const ITEM_KIND_LABEL: Record<ItemKind, string> = {
  raw: 'Ingredients',
  finished: 'Ready food',
  direct: 'By weight / pack',
};

/** One item at one branch. */
export type StockRow = {
  branchId: string;
  itemId: string;
  qty: number;
  /** Weighted average cost of one unit at this branch, in rupees. */
  avgCost: number;
};

export type MaterialUnit = 'g' | 'kg' | 'ml' | 'l' | 'pcs' | 'slices' | 'pair' | 'roll';
export const MATERIAL_UNITS: MaterialUnit[] = ['pcs', 'kg', 'g', 'l', 'ml', 'slices', 'pair', 'roll'];

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
  /** Missing on older rows: see itemKind() in lib/stockEngine.ts. */
  kind?: ItemKind;
  /** Cost when the item was set up. The live cost is per branch, on its stock row. */
  avgCost: number;
  reorderLevel: number;
  /** Group from the standard catalog (Meat, Bakery, Sauces…). */
  category?: string;
  /**
   * When set, this row is kitchen-ready stock for a sell product (not a raw buy item).
   * Created/synced from Recipes; Produce fills it; Transfer to Foods moves it to product.stock.
   */
  productId?: string;
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
  | 'assembleIn'
  | 'assembleOut'
  | 'saleReturn'
  | 'counterOut'
  | 'wastage'
  | 'adjust';

export const MOVE_LABEL: Record<MoveType, string> = {
  purchase: 'Purchase',
  sale: 'Sold',
  transferOut: 'Sent',
  transferIn: 'Received',
  productionIn: 'Made',
  productionOut: 'Used to make',
  assembleIn: 'Assembled',
  assembleOut: 'Used to assemble',
  saleReturn: 'Bill returned',
  counterOut: 'Sold / counter',
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
  /** Purchase only: expiry date per material (YYYY-MM-DD). */
  expiry?: Record<string, string>;
  note?: string;
  createdAt: number;
};

export type KitchenData = {
  branches: Branch[];
  materials: RawMaterial[];
  recipes: Recipe[];
  moves: StockMove[];
  /** Keyed by stockRowId(branchId, itemId). */
  stock: Record<string, StockRow>;
};

export const EMPTY_KITCHEN: KitchenData = { branches: [], materials: [], recipes: [], moves: [], stock: {} };

/** 'all' shows every branch together in reports and stock. */
export type BranchScope = string | 'all';
