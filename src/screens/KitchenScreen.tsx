import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialForm, MoveForm, RecipeForm, type MoveKind } from '../components/kitchen/KitchenForms';
import { MaterialCatalogSheet } from '../components/kitchen/MaterialCatalogSheet';
import { BranchChips, Chip, Input, Sheet } from '../components/kitchen/KitchenUi';
import { CATALOG_CATEGORIES } from '../data/rawMaterialCatalog';
import { Toast, useToast } from '../components/Toast';
import { FillButton, Header, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useBooks } from '../context/BooksContext';
import { itemCosting, useKitchen } from '../context/KitchenContext';
import { useTheme } from '../context/ThemeContext';
import { MOVE_LABEL, type RawMaterial, type StockMove } from '../data/kitchenTypes';
import type { Product, Supplier } from '../data/types';
import { formatDay, formatRs, formatTime, startOfDay } from '../lib/format';
import {
  cogsSummary,
  formatQty,
  readyMaterialFor,
  recipeFor,
  stockLevels,
  transferSummary,
  varianceReport,
} from '../lib/kitchenOps';
import { effectiveSellKind } from '../lib/productSell';
import { maybeNotifyKitchenLowStock } from '../lib/kitchenLowStockNotify';
import { shareKitchenReport } from '../lib/kitchenReportShare';
import { fonts } from '../theme/fonts';
import { useRole } from '../lib/roles';

type Tab = 'stock' | 'recipes' | 'moves' | 'suppliers' | 'reports';
type Period = 'today' | 'week' | 'month' | 'lastMonth';

function periodBounds(period: Period, now = Date.now()) {
  const today = startOfDay(now);
  const d = new Date(today);
  if (period === 'today') return { start: today, end: today + 86_400_000 };
  if (period === 'week') {
    const day = (d.getDay() + 6) % 7; // Monday first
    return { start: today - day * 86_400_000, end: today + 86_400_000 };
  }
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  if (period === 'month') return { start: monthStart, end: today + 86_400_000 };
  return { start: new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), end: monthStart };
}

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'stock', icon: '📦', label: 'Stock' },
  { key: 'recipes', icon: '🧾', label: 'Recipes' },
  { key: 'moves', icon: '↕️', label: 'Moves' },
  { key: 'suppliers', icon: '💳', label: 'Pay' },
  { key: 'reports', icon: '📊', label: 'Reports' },
];

const STOCK_ACTIONS: { kind: MoveKind; icon: string; label: string }[] = [
  { kind: 'purchase', icon: '🛒', label: 'Stock in' },
  { kind: 'wastage', icon: '🗑️', label: 'Wastage' },
  { kind: 'count', icon: '📋', label: 'Count' },
  { kind: 'transfer', icon: '🔀', label: 'Branch' },
];

const RECIPE_ACTIONS: { kind: MoveKind; icon: string; label: string }[] = [
  { kind: 'produce', icon: '👨‍🍳', label: 'Produce' },
  { kind: 'toFoods', icon: '🏪', label: 'To Foods' },
];

const CATEGORY_ICON: Record<string, string> = {
  'Meat & Protein': '🥩',
  'Bakery & Bread': '🍞',
  Vegetables: '🥬',
  'Dairy & Cheese': '🧀',
  Sauces: '🧴',
  Spices: '🌶️',
  Frozen: '❄️',
  Cooking: '🔥',
  Packaging: '📦',
  'Prepared / Ready': '🍔',
};

