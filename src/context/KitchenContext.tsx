import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { useBooks } from './BooksContext';
import { kitchenRepo, type MaterialInput, type NewMove } from '../data/kitchenRepo';
import { EMPTY_KITCHEN, type Branch, type BranchScope, type KitchenData, type MaterialQty } from '../data/kitchenTypes';
import { RAW_MATERIAL_CATALOG } from '../data/rawMaterialCatalog';
import { ALL_BRANCHES, type Books, type SaleLine } from '../data/types';
import { scopeBooks } from '../lib/branchScope';
import { linesCost, nextAvgCost, readyMaterialFor, roundMoney, roundQty, saleUsage, stockLevels, valueAt } from '../lib/kitchenOps';

export type PurchaseLine = { materialId: string; qty: number; unitCost: number };

type KitchenValue = {
  data: KitchenData;
  loading: boolean;
  error: string | null;
  /** What the stock screens and reports show: one branch or 'all'. */
  scope: BranchScope;
  setScope: (scope: BranchScope) => void;
  /** The branch new sales, expenses and stock entries go to. */
  activeBranchId: string | null;
  /** Staff tied to one branch: the switcher is gone and everything shows that branch. */
  branchLocked: boolean;
  /** The branches this login may look at and pick from. */
  visibleBranches: Branch[];
  /** More than one branch, and looking at them all added up (no single branch to close). */
  viewAll: boolean;
  addBranch: (name: string) => Promise<string>;
  renameBranch: (id: string, name: string) => Promise<void>;
  saveMaterial: (id: string | null, input: MaterialInput) => Promise<string>;
  /** Adds missing items from the standard raw-materials catalog. Returns how many were added. */
  seedCatalog: (category?: string) => Promise<number>;
  deleteMaterial: (id: string) => Promise<void>;
  saveRecipe: (productId: string, lines: MaterialQty[]) => Promise<void>;
  deleteRecipe: (productId: string) => Promise<void>;
  /** Returns the purchase total (Rs) so the UI can optionally post an expense. */
  purchase: (
    branchId: string,
    lines: PurchaseLine[],
    supplier?: string,
    note?: string,
    expiry?: Record<string, string>,
  ) => Promise<number>;
  transfer: (fromId: string, toId: string, lines: MaterialQty[], note?: string) => Promise<void>;
  /** Legacy: produce into a prepared material by material id. Prefer produceFromRecipe. */
  produce: (branchId: string, outputId: string, qty: number, note?: string) => Promise<void>;
  /** Produce using a product recipe → fills kitchen-ready stock for that product. */
  produceFromRecipe: (branchId: string, productId: string, qty: number, note?: string) => Promise<void>;
  /** Move kitchen-ready qty into Products / Foods stock for the cashier. */
  transferToFoods: (branchId: string, productId: string, qty: number, note?: string) => Promise<void>;
  wastage: (branchId: string, lines: MaterialQty[], note?: string) => Promise<void>;
  stockCount: (branchId: string, counted: Record<string, number>, note?: string) => Promise<void>;
  /** Called after a bill is saved: takes the recipe materials out of the branch's stock. */
  recordSale: (items: SaleLine[], at?: number) => Promise<void>;
  deleteMove: (id: string) => Promise<void>;
};

const KitchenContext = createContext<KitchenValue | null>(null);
const SCOPE_KEY = 'kb_branch_scope';

function assertLines<T extends { qty: number }>(lines: T[]): T[] {
  const good = lines.filter((l) => Number.isFinite(l.qty) && l.qty > 0);
  if (!good.length) throw new Error('Add at least one item with a quantity.');
  return good;
}

