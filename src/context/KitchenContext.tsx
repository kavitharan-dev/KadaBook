import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { useBooks } from './BooksContext';
import { kitchenRepo, type MaterialInput, type StampCollection } from '../data/kitchenRepo';
import { EMPTY_KITCHEN, type Branch, type BranchScope, type KitchenData, type MaterialQty } from '../data/kitchenTypes';
import { RAW_MATERIAL_CATALOG } from '../data/rawMaterialCatalog';
import { repository } from '../data/services';
import { ALL_BRANCHES, type Books } from '../data/types';
import { scopeBooks } from '../lib/branchScope';
import { formatQty, roundMoney, stockLevels } from '../lib/kitchenOps';
import { MR_CHEF_MATERIALS, MR_CHEF_PRODUCTS, MR_CHEF_PRODUCT_STOCK_LINKS, MR_CHEF_RECIPES } from '../lib/mrChefCatalog';
import { usesKitchenStock } from '../lib/shopType';
import {
  planCount,
  planMake,
  planPurchase,
  planSend,
  planWastage,
  stockRowId,
  type ItemQty,
} from '../lib/stockEngine';

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
  /** Item id → quantity at one branch. */
  stockAt: (branchId: string) => Record<string, number>;
  addBranch: (name: string) => Promise<string>;
  renameBranch: (id: string, name: string) => Promise<void>;
  deleteBranch: (id: string) => Promise<void>;
  saveMaterial: (id: string | null, input: MaterialInput) => Promise<string>;
  /** Adds missing items from the standard raw-materials catalog. Returns how many were added. */
  seedCatalog: (category?: string) => Promise<number>;
  /**
   * Kitchen shops only: delete old materials/products, then load Mr Chef buy-list (12)
   * and the full sell menu (food + drinks). Returns how many materials were written.
   */
  seedBurgerShop: () => Promise<number>;
  deleteMaterial: (id: string) => Promise<void>;
  /** Returns the purchase total (Rs) so the UI can optionally post an expense. */
  purchase: (
    branchId: string,
    lines: PurchaseLine[],
    supplier?: string,
    note?: string,
    expiry?: Record<string, string>,
  ) => Promise<number>;
  /** Branch to branch in one transaction, assembling finished items at the far end. */
  send: (fromId: string, toId: string, lines: ItemQty[], assemble: ItemQty[], note?: string) => Promise<void>;
  make: (branchId: string, finishedId: string, qty: number, note?: string) => Promise<void>;
  wastage: (branchId: string, lines: MaterialQty[], note?: string) => Promise<void>;
  stockCount: (branchId: string, counted: Record<string, number>, note?: string) => Promise<void>;
};

const KitchenContext = createContext<KitchenValue | null>(null);
const SCOPE_KEY = 'kb_branch_scope';