export function KitchenScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { books } = useBooks();
  const k = useKitchen();
  const { data, scope, setScope } = k;
  const toast = useToast();
  const { can } = useRole();
  const [tab, setTab] = useState<Tab>('stock');
  const [period, setPeriod] = useState<Period>('month');
  const [move, setMove] = useState<MoveKind | null>(null);
  const [moveProductId, setMoveProductId] = useState<string | null>(null);
  const [editMaterial, setEditMaterial] = useState<RawMaterial | null | 'new'>(null);
  const [recipeProduct, setRecipeProduct] = useState<Product | null>(null);
  const [branchName, setBranchName] = useState('');
  const [addingBranch, setAddingBranch] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | 'all'>('all');
  const [supplierSheet, setSupplierSheet] = useState<'new' | Supplier | null>(null);

  const stock = useMemo(() => stockLevels(data, scope), [data, scope]);
  const rawMaterials = useMemo(() => data.materials.filter((m) => !m.productId), [data.materials]);
  const stockValue = rawMaterials.reduce((sum, m) => sum + Math.max(0, stock[m.id] ?? 0) * m.avgCost, 0);
  const low = rawMaterials.filter((m) => m.reorderLevel > 0 && (stock[m.id] ?? 0) <= m.reorderLevel);

  useEffect(() => {
    if (k.loading || data.branches.length === 0) return;
    void maybeNotifyKitchenLowStock(rawMaterials, stock);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k.loading, rawMaterials.length, low.length]);
  const categories = useMemo(() => {
    const fromData = rawMaterials.map((m) => m.category).filter((c): c is string => !!c);
    return Array.from(new Set([...CATALOG_CATEGORIES, ...fromData]));
  }, [rawMaterials]);
  const visibleMaterials = useMemo(
    () =>
      categoryFilter === 'all'
        ? rawMaterials
        : rawMaterials.filter((m) => (m.category ?? '') === categoryFilter),
    [rawMaterials, categoryFilter],
  );
  // Only Kitchen food (Menu) products — Simple sell (Coke/bottle) stays out of Recipes.
  const foodProducts = useMemo(
    () =>
      books.products
        .filter((p) => effectiveSellKind(p, data.recipes) === 'menu')
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [books.products, data.recipes],
  );
  const branchName_ = (id?: string) => data.branches.find((b) => b.id === id)?.name ?? '—';

  const openMove = (kind: MoveKind, productId?: string) => {
    setMoveProductId(productId ?? null);
    setMove(kind);
  };

  const done = (message: string) => {
    setMove(null);
    setMoveProductId(null);
    setEditMaterial(null);
    setRecipeProduct(null);
    toast.show('success', message);
  };

  async function createBranch() {
    try {
      const id = await k.addBranch(branchName);
      setBranchName('');
      setAddingBranch(false);
      setScope(id);
      toast.show('success', 'Branch added');
    } catch (caught) {
      toast.show('error', caught instanceof Error ? caught.message : 'Could not add the branch.');
    }
  }

  // First run: a shop needs a main branch before anything else.
  if (!k.loading && data.branches.length === 0) {
    return (
      <Screen>
        <Header title="Kitchen & Stock" onBack={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.body}>
          <View style={[styles.hero, { backgroundColor: colors.gradientTop }]}>
            <Text style={styles.heroIcon}>🍔</Text>
            <Text style={[styles.heroTitle, { color: colors.ink }]}>Kitchen & Stock</Text>
            <Text style={[styles.heroText, { color: colors.muted }]}>
              Stock in raw materials → save recipes → Produce → Transfer to Foods → sell at cashier.
            </Text>
          </View>
          {can('manageBranches') ? (
            <>
              <Text style={[styles.section, { color: colors.ink }]}>Start with your main branch</Text>
              <Input value={branchName} onChangeText={setBranchName} placeholder="e.g. Main kitchen – Colombo 6" />
              <FillButton label="Create main branch" onPress={createBranch} />
            </>
          ) : (
            <Empty text="Ask the shop owner to create the main branch first." />
          )}
        </ScrollView>
        <Toast toast={toast.toast} onHide={toast.hide} />
      </Screen>
    );
  }

  const recipeCount = data.recipes.length;
  const menuFoodCount = books.products.filter((p) => effectiveSellKind(p, data.recipes) === 'menu').length;
  const readyTotal = foodProducts.reduce((sum, p) => {
    const ready = readyMaterialFor(p.id, data.materials);
    return sum + (ready ? Math.max(0, stock[ready.id] ?? 0) : 0);
  }, 0);

  return (
    <Screen>
      <Header title="Kitchen & Stock" onBack={() => navigation.goBack()} />
      <View style={[styles.top, { backgroundColor: colors.canvas }]}>
        <BranchChips branches={data.branches} value={scope} onChange={setScope} onAdd={can('manageBranches') ? () => setAddingBranch(true) : undefined} />
        <View style={[styles.tabs, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
          {TABS.map((item) => {
            const on = tab === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setTab(item.key)}
                style={[styles.tab, on && { backgroundColor: '#E8F1FF' }]}
              >
                <Text style={styles.tabIcon}>{item.icon}</Text>
                <Text style={[styles.tabText, { color: on ? colors.brand : colors.muted }]} numberOfLines={1}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { backgroundColor: colors.canvas }]} style={{ backgroundColor: colors.canvas }}>
        {tab === 'stock' ? (
          <>
            <Text style={[styles.dashHeading, { color: colors.brand }]}>Summary</Text>
            <View style={styles.statGrid}>
              <DashStat icon="💰" label="STOCK VALUE" value={formatRs(stockValue)} color="#7C3AED" sub="Raw materials on hand" />
              <DashStat icon="⚠️" label="LOW STOCK" value={String(low.length)} color="#EF4444" sub={low.length ? 'Need reorder' : 'All ok'} />
              <DashStat icon="📦" label="RAW ITEMS" value={String(rawMaterials.length)} color="#0D9488" sub={scope === 'all' ? 'All branches' : branchName_(scope)} />
            </View>

            {low.length > 0 ? (
              <View style={[styles.alertBanner, { backgroundColor: colors.expenseWash, borderColor: colors.expenseText }]}>
                <Text style={[styles.alertTitle, { color: colors.expenseText }]}>Low stock · {low.length} item{low.length === 1 ? '' : 's'}</Text>
                <Text style={[styles.rowSub, { color: colors.expenseText }]} numberOfLines={2}>
                  {low
                    .slice(0, 4)
                    .map((m) => m.name)
                    .join(' · ')}
                  {low.length > 4 ? ` · +${low.length - 4}` : ''}
                </Text>
              </View>
            ) : null}

            <Text style={[styles.dashHeading, { color: colors.brand }]}>Quick links</Text>
            <View style={styles.quickGrid}>
              {STOCK_ACTIONS.map((a) => (
                <QuickLink key={a.kind} icon={a.icon} label={a.label} onPress={() => openMove(a.kind)} />
              ))}
              <QuickLink icon="📚" label="Catalog" onPress={() => setCatalogOpen(true)} />
              <QuickLink icon="➕" label="Add raw" onPress={() => setEditMaterial('new')} />
            </View>

            <Text style={[styles.dashHeading, { color: colors.brand }]}>
              Raw materials · {scope === 'all' ? 'all branches' : branchName_(scope)}
            </Text>
            {rawMaterials.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
                <Chip label="✨ All" on={categoryFilter === 'all'} onPress={() => setCategoryFilter('all')} />
                {categories.map((c) => (
                  <Chip
                    key={c}
                    label={`${CATEGORY_ICON[c] ?? '🏷️'} ${c}`}
                    on={categoryFilter === c}
                    onPress={() => setCategoryFilter(c)}
                  />
                ))}
              </ScrollView>
            ) : null}
            {rawMaterials.length === 0 ? (
              <Empty text="No raw materials yet. Tap Catalog for the burger list, or Add raw for one item." />
            ) : null}
            {visibleMaterials.map((m) => {
              const q = stock[m.id] ?? 0;
              const isLow = m.reorderLevel > 0 && q <= m.reorderLevel;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setEditMaterial(m)}
                  style={[styles.dashCard, { backgroundColor: colors.white, borderColor: isLow ? colors.expenseText : colors.hairline }]}
                >
                  <View style={[styles.dashCardAccent, { backgroundColor: isLow ? colors.expenseText : colors.brand }]} />
                  <View style={styles.flex}>
                    <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>
                      {m.name}
                    </Text>
                    <Text style={[styles.rowSub, { color: colors.muted }]}>
                      {m.category ? `${m.category} · ` : ''}
                      Avg Rs. {m.avgCost.toLocaleString('en-IN')}/{m.unit}
                      {m.reorderLevel ? ` · reorder below ${formatQty(m.reorderLevel, m.unit)}` : ''}
                    </Text>
                  </View>
                  <View style={styles.right}>
                    <Text style={[styles.rowValue, { color: isLow ? colors.expenseText : q < 0 ? colors.expenseText : colors.ink }]}>{formatQty(q, m.unit)}</Text>
                    <Text style={[styles.rowSub, { color: colors.muted }]}>{formatRs(Math.max(0, q) * m.avgCost)}</Text>
                    {isLow ? <Text style={[styles.badge, { backgroundColor: colors.expenseWash, color: colors.expenseText }]}>LOW</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </>
        ) : null}

        {tab === 'recipes' ? (
          <>
            <Text style={[styles.dashHeading, { color: colors.brand }]}>Summary</Text>
            <View style={styles.statGrid}>
              <DashStat icon="🧾" label="RECIPES" value={String(recipeCount)} color="#2563EB" sub="Food formulas saved" />
              <DashStat icon="👨‍🍳" label="KITCHEN READY" value={String(Math.round(readyTotal))} color="#0D9488" sub="Produced, not transferred" />
              <DashStat icon="🍔" label="MENU FOODS" value={String(menuFoodCount)} color="#7C3AED" sub="Products · Menu / Food" />
            </View>

            <Text style={[styles.dashHeading, { color: colors.brand }]}>Quick links</Text>
            <View style={styles.quickGrid}>
              {RECIPE_ACTIONS.map((a) => (
                <QuickLink key={a.kind} icon={a.icon} label={a.label} onPress={() => openMove(a.kind)} />
              ))}
            </View>

            <Text style={[styles.dashHeading, { color: colors.brand }]}>Food recipes</Text>
            <Text style={[styles.hint, { color: colors.muted }]}>
              Only Kitchen food from Products. Tap → set recipe → Produce → To Foods.
            </Text>
            {foodProducts.length === 0 ? (
              <Empty text="No kitchen food yet. In Products choose Kitchen food (not Simple sell), add Hot Dog / Burger, then open Recipes." />
            ) : null}
            {foodProducts.map((p) => {
              const recipe = recipeFor(p.id, data.recipes);
              const ready = readyMaterialFor(p.id, data.materials);
              const readyQty = ready ? stock[ready.id] ?? 0 : 0;
              const c = recipe ? itemCosting(p.sellingPrice, recipe.lines, data) : null;
              return (
                <View key={p.id} style={[styles.dashCard, { backgroundColor: colors.white, borderColor: colors.hairline, flexDirection: 'column', alignItems: 'stretch', gap: 8, paddingLeft: 14 }]}>
                  <View style={[styles.dashCardAccent, { backgroundColor: colors.brand }]} />
                  <Pressable onPress={() => setRecipeProduct(p)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.quickIconWrap, { marginRight: 10 }]}>
                      <Text style={{ fontSize: 24 }}>🍔</Text>
                    </View>
                    <View style={styles.flex}>
                      <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>{p.name}</Text>
                      <Text style={[styles.rowSub, { color: colors.muted }]}>
                        Kitchen food · Sells {formatRs(p.sellingPrice)}
                        {recipe ? ` · ${recipe.lines.length} ingredients` : ' · tap to add recipe'}
                        {` · stock ${p.stock}`}
                      </Text>
                      {ready ? (
                        <Text style={[styles.rowSub, { color: colors.brand }]}>
                          Kitchen ready {formatQty(readyQty, ready.unit)}
                        </Text>
                      ) : null}
                    </View>
                    {c ? (
                      <View style={styles.right}>
                        <Text style={[styles.rowValue, { color: colors.ink }]}>Cost {formatRs(c.cost)}</Text>
                        <Text style={[styles.rowSub, { color: c.margin >= 0 ? colors.saleText : colors.expenseText }]}>
                          {c.marginPercent}%
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.link, { color: colors.brand }]}>＋ Recipe</Text>
                    )}
                  </Pressable>
                  {recipe ? (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Pressable
                        onPress={() => openMove('produce', p.id)}
                        style={[styles.miniBtn, { borderColor: colors.brand, backgroundColor: '#E8F1FF' }]}
                      >
                        <Text style={[styles.miniBtnText, { color: colors.brand }]}>👨‍🍳 Produce</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => openMove('toFoods', p.id)}
                        style={[styles.miniBtn, { borderColor: colors.brand, backgroundColor: '#E8F1FF', opacity: readyQty > 0 ? 1 : 0.45 }]}
                      >
                        <Text style={[styles.miniBtnText, { color: colors.brand }]}>🏪 To Foods</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </>
        ) : null}

        {tab === 'moves' ? (
          <>
            <Text style={[styles.dashHeading, { color: colors.brand }]}>Stock movements</Text>
            {data.moves.filter((m) => scope === 'all' || m.branchId === scope).length === 0 ? <Empty text="No stock movements yet." /> : null}
            {data.moves
              .filter((m) => scope === 'all' || m.branchId === scope)
              .slice(0, 150)
              .map((mv) => (
                <MoveRow
                  key={mv.id}
                  move={mv}
                  materials={data.materials}
                  branch={branchName_(mv.branchId)}
                  other={mv.otherBranchId ? branchName_(mv.otherBranchId) : undefined}
                  onDelete={() =>
                    Alert.alert('Delete this entry?', 'Stock goes back to what it was before this entry.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () =>
                          k
                            .deleteMove(mv.id)
                            .then(() => toast.show('info', 'Entry deleted'))
                            .catch((e) => toast.show('error', e instanceof Error ? e.message : 'Could not delete.')),
                      },
                    ])
                  }
                />
              ))}
          </>
        ) : null}

        {tab === 'suppliers' ? (
          <>
            <Text style={[styles.dashHeading, { color: colors.brand }]}>Payables</Text>
            <View style={styles.quickGrid}>
              <QuickLink icon="➕" label="Add supplier" onPress={() => setSupplierSheet('new')} />
            </View>
            <SuppliersTab onAdd={() => setSupplierSheet('new')} onOpen={(s) => setSupplierSheet(s)} />
          </>
        ) : null}

        {tab === 'reports' ? (
          <>
            <Text style={[styles.dashHeading, { color: colors.brand }]}>Reports</Text>
            <Reports period={period} setPeriod={setPeriod} onToast={toast.show} />
          </>
        ) : null}
      </ScrollView>

      <MoveForm
        kind={move}
        prefillProductId={moveProductId}
        onClose={() => {
          setMove(null);
          setMoveProductId(null);
        }}
        onDone={done}
      />
      <MaterialForm
        visible={editMaterial !== null}
        material={editMaterial === 'new' ? null : editMaterial}
        onClose={() => setEditMaterial(null)}
        onDone={done}
      />
      <MaterialCatalogSheet visible={catalogOpen} onClose={() => setCatalogOpen(false)} onDone={done} />
      <RecipeForm visible={recipeProduct !== null} product={recipeProduct} onClose={() => setRecipeProduct(null)} onDone={done} />
      <SupplierSheet
        target={supplierSheet}
        onClose={() => setSupplierSheet(null)}
        onDone={(message) => {
          setSupplierSheet(null);
          toast.show('success', message);
        }}
      />
      <Sheet visible={addingBranch} title="New branch" onClose={() => setAddingBranch(false)} actionLabel="Add branch" onAction={createBranch}>
        <Input value={branchName} onChangeText={setBranchName} placeholder="e.g. Branch 2 – Wellawatte" autoFocus />
      </Sheet>
      <Toast toast={toast.toast} onHide={toast.hide} />
    </Screen>
  );
}

function DashStat({
  icon,
  label,
  value,
  color,
  sub,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
  sub: string;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: color }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statSub} numberOfLines={1}>
        {sub}
      </Text>
    </View>
  );
}

function QuickLink({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.quickCard, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
      <View style={styles.quickTopBar} />
      <View style={styles.quickIconWrap}>
        <Text style={styles.quickIcon}>{icon}</Text>
      </View>
      <Text style={[styles.quickLabel, { color: colors.ink }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

function Empty({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.emptyCard, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
      <Text style={[styles.empty, { color: colors.muted }]}>{text}</Text>
    </View>
  );
}

function MoveRow({ move, materials, branch, other, onDelete }: {
  move: StockMove;
  materials: RawMaterial[];
  branch: string;
  other?: string;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const parts = Object.entries(move.qty).map(([id, q]) => {
    const m = materials.find((x) => x.id === id);
    return `${m?.name ?? 'Deleted item'} ${q > 0 ? '+' : ''}${formatQty(q, m?.unit ?? '')}`;
  });
  const value = Object.values(move.cost).reduce((a, b) => a + b, 0);
  const inbound = value >= 0;
  const where = move.type === 'transferOut' ? `${branch} → ${other}` : move.type === 'transferIn' ? `${other} → ${branch}` : branch;
  return (
    <Pressable onLongPress={onDelete} style={[styles.row, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: colors.ink }]}>
          {MOVE_LABEL[move.type]}
          <Text style={[styles.rowSub, { color: colors.muted }]}>  · {where}</Text>
        </Text>
        <Text style={[styles.rowSub, { color: colors.muted }]} numberOfLines={3}>
          {parts.length ? parts.join(', ') : 'No change'}
        </Text>
        <Text style={[styles.rowSub, { color: colors.muted }]}>
          {move.type === 'sale' ? formatDay(move.createdAt) : `${formatDay(move.createdAt)} · ${formatTime(move.createdAt)}`}
          {move.supplier ? ` · ${move.supplier}` : ''}
          {move.note ? ` · ${move.note}` : ''}
        </Text>
        {move.expiry && Object.keys(move.expiry).length ? (
          <Text style={[styles.rowSub, { color: colors.muted }]} numberOfLines={2}>
            Expiry:{' '}
            {Object.entries(move.expiry)
              .map(([id, day]) => {
                const m = materials.find((x) => x.id === id);
                return `${m?.name ?? 'Item'} ${day}`;
              })
              .join(' · ')}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.rowValue, { color: inbound ? colors.saleText : colors.expenseText }]}>
        {inbound ? '+' : '−'}
        {formatRs(Math.abs(value))}
      </Text>
    </Pressable>
  );
}

function SuppliersTab({ onAdd, onOpen }: { onAdd: () => void; onOpen: (s: Supplier) => void }) {
  const { colors } = useTheme();
  const { books } = useBooks();
  const owed = books.suppliers.reduce((sum, s) => sum + (s.payable || 0), 0);
  return (
    <>
      <View style={styles.statGrid}>
        <DashStat icon="🤝" label="SUPPLIERS" value={String(books.suppliers.length)} color="#2563EB" sub="On your books" />
        <DashStat icon="💸" label="TOTAL OWED" value={formatRs(owed)} color="#EF4444" sub={owed ? 'Payables open' : 'All settled'} />
      </View>
      <Text style={[styles.hint, { color: colors.muted }]}>
        Mark a kitchen purchase as “on credit” to add here. Tap a supplier to record a payment.
      </Text>
      {books.suppliers.length === 0 ? <Empty text="No suppliers yet. Add one, or buy on credit from Purchase." /> : null}
      {books.suppliers
        .slice()
        .sort((a, b) => b.payable - a.payable || b.createdAt - a.createdAt)
        .map((s) => (
          <Pressable key={s.id} onPress={() => onOpen(s)} style={[styles.dashCard, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
            <View style={[styles.dashCardAccent, { backgroundColor: s.payable > 0 ? colors.expenseText : colors.brand }]} />
            <View style={styles.flex}>
              <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>{s.name}</Text>
              <Text style={[styles.rowSub, { color: colors.muted }]}>{s.phone ? s.phone : 'No phone'}</Text>
            </View>
            <View style={styles.right}>
              <Text style={[styles.rowValue, { color: s.payable > 0 ? colors.expenseText : colors.ink }]}>{formatRs(s.payable)}</Text>
              <Text style={[styles.rowSub, { color: colors.muted }]}>{s.payable > 0 ? 'owed' : 'settled'}</Text>
            </View>
          </Pressable>
        ))}
    </>
  );
}

function SupplierSheet({
  target,
  onClose,
  onDone,
}: {
  target: 'new' | Supplier | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { colors } = useTheme();
  const { addSupplier, paySupplier, addExpense } = useBooks();
  const isNew = target === 'new';
  const existing = target && target !== 'new' ? target : null;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [payable, setPayable] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [asExpense, setAsExpense] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setName(existing?.name ?? '');
    setPhone(existing?.phone ?? '');
    setPayable('');
    setPayAmount('');
    setAsExpense(true);
    setError(null);
  }, [target, existing?.id, existing?.name, existing?.phone]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (isNew) {
        await addSupplier({ name, phone, payable: Number(payable) || 0 });
        onDone(`Supplier ${name.trim()} added`);
        return;
      }
      if (!existing) return;
      const amount = Number(payAmount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter how much you paid.');
      await paySupplier(existing.id, amount);
      if (asExpense) {
        await addExpense(amount, 'Supplier Payment', {
          note: `Paid ${existing.name}`,
        });
      }
      onDone(`Paid ${formatRs(amount)} to ${existing.name}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      visible={!!target}
      title={isNew ? 'New supplier' : existing?.name ?? 'Supplier'}
      subtitle={isNew ? 'Track who you buy from and what you owe' : `Owed ${formatRs(existing?.payable ?? 0)}`}
      onClose={onClose}
      actionLabel={isNew ? 'Save supplier' : 'Record payment'}
      onAction={submit}
      busy={busy}
      error={error}
    >
      {isNew ? (
        <>
          <Input value={name} onChangeText={(v) => setName(v.slice(0, 60))} placeholder="Supplier name" autoFocus />
          <Input value={phone} onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 15))} placeholder="Phone (optional)" keyboardType="phone-pad" />
          <Input
            value={payable}
            onChangeText={(v) => setPayable(v.replace(/[^\d]/g, '').slice(0, 10))}
            placeholder="Starting balance owed (optional)"
            keyboardType="number-pad"
          />
        </>
      ) : (
        <>
          <Input
            value={payAmount}
            onChangeText={(v) => setPayAmount(v.replace(/[^\d]/g, '').slice(0, 10))}
            placeholder="Amount paid"
            keyboardType="number-pad"
            autoFocus
          />
          <Pressable onPress={() => setAsExpense((v) => !v)} style={[styles.toggle, { borderColor: asExpense ? colors.brand : colors.line }]}>
            <Text style={{ color: colors.brand, fontSize: 18 }}>{asExpense ? '☑' : '☐'}</Text>
            <View style={styles.flex}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>Also save as expense</Text>
              <Text style={[styles.hint, { color: colors.muted }]}>Posts under Expenses → Supplier Payment.</Text>
            </View>
          </Pressable>
        </>
      )}
    </Sheet>
  );
}

function Reports({
  period,
  setPeriod,
  onToast,
}: {
  period: Period;
  setPeriod: (p: Period) => void;
  onToast: (kind: 'success' | 'error' | 'info', text: string) => void;
}) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { books } = useBooks();
  const { data, scope } = useKitchen();
  const [sharing, setSharing] = useState(false);
  const { start, end } = periodBounds(period);
  const cogs = useMemo(() => cogsSummary(data, books.sales, scope, start, end), [data, books.sales, scope, start, end]);
  const variance = useMemo(() => varianceReport(data, scope, start, end), [data, scope, start, end]);
  const transfers = useMemo(() => transferSummary(data, start, end), [data, start, end]);
  const name = (id: string) => data.branches.find((b) => b.id === id)?.name ?? '—';
  const counted = variance.filter((v) => v.counted !== null);
  const totalVariance = counted.reduce((sum, v) => sum + (v.varianceValue ?? 0), 0);

  const line = (label: string, value: string, strong?: boolean, tone?: string) => (
    <View style={styles.repRow} key={label}>
      <Text style={[strong ? styles.repStrong : styles.repLabel, { color: tone ?? (strong ? colors.ink : colors.muted) }]}>{label}</Text>
      <Text style={[strong ? styles.repStrong : styles.repValue, { color: tone ?? colors.ink }]}>{value}</Text>
    </View>
  );

  async function share() {
    setSharing(true);
    try {
      const result = await shareKitchenReport({
        shopName: user?.shopName ?? 'KadaBook',
        data,
        sales: books.sales,
        scope,
        start,
        end,
      });
      if (!result.ok) onToast('error', result.message);
      else onToast('success', 'Report ready to share');
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      <View style={styles.periods}>
        {(
          [
            ['today', 'Today'],
            ['week', 'This week'],
            ['month', 'This month'],
            ['lastMonth', 'Last month'],
          ] as [Period, string][]
        ).map(([key, label]) => (
          <Chip key={key} label={label} on={period === key} onPress={() => setPeriod(key)} />
        ))}
      </View>
      <Text style={[styles.hint, { color: colors.muted }]}>
        {formatDay(start)} – {formatDay(end - 1)} · {scope === 'all' ? 'All branches' : name(scope)}
      </Text>
      <FillButton label={sharing ? 'Preparing…' : 'Share COGS / variance PDF'} onPress={share} busy={sharing} />

      <View style={[styles.card, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
        <Text style={[styles.cardTitle, { color: colors.ink }]}>Cost of goods sold</Text>
        {line('Opening stock', formatRs(cogs.openingValue))}
        {line('+ Purchases', formatRs(cogs.purchasesValue))}
        {scope !== 'all' ? line('+ Transfers in', formatRs(cogs.transfersInValue)) : null}
        {scope !== 'all' ? line('− Transfers out', formatRs(cogs.transfersOutValue)) : null}
        {line('− Closing stock', formatRs(cogs.closingValue))}
        <View style={[styles.divider, { borderColor: colors.line }]} />
        {line('COGS', formatRs(cogs.cogs), true)}
        {line('Sales', formatRs(cogs.sales))}
        {line(`Gross profit (${cogs.marginPercent}%)`, formatRs(cogs.grossProfit), true, cogs.grossProfit >= 0 ? colors.saleText : colors.expenseText)}
      </View>

      <View style={[styles.card, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
        <Text style={[styles.cardTitle, { color: colors.ink }]}>Variance (expected vs actual use)</Text>
        <Text style={[styles.hint, { color: colors.muted }]}>
          Expected = sales × recipe. Actual = opening + purchases + transfers in − transfers out − counted closing. The gap is wastage, theft or over-portioning. Needs a stock count in this period.
        </Text>
        {counted.length === 0 ? (
          <Empty text="No stock count in this period yet. Do a Stock count on the Stock tab." />
        ) : (
          <>
            <View style={[styles.vHead, { backgroundColor: colors.keypad }]}>
              <Text style={[styles.vCell, styles.vName, styles.vHeadText, { color: colors.ink }]}>Material</Text>
              <Text style={[styles.vCell, styles.vHeadText, { color: colors.ink }]}>Expected</Text>
              <Text style={[styles.vCell, styles.vHeadText, { color: colors.ink }]}>Actual</Text>
              <Text style={[styles.vCell, styles.vHeadText, { color: colors.ink }]}>Gap</Text>
            </View>
            {counted.map((v) => {
              const bad = (v.variance ?? 0) > 0;
              return (
                <View key={v.material.id} style={[styles.vRow, { borderBottomColor: colors.hairline }]}>
                  <View style={[styles.vCell, styles.vName]}>
                    <Text style={[styles.repValue, { color: colors.ink }]} numberOfLines={1}>{v.material.name}</Text>
                    {v.wastage ? <Text style={[styles.rowSub, { color: colors.muted }]}>wasted {formatQty(v.wastage, v.material.unit)}</Text> : null}
                  </View>
                  <Text style={[styles.vCell, styles.repLabel, { color: colors.ink }]}>{formatQty(v.expected, v.material.unit)}</Text>
                  <Text style={[styles.vCell, styles.repLabel, { color: colors.ink }]}>{formatQty(v.actual ?? 0, v.material.unit)}</Text>
                  <View style={styles.vCell}>
                    <Text style={[styles.repStrong, { fontSize: 13, color: bad ? colors.expenseText : colors.saleText, textAlign: 'right' }]}>
                      {(v.variance ?? 0) > 0 ? '+' : ''}
                      {formatQty(v.variance ?? 0, v.material.unit)}
                    </Text>
                    <Text style={[styles.rowSub, { color: bad ? colors.expenseText : colors.muted, textAlign: 'right' }]}>{formatRs(v.varianceValue ?? 0)}</Text>
                  </View>
                </View>
              );
            })}
            {line('Unexplained loss', formatRs(Math.max(0, totalVariance)), true, totalVariance > 0 ? colors.expenseText : colors.saleText)}
          </>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
        <Text style={[styles.cardTitle, { color: colors.ink }]}>Sent to each branch</Text>
        {transfers.length === 0 ? <Empty text="No transfers in this period." /> : null}
        {transfers.map((t) => {
          const m = data.materials.find((x) => x.id === t.materialId);
          return line(`${name(t.fromId)} → ${name(t.toId)} · ${m?.name ?? '—'}`, `${formatQty(t.qty, m?.unit ?? '')} · ${formatRs(t.value)}`);
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { paddingHorizontal: 16, gap: 10, paddingBottom: 8 },
  body: { padding: 16, gap: 12, paddingBottom: 48 },
  tabs: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    gap: 2,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    minHeight: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 8,
  },
  tabIcon: { fontSize: 22, lineHeight: 26 },
  tabText: { fontFamily: fonts.semibold, fontSize: 12 },
  hero: { borderRadius: 20, padding: 20, alignItems: 'center', gap: 6 },
  heroIcon: { fontSize: 48 },
  heroTitle: { fontFamily: fonts.bold, fontSize: 24 },
  heroText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  dashHeading: {
    fontFamily: fonts.bold,
    fontSize: 17,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    width: '31%',
    flexGrow: 1,
    minWidth: 100,
    borderRadius: 16,
    padding: 14,
    gap: 4,
    minHeight: 118,
    overflow: 'hidden',
  },
  statIcon: { fontSize: 22, opacity: 0.95, alignSelf: 'flex-end' },
  statLabel: { fontFamily: fonts.semibold, fontSize: 11, color: 'rgba(255,255,255,0.85)', letterSpacing: 0.4 },
  statValue: { fontFamily: fonts.bold, fontSize: 20, color: '#FFFFFF' },
  statSub: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickCard: {
    width: '30%',
    flexGrow: 1,
    minWidth: 96,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 14,
    paddingHorizontal: 8,
    gap: 8,
    overflow: 'hidden',
  },
  quickTopBar: { alignSelf: 'stretch', height: 3, backgroundColor: '#1D5FE0', marginBottom: 10 },
  quickIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E8F1FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIcon: { fontSize: 26 },
  quickLabel: { fontFamily: fonts.semibold, fontSize: 13, textAlign: 'center' },
  dashCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    paddingLeft: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  dashCardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  catRow: { flexDirection: 'row', flexWrap: 'nowrap', gap: 6, paddingVertical: 2 },
  section: { fontFamily: fonts.bold, fontSize: 16, flexShrink: 1 },
  link: { fontFamily: fonts.semibold, fontSize: 14 },
  hint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  emptyCard: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12 },
  empty: { fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', paddingVertical: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 15 },
  rowSub: { fontFamily: fonts.regular, fontSize: 13 },
  rowValue: { fontFamily: fonts.bold, fontSize: 15 },
  right: { alignItems: 'flex-end', gap: 2 },
  miniBtn: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  miniBtnText: { fontFamily: fonts.semibold, fontSize: 14 },
  badge: { fontFamily: fonts.bold, fontSize: 11, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  alertBanner: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 2 },
  alertTitle: { fontFamily: fonts.bold, fontSize: 14 },
  toggle: { flexDirection: 'row', gap: 10, borderWidth: 1.5, borderRadius: 14, padding: 12, alignItems: 'flex-start' },
  periods: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 6 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15, marginBottom: 2 },
  repRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, minHeight: 22 },
  repLabel: { fontFamily: fonts.regular, fontSize: 13, flexShrink: 1 },
  repValue: { fontFamily: fonts.semibold, fontSize: 13 },
  repStrong: { fontFamily: fonts.bold, fontSize: 15 },
  divider: { borderTopWidth: 1, borderStyle: 'dashed', marginVertical: 4 },
  vHead: { flexDirection: 'row', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 6, marginTop: 4 },
  vHeadText: { fontFamily: fonts.bold, fontSize: 11 },
  vRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  vCell: { width: 76, textAlign: 'right' },
  vName: { flex: 1, width: undefined, textAlign: 'left' },
});