export function KitchenProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { books, updateProduct, logAudit, setDayBranch } = useBooks();
  // updateProduct used when a recipe is saved so the product becomes Menu / Food.
  const uid = user?.uid;
  const [data, setData] = useState<KitchenData>(EMPTY_KITCHEN);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScopeState] = useState<BranchScope>('all');

  useEffect(() => {
    if (!uid) {
      setData(EMPTY_KITCHEN);
      return;
    }
    setLoading(true);
    const unsub = kitchenRepo.watch(
      uid,
      (next) => {
        setData(next);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      },
    );
    AsyncStorage.getItem(SCOPE_KEY)
      .then((saved) => saved && setScopeState(saved))
      .catch(() => undefined);
    return unsub;
  }, [uid]);

  const memberBranch = user?.branchId && user.branchId !== ALL_BRANCHES ? user.branchId : null;
  const lockedBranchId = memberBranch && data.branches.some((b) => b.id === memberBranch) ? memberBranch : null;

  const setScope = useCallback((next: BranchScope) => {
    if (memberBranch) return;
    setScopeState(next);
    AsyncStorage.setItem(SCOPE_KEY, next).catch(() => undefined);
  }, [memberBranch]);

  const mainId = data.branches.find((b) => b.isMain)?.id ?? data.branches[0]?.id ?? null;
  const scopeValid = scope === 'all' || data.branches.some((b) => b.id === scope);
  const activeBranchId = lockedBranchId ?? (scopeValid && scope !== 'all' ? scope : mainId);

  // Opening, close and new entries in BooksContext follow the branch chosen here.
  useEffect(() => {
    const name = data.branches.find((b) => b.id === activeBranchId)?.name;
    setDayBranch(activeBranchId ? { id: activeBranchId, isMain: activeBranchId === mainId, name } : null);
  }, [activeBranchId, mainId, data.branches, setDayBranch]);

  const value = useMemo<KitchenValue>(() => {
    const need = () => {
      if (!uid) throw new Error('Sign in first.');
      return uid;
    };
    const shownScope: BranchScope = lockedBranchId ?? (scopeValid ? scope : 'all');
    const material = (id: string) => {
      const found = data.materials.find((m) => m.id === id);
      if (!found) throw new Error('That material no longer exists.');
      return found;
    };
    const stockAll = stockLevels(data, 'all');
    const branchName = (id: string) => data.branches.find((b) => b.id === id)?.name ?? id;
    const describe = (qty: Record<string, number>) =>
      Object.entries(qty)
        .map(([id, q]) => { const m = data.materials.find((x) => x.id === id); return `${m?.name ?? id} ${roundQty(q)}${m?.unit ?? ''}`; })
        .join(', ');

    return {
      data,
      loading,
      error,
      scope: shownScope,
      setScope,
      activeBranchId,
      branchLocked: lockedBranchId !== null,
      visibleBranches: lockedBranchId ? data.branches.filter((b) => b.id === lockedBranchId) : data.branches,
      viewAll: data.branches.length > 1 && shownScope === 'all',

      async addBranch(name) {
        const clean = name.trim();
        if (!clean) throw new Error('Enter a branch name.');
        if (data.branches.some((b) => b.name.toLowerCase() === clean.toLowerCase())) {
          throw new Error('A branch with that name already exists.');
        }
        return kitchenRepo.addBranch(need(), { name: clean.slice(0, 40), isMain: data.branches.length === 0 });
      },
      async renameBranch(id, name) {
        if (!name.trim()) throw new Error('Enter a branch name.');
        await kitchenRepo.renameBranch(need(), id, name.slice(0, 40));
      },

      async saveMaterial(id, input) {
        if (!input.name.trim()) throw new Error('Enter the material name.');
        if (!Number.isFinite(input.avgCost) || input.avgCost < 0) throw new Error('Enter a valid cost.');
        if (!Number.isFinite(input.reorderLevel) || input.reorderLevel < 0) throw new Error('Enter a valid reorder level.');
        const dup = data.materials.find((m) => m.name.toLowerCase() === input.name.trim().toLowerCase() && m.id !== id);
        if (dup) throw new Error('A material with that name already exists.');
        if (id && input.inputs?.some((l) => l.materialId === id)) throw new Error('An item cannot be made from itself.');
        return kitchenRepo.saveMaterial(need(), id, {
          ...input,
          name: input.name.trim().slice(0, 60),
          category: input.category?.trim().slice(0, 40) || undefined,
        });
      },
      async seedCatalog(category) {
        const known = new Set(data.materials.map((m) => m.name.toLowerCase()));
        const rows = RAW_MATERIAL_CATALOG.filter(
          (item) => (!category || item.category === category) && !known.has(item.name.toLowerCase()),
        ).map((item) => ({
          name: item.name,
          unit: item.unit,
          avgCost: 0,
          reorderLevel: 0,
          category: item.category,
        }));
        if (!rows.length) return 0;
        const added = await kitchenRepo.addMaterials(need(), rows);
        logAudit('Materials catalog added', category ? `${added} from ${category}` : `${added} standard materials`);
        return added;
      },
      async deleteMaterial(id) {
        if (Math.abs(stockAll[id] ?? 0) > 0) throw new Error('This material still has stock. Use a stock count to set it to 0 first.');
        if (data.recipes.some((r) => r.lines.some((l) => l.materialId === id))) {
          throw new Error('A recipe still uses this material. Remove it from the recipe first.');
        }
        await kitchenRepo.deleteMaterial(need(), id);
        logAudit('Material deleted', data.materials.find((m) => m.id === id)?.name ?? id);
      },

      async saveRecipe(productId, lines) {
        const good = lines.filter((l) => l.materialId && l.qty > 0).map((l) => ({ materialId: l.materialId, qty: roundQty(l.qty) }));
        if (!good.length) throw new Error('Add at least one material to the recipe.');
        await kitchenRepo.saveRecipe(need(), productId, good);
        const product = books.products.find((p) => p.id === productId);
        const readyName = `${(product?.name ?? 'Item').trim().slice(0, 50)} (ready)`;
        const existing = readyMaterialFor(productId, data.materials);
        await kitchenRepo.saveMaterial(need(), existing?.id ?? null, {
          name: readyName,
          unit: 'pcs',
          avgCost: existing?.avgCost ?? 0,
          reorderLevel: existing?.reorderLevel ?? 0,
          category: 'Prepared / Ready',
          productId,
          inputs: good,
        });
        // Mark product as Menu / Food so Recipes + cashier treat it as kitchen food.
        if (product && product.sellKind !== 'menu') {
          try {
            await updateProduct(productId, {
              name: product.name,
              sellingPrice: product.sellingPrice,
              purchasePrice: product.purchasePrice,
              stock: product.stock,
              unit: product.unit || 'pcs',
              category: product.category || 'Food',
              barcode: product.barcode,
              reorderLevel: product.reorderLevel,
              batchNo: product.batchNo,
              expiry: product.expiry,
              sellKind: 'menu',
            });
          } catch {
            /* recipe already saved; sellKind update is best-effort */
          }
        }
        logAudit('Recipe saved', `${readyName}: ${describe(Object.fromEntries(good.map((l) => [l.materialId, l.qty])))}`);
      },
      async deleteRecipe(productId) {
        await kitchenRepo.deleteRecipe(need(), productId);
      },

      async purchase(branchId, lines, supplier, note, expiry) {
        const good = assertLines(lines);
        if (good.some((l) => !Number.isFinite(l.unitCost) || l.unitCost < 0)) throw new Error('Enter a valid unit cost.');
        // Same material twice in one purchase: fold the lines so the average is right.
        const folded = new Map<string, { qty: number; value: number }>();
        for (const l of good) {
          const row = folded.get(l.materialId) ?? { qty: 0, value: 0 };
          folded.set(l.materialId, { qty: row.qty + l.qty, value: row.value + l.qty * l.unitCost });
        }
        const qty: Record<string, number> = {};
        const cost: Record<string, number> = {};
        const avg: Record<string, number> = {};
        for (const [id, row] of folded) {
          qty[id] = roundQty(row.qty);
          cost[id] = roundMoney(row.value);
          avg[id] = nextAvgCost(material(id), stockAll[id] ?? 0, row.qty, row.value / row.qty);
        }
        const cleanExpiry = expiry
          ? Object.fromEntries(
              Object.entries(expiry).filter(([id, day]) => qty[id] && /^\d{4}-\d{2}-\d{2}$/.test(day)),
            )
          : undefined;
        await kitchenRepo.addMoves(
          need(),
          [
            {
              type: 'purchase',
              branchId,
              qty,
              cost,
              supplier: supplier?.trim() || undefined,
              note: note?.trim() || undefined,
              ...(cleanExpiry && Object.keys(cleanExpiry).length ? { expiry: cleanExpiry } : {}),
            },
          ],
          avg,
        );
        const total = roundMoney(Object.values(cost).reduce((a, b) => a + b, 0));
        logAudit('Stock purchase', `${branchName(branchId)}: ${describe(qty)} · ${total}`);
        return total;
      },

      async transfer(fromId, toId, lines, note) {
        if (fromId === toId) throw new Error('Choose two different branches.');
        const good = assertLines(lines);
        const here = stockLevels(data, fromId);
        const out: Record<string, number> = {};
        for (const l of good) {
          const m = material(l.materialId);
          const left = here[l.materialId] ?? 0;
          if (l.qty > left + 1e-9) throw new Error(`Only ${roundQty(left)} ${m.unit} of ${m.name} at this branch.`);
          out[l.materialId] = roundQty((out[l.materialId] ?? 0) + l.qty);
        }
        const refId = `tr_${Date.now().toString(36)}`;
        const neg = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, -v]));
        // At average cost: the move is internal, so no profit is made on it.
        const moves: NewMove[] = [
          { type: 'transferOut', branchId: fromId, otherBranchId: toId, refId, qty: neg, cost: valueAt(neg, data.materials), note: note?.trim() || undefined },
          { type: 'transferIn', branchId: toId, otherBranchId: fromId, refId, qty: out, cost: valueAt(out, data.materials), note: note?.trim() || undefined },
        ];
        await kitchenRepo.addMoves(need(), moves);
        logAudit('Stock transfer', `${branchName(fromId)} → ${branchName(toId)}: ${describe(out)}`);
      },

      async produce(branchId, outputId, qty, note) {
        if (!Number.isFinite(qty) || qty <= 0) throw new Error('Enter how many were made.');
        const output = material(outputId);
        if (!output.inputs?.length) throw new Error(`Set what one ${output.name} is made from first.`);
        const here = stockLevels(data, branchId);
        const used: Record<string, number> = {};
        for (const part of output.inputs) {
          const m = material(part.materialId);
          const needQty = roundQty(part.qty * qty);
          if (needQty > (here[m.id] ?? 0) + 1e-9) throw new Error(`Not enough ${m.name}: need ${needQty} ${m.unit}, have ${roundQty(here[m.id] ?? 0)}.`);
          used[m.id] = -needQty;
        }
        const usedCost = valueAt(used, data.materials);
        const totalCost = -Object.values(usedCost).reduce((a, b) => a + b, 0);
        const unitCost = totalCost / qty;
        const refId = `pr_${Date.now().toString(36)}`;
        await kitchenRepo.addMoves(
          need(),
          [
            { type: 'productionOut', branchId, refId, qty: used, cost: usedCost, note: note?.trim() || undefined },
            { type: 'productionIn', branchId, refId, qty: { [outputId]: roundQty(qty) }, cost: { [outputId]: roundMoney(totalCost) }, note: note?.trim() || undefined },
          ],
          { [outputId]: nextAvgCost(output, stockAll[outputId] ?? 0, qty, unitCost) },
        );
      },

      async produceFromRecipe(branchId, productId, qty, note) {
        const recipe = data.recipes.find((r) => r.productId === productId);
        if (!recipe?.lines.length) throw new Error('Save a recipe for this food first.');
        let ready = readyMaterialFor(productId, data.materials);
        if (!ready?.inputs?.length) {
          const product = books.products.find((p) => p.id === productId);
          const readyName = `${(product?.name ?? 'Item').trim().slice(0, 50)} (ready)`;
          const readyId = await kitchenRepo.saveMaterial(need(), ready?.id ?? null, {
            name: readyName,
            unit: 'pcs',
            avgCost: ready?.avgCost ?? 0,
            reorderLevel: ready?.reorderLevel ?? 0,
            category: 'Prepared / Ready',
            productId,
            inputs: recipe.lines,
          });
          ready = {
            id: readyId,
            name: readyName,
            unit: 'pcs',
            avgCost: ready?.avgCost ?? 0,
            reorderLevel: 0,
            category: 'Prepared / Ready',
            productId,
            inputs: recipe.lines,
            createdAt: Date.now(),
          };
        } else if (JSON.stringify(ready.inputs) !== JSON.stringify(recipe.lines)) {
          await kitchenRepo.saveMaterial(need(), ready.id, {
            name: ready.name,
            unit: ready.unit,
            avgCost: ready.avgCost,
            reorderLevel: ready.reorderLevel,
            category: ready.category,
            productId,
            inputs: recipe.lines,
          });
          ready = { ...ready, inputs: recipe.lines };
        }
        await (async () => {
          if (!Number.isFinite(qty) || qty <= 0) throw new Error('Enter how many were made.');
          const output = ready!;
          const here = stockLevels(data, branchId);
          const used: Record<string, number> = {};
          for (const part of output.inputs!) {
            const m = material(part.materialId);
            const needQty = roundQty(part.qty * qty);
            if (needQty > (here[m.id] ?? 0) + 1e-9) {
              throw new Error(`Not enough ${m.name}: need ${needQty} ${m.unit}, have ${roundQty(here[m.id] ?? 0)}.`);
            }
            used[m.id] = -needQty;
          }
          const usedCost = valueAt(used, data.materials);
          const totalCost = -Object.values(usedCost).reduce((a, b) => a + b, 0);
          const unitCost = totalCost / qty;
          const refId = `pr_${Date.now().toString(36)}`;
          await kitchenRepo.addMoves(
            need(),
            [
              { type: 'productionOut', branchId, refId, qty: used, cost: usedCost, note: note?.trim() || undefined },
              {
                type: 'productionIn',
                branchId,
                refId,
                qty: { [output.id]: roundQty(qty) },
                cost: { [output.id]: roundMoney(totalCost) },
                note: note?.trim() || undefined,
              },
            ],
            { [output.id]: nextAvgCost(output, stockAll[output.id] ?? 0, qty, unitCost) },
          );
        })();
        logAudit('Produced', `${qty} × ${ready.name}`);
      },

      async transferToFoods(branchId, productId, qty, note) {
        if (!Number.isFinite(qty) || qty <= 0) throw new Error('Enter how many to send to Foods.');
        const product = books.products.find((p) => p.id === productId);
        if (!product) throw new Error('Add this food in Products first.');
        const ready = readyMaterialFor(productId, data.materials);
        if (!ready) throw new Error('Save a recipe and Produce first.');
        const here = stockLevels(data, branchId);
        const left = here[ready.id] ?? 0;
        if (qty > left + 1e-9) {
          throw new Error(`Only ${roundQty(left)} ${ready.unit} ready in kitchen. Produce more first.`);
        }
        const neg = { [ready.id]: -roundQty(qty) };
        await kitchenRepo.addMoves(need(), [
          {
            type: 'counterOut',
            branchId,
            qty: neg,
            cost: valueAt(neg, data.materials),
            note: note?.trim() || `To Foods · ${product.name}`,
          },
        ]);
        await updateProduct(productId, {
          name: product.name,
          sellingPrice: product.sellingPrice,
          purchasePrice: ready.avgCost > 0 ? ready.avgCost : product.purchasePrice,
          stock: roundQty(product.stock + qty),
          unit: product.unit || 'pcs',
          category: product.category || 'Food',
          barcode: product.barcode,
          reorderLevel: product.reorderLevel,
          batchNo: product.batchNo,
          expiry: product.expiry,
          sellKind: 'menu',
        });
        logAudit('To Foods', `${qty} × ${product.name} → cashier stock`);
      },

      async wastage(branchId, lines, note) {
        const good = assertLines(lines);
        const qty: Record<string, number> = {};
        for (const l of good) qty[l.materialId] = roundQty((qty[l.materialId] ?? 0) - l.qty);
        await kitchenRepo.addMoves(need(), [{ type: 'wastage', branchId, qty, cost: valueAt(qty, data.materials), note: note?.trim() || undefined }]);
        logAudit('Wastage', `${branchName(branchId)}: ${describe(qty)}${note ? ` (${note.trim()})` : ''}`);
      },

      async stockCount(branchId, counted, note) {
        const entries = Object.entries(counted).filter(([, v]) => Number.isFinite(v) && v >= 0);
        if (!entries.length) throw new Error('Enter at least one counted quantity.');
        const book = stockLevels(data, branchId);
        const qty: Record<string, number> = {};
        const keep: Record<string, number> = {};
        for (const [id, value] of entries) {
          keep[id] = roundQty(value);
          const diff = roundQty(value - (book[id] ?? 0));
          if (diff !== 0) qty[id] = diff;
        }
        await kitchenRepo.addMoves(need(), [{ type: 'adjust', branchId, qty, cost: valueAt(qty, data.materials), counted: keep, note: note?.trim() || undefined }]);
        logAudit('Stock count', `${branchName(branchId)}: ${Object.keys(qty).length ? `differences ${describe(qty)}` : 'matched the book'}`);
      },

      async recordSale(items, at = Date.now()) {
        if (!uid || !activeBranchId) return;
        // Produce → To Foods already took materials; only deduct recipe on sale for
        // menu items that were never set up with kitchen-ready stock.
        const madeToOrder = items.filter((line) => {
          if (!line.productId) return false;
          return !readyMaterialFor(line.productId, data.materials);
        });
        if (!madeToOrder.length) return;
        const usage = saleUsage(madeToOrder, data.recipes);
        if (!Object.keys(usage).length) return;
        const qty = Object.fromEntries(Object.entries(usage).map(([k, v]) => [k, -v]));
        await kitchenRepo.addSaleUsage(uid, activeBranchId, at, qty, valueAt(qty, data.materials));
      },

      async deleteMove(id) {
        if (id.startsWith('sale_')) throw new Error('Sales usage is removed by deleting or returning the bill.');
        const move = data.moves.find((m) => m.id === id);
        await kitchenRepo.deleteMove(need(), id);
        logAudit('Stock entry deleted', move ? `${move.type} at ${branchName(move.branchId)}: ${describe(move.qty)}` : id);
      },
    };
  }, [uid, data, loading, error, scope, scopeValid, setScope, activeBranchId, lockedBranchId, logAudit, books.products, updateProduct]);

  return <KitchenContext.Provider value={value}>{children}</KitchenContext.Provider>;
}

export function useKitchen() {
  const value = useContext(KitchenContext);
  if (!value) throw new Error('useKitchen must be used inside KitchenProvider');
  return value;
}

/**
 * The books for lists a login tied to one branch should only see their part of.
 * Everyone else gets the whole shop. Credit balances keep using useBooks: they are shop-wide.
 */
export function useVisibleBooks(): Books {
  const { books } = useBooks();
  const { branchLocked, scope, data } = useKitchen();
  return useMemo(
    () => (branchLocked ? scopeBooks(books, scope, data.branches) : books),
    [books, branchLocked, scope, data.branches],
  );
}

/** Cost and margin of one menu item from its recipe. */
export function itemCosting(sellingPrice: number, lines: MaterialQty[], data: KitchenData) {
  const cost = linesCost(lines, data.materials);
  const margin = roundMoney(sellingPrice - cost);
  return { cost, margin, marginPercent: sellingPrice > 0 ? Math.round((margin / sellingPrice) * 1000) / 10 : 0 };
}