export function KitchenProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { books, loading: booksLoading, logAudit, setDayBranch } = useBooks();
  const uid = user?.uid;
  const isOwner = !!user && (user.role ?? 'owner') === 'owner';
  const memberBranch = user?.branchId && user.branchId !== ALL_BRANCHES ? user.branchId : null;
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
      memberBranch ?? undefined,
    );
    AsyncStorage.getItem(SCOPE_KEY)
      .then((saved) => saved && setScopeState(saved))
      .catch(() => undefined);
    return unsub;
  }, [uid, memberBranch]);

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

  // Owner's phone, one time: bring a shop from before per-branch stock into the new model.
  const backfilled = useRef<string | null>(null);
  useEffect(() => {
    if (!uid || !isOwner || loading || booksLoading || !mainId || backfilled.current === uid) return;
    backfilled.current = uid;
    (async () => {
      await kitchenRepo.backfillStock(uid, data.materials, books.products, mainId);
      await kitchenRepo.linkProducts(
        uid,
        data.materials
          .filter((m) => m.productId && books.products.some((p) => p.id === m.productId && !p.stockItemId))
          .map((m) => ({ productId: m.productId!, itemId: m.id })),
      );
    })().catch(() => {
      backfilled.current = null;
    });
  }, [uid, isOwner, loading, booksLoading, mainId, data.materials, books.products]);

  // Rows from before branches belong to the main branch. Staff queries need the field written.
  useEffect(() => {
    if (!uid || !isOwner || booksLoading || !mainId) return;
    const lists: [StampCollection, { id: string; branchId?: string }[]][] = [
      ['sales', books.sales],
      ['expenses', books.expenses],
      ['creditPayments', books.creditPayments],
      ['returns', books.returns],
      ['savedOrders', books.savedOrders],
    ];
    for (const [name, rows] of lists) {
      const ids = rows.filter((row) => !row.branchId).map((row) => row.id);
      if (ids.length) kitchenRepo.stampBranch(uid, name, ids, mainId).catch(() => undefined);
    }
  }, [uid, isOwner, booksLoading, mainId, books.sales, books.expenses, books.creditPayments, books.returns, books.savedOrders]);

  const value = useMemo<KitchenValue>(() => {
    const need = () => {
      if (!uid) throw new Error('Sign in first.');
      return uid;
    };
    const shownScope: BranchScope = lockedBranchId ?? (scopeValid ? scope : 'all');
    const branchName = (id: string) => data.branches.find((b) => b.id === id)?.name ?? id;
    const describe = (qty: Record<string, number>) =>
      Object.entries(qty)
        .map(([id, q]) => {
          const m = data.materials.find((x) => x.id === id);
          return formatQty(q, m?.unit ?? '') + ' ' + (m?.name ?? id);
        })
        .join(', ');
    const recipeOf = (id: string) => data.materials.find((m) => m.id === id)?.inputs ?? [];
    const refId = (prefix: string) => prefix + '_' + Date.now().toString(36);

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
      stockAt: (branchId) => stockLevels(data, branchId),

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
      async deleteBranch(id) {
        if (data.branches.length <= 1) throw new Error('Keep at least one branch.');
        if (!data.branches.some((b) => b.id === id)) throw new Error('Branch not found.');
        await kitchenRepo.deleteBranch(need(), id);
        if (scope === id) setScope('all');
      },

      async saveMaterial(id, input) {
        if (!input.name.trim()) throw new Error('Enter the item name.');
        if (!Number.isFinite(input.avgCost) || input.avgCost < 0) throw new Error('Enter a valid cost.');
        if (!Number.isFinite(input.reorderLevel) || input.reorderLevel < 0) throw new Error('Enter a valid reorder level.');
        const dup = data.materials.find((m) => m.name.toLowerCase() === input.name.trim().toLowerCase() && m.id !== id);
        if (dup) throw new Error('An item with that name already exists.');
        if (id && input.inputs?.some((l) => l.materialId === id)) throw new Error('An item cannot be made from itself.');
        const saved = await kitchenRepo.saveMaterial(need(), id, {
          ...input,
          name: input.name.trim().slice(0, 60),
          category: input.category?.trim().slice(0, 40) || undefined,
        });
        if (input.inputs?.length) logAudit('Recipe saved', input.name.trim() + ': ' + describe(Object.fromEntries(input.inputs.map((l) => [l.materialId, l.qty]))));
        return saved;
      },
      async seedCatalog(category) {
        const known = new Set(data.materials.map((m) => m.name.toLowerCase()));
        const rows = RAW_MATERIAL_CATALOG.filter(
          (item) => (!category || item.category === category) && !known.has(item.name.toLowerCase()),
        ).map((item) => ({
          name: item.name,
          unit: item.unit,
          kind: 'raw' as const,
          avgCost: 0,
          reorderLevel: 0,
          category: item.category,
        }));
        if (!rows.length) return 0;
        const added = await kitchenRepo.addMaterials(need(), rows);
        logAudit('Materials catalog added', category ? added + ' from ' + category : added + ' standard materials');
        return added;
      },
      async seedBurgerShop() {
        if (!usesKitchenStock(user?.shopType)) {
          throw new Error('Mr Chef kitchen list is only for kitchen / restaurant shops.');
        }
        const shopUid = need();
        try {
          // Wipe previous kitchen catalog and sell products for this shop only.
          for (const product of books.products) {
            try {
              await repository.deleteProduct(shopUid, product.id);
            } catch {
              /* keep going */
            }
          }
          await kitchenRepo.clearStockCatalog(shopUid);

          const idByName = new Map<string, string>();
          let added = 0;
          // Buy list first, then finished recipes (inputs need those ids).
          for (const seed of [...MR_CHEF_MATERIALS, ...MR_CHEF_RECIPES]) {
            const inputs =
              seed.recipe?.map((name) => ({
                materialId: idByName.get(name.toLowerCase()) ?? '',
                qty: 1,
              })).filter((line) => line.materialId) ?? [];
            const id = await kitchenRepo.saveMaterial(shopUid, null, {
              name: seed.name,
              unit: seed.unit,
              kind: seed.kind,
              avgCost: 0,
              reorderLevel: 0,
              ...(inputs.length ? { inputs } : {}),
            });
            idByName.set(seed.name.toLowerCase(), id);
            added += 1;
          }

          for (const product of MR_CHEF_PRODUCTS) {
            const materialName = MR_CHEF_PRODUCT_STOCK_LINKS[product.name];
            const stockItemId = materialName ? idByName.get(materialName.toLowerCase()) : undefined;
            await repository.addProduct(shopUid, stockItemId ? { ...product, stockItemId } : product);
          }

          logAudit(
            'Mr Chef kitchen loaded',
            `${MR_CHEF_MATERIALS.length} buy · ${MR_CHEF_RECIPES.length} recipes · ${MR_CHEF_PRODUCTS.length} products`,
          );
          return added;
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : String(caught);
          if (/permission|insufficient/i.test(message)) {
            throw new Error(
              'Could not load the list (Firestore permission). Owner login-la try pannunga, then reopen the app after rules update.',
            );
          }
          throw caught instanceof Error ? caught : new Error(message);
        }
      },
      async deleteMaterial(id) {
        if (Math.abs(stockLevels(data, 'all')[id] ?? 0) > 0) throw new Error('This item still has stock. Use a count to set it to 0 first.');
        if (data.materials.some((m) => m.inputs?.some((l) => l.materialId === id))) {
          throw new Error('A recipe still uses this item. Remove it from the recipe first.');
        }
        if (books.products.some((p) => p.stockItemId === id)) throw new Error('A product still sells this item. Unlink it in Products first.');
        await kitchenRepo.deleteMaterial(need(), id);
        logAudit('Item deleted', data.materials.find((m) => m.id === id)?.name ?? id);
      },

      async purchase(branchId, lines, supplier, note, expiry) {
        const cleanExpiry = expiry
          ? Object.fromEntries(Object.entries(expiry).filter(([, day]) => /^\d{4}-\d{2}-\d{2}$/.test(day)))
          : undefined;
        const plan = await kitchenRepo.applyStock(
          need(),
          lines.map((l) => stockRowId(branchId, l.materialId)),
          (rows) =>
            planPurchase(rows, data.materials, {
              branchId,
              lines: lines.map((l) => ({ itemId: l.materialId, qty: l.qty, unitCost: l.unitCost })),
              supplier: supplier?.trim() || undefined,
              note: note?.trim() || undefined,
              expiry: cleanExpiry,
            }),
        );
        const move = plan.moves[0];
        const total = roundMoney(Object.values(move.cost).reduce((a, b) => a + b, 0));
        logAudit('Stock purchase', branchName(branchId) + ': ' + describe(move.qty) + ' · ' + total);
        return total;
      },

      async send(fromId, toId, lines, assemble, note) {
        const ids = [
          ...lines.flatMap((l) => [stockRowId(fromId, l.itemId), stockRowId(toId, l.itemId)]),
          ...assemble.flatMap((run) => [
            stockRowId(toId, run.itemId),
            ...recipeOf(run.itemId).map((part) => stockRowId(toId, part.materialId)),
          ]),
        ];
        const ref = refId('tr');
        await kitchenRepo.applyStock(need(), ids, (rows) =>
          planSend(rows, data.materials, { fromId, toId, lines, assemble, refId: ref, note: note?.trim() || undefined }),
        );
        const made = assemble.filter((run) => run.qty > 0);
        logAudit(
          'Stock sent',
          branchName(fromId) + ' → ' + branchName(toId) + ': ' + describe(Object.fromEntries(lines.map((l) => [l.itemId, l.qty]))) +
            (made.length ? '. Made ' + describe(Object.fromEntries(made.map((run) => [run.itemId, run.qty]))) : ''),
        );
      },

      async make(branchId, finishedId, qty, note) {
        const ids = [stockRowId(branchId, finishedId), ...recipeOf(finishedId).map((part) => stockRowId(branchId, part.materialId))];
        const ref = refId('mk');
        await kitchenRepo.applyStock(need(), ids, (rows) =>
          planMake(rows, data.materials, { branchId, finishedId, qty, refId: ref, note: note?.trim() || undefined }),
        );
        logAudit('Made', branchName(branchId) + ': ' + describe({ [finishedId]: qty }));
      },

      async wastage(branchId, lines, note) {
        const items = lines.map((l) => ({ itemId: l.materialId, qty: l.qty }));
        const plan = await kitchenRepo.applyStock(
          need(),
          items.map((l) => stockRowId(branchId, l.itemId)),
          (rows) => planWastage(rows, data.materials, { branchId, lines: items, note: note?.trim() || undefined }),
        );
        logAudit('Wastage', branchName(branchId) + ': ' + describe(plan.moves[0].qty) + (note ? ' (' + note.trim() + ')' : ''));
      },

      async stockCount(branchId, counted, note) {
        const plan = await kitchenRepo.applyStock(
          need(),
          Object.keys(counted).map((id) => stockRowId(branchId, id)),
          (rows) => planCount(rows, data.materials, { branchId, counted, note: note?.trim() || undefined }),
        );
        const diff = plan.moves[0].qty;
        logAudit('Stock count', branchName(branchId) + ': ' + (Object.keys(diff).length ? 'differences ' + describe(diff) : 'matched the book'));
      },
    };
  }, [uid, data, loading, error, scope, scopeValid, setScope, activeBranchId, lockedBranchId, logAudit, books.products]);

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
