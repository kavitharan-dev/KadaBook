import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialForm, MoveForm, RecipeForm, type MoveKind } from '../components/kitchen/KitchenForms';
import { MaterialCatalogSheet } from '../components/kitchen/MaterialCatalogSheet';
import { BranchChips, Chip, Input, Sheet, kitchenStyles } from '../components/kitchen/KitchenUi';
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
  recipeFor,
  stockLevels,
  transferSummary,
  varianceReport,
} from '../lib/kitchenOps';
import { maybeNotifyKitchenLowStock } from '../lib/kitchenLowStockNotify';
import { shareKitchenReport } from '../lib/kitchenReportShare';
import { fonts } from '../theme/fonts';
import { useRole } from '../lib/roles';

type Tab = 'stock' | 'menu' | 'moves' | 'suppliers' | 'reports';
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

const ACTIONS: { kind: MoveKind; icon: string; label: string }[] = [
  { kind: 'purchase', icon: '🛒', label: 'Purchase' },
  { kind: 'transfer', icon: '🚚', label: 'Transfer' },
  { kind: 'produce', icon: '🍔', label: 'Produce' },
  { kind: 'wastage', icon: '🗑', label: 'Wastage' },
  { kind: 'count', icon: '📋', label: 'Stock count' },
];

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
  const [editMaterial, setEditMaterial] = useState<RawMaterial | null | 'new'>(null);
  const [recipeProduct, setRecipeProduct] = useState<Product | null>(null);
  const [branchName, setBranchName] = useState('');
  const [addingBranch, setAddingBranch] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | 'all'>('all');
  const [supplierSheet, setSupplierSheet] = useState<'new' | Supplier | null>(null);

  const stock = useMemo(() => stockLevels(data, scope), [data, scope]);
  const stockValue = data.materials.reduce((sum, m) => sum + Math.max(0, stock[m.id] ?? 0) * m.avgCost, 0);
  const low = data.materials.filter((m) => m.reorderLevel > 0 && (stock[m.id] ?? 0) <= m.reorderLevel);

  useEffect(() => {
    if (k.loading || data.branches.length === 0) return;
    void maybeNotifyKitchenLowStock(data.materials, stock);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k.loading, data.materials.length, low.length]);
  const categories = useMemo(() => {
    const fromData = data.materials.map((m) => m.category).filter((c): c is string => !!c);
    return Array.from(new Set([...CATALOG_CATEGORIES, ...fromData]));
  }, [data.materials]);
  const visibleMaterials = useMemo(
    () =>
      categoryFilter === 'all'
        ? data.materials
        : data.materials.filter((m) => (m.category ?? '') === categoryFilter),
    [data.materials, categoryFilter],
  );
  const branchName_ = (id?: string) => data.branches.find((b) => b.id === id)?.name ?? '—';

  const done = (message: string) => {
    setMove(null);
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
              Track raw materials, cost per menu item, transfers between branches and where stock goes missing.
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

  return (
    <Screen>
      <Header title="Kitchen & Stock" onBack={() => navigation.goBack()} />
      <View style={styles.top}>
        <BranchChips branches={data.branches} value={scope} onChange={setScope} onAdd={can('manageBranches') ? () => setAddingBranch(true) : undefined} />
        <View style={[styles.tabs, { backgroundColor: colors.keypad }]}>
          {(
            [
              ['stock', 'Stock'],
              ['menu', 'Menu'],
              ['moves', 'Moves'],
              ['suppliers', 'Payables'],
              ['reports', 'Reports'],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && { backgroundColor: colors.white }]}>
              <Text style={[styles.tabText, { color: tab === key ? colors.brand : colors.muted }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {tab === 'stock' ? (
          <>
            <View style={kitchenStyles.row}>
              <Tile label="STOCK VALUE" value={formatRs(stockValue)} />
              <Tile label="LOW STOCK" value={String(low.length)} tone={low.length ? colors.expenseText : undefined} />
              <Tile label="MATERIALS" value={String(data.materials.length)} />
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
            <View style={styles.actions}>
              {ACTIONS.map((a) => (
                <Pressable key={a.kind} onPress={() => setMove(a.kind)} style={[styles.action, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
                  <Text style={styles.actionIcon}>{a.icon}</Text>
                  <Text style={[styles.actionText, { color: colors.ink }]}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.sectionRow}>
              <Text style={[styles.section, { color: colors.ink }]}>
                Raw materials{scope === 'all' ? ' · all branches' : ` · ${branchName_(scope)}`}
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable onPress={() => setCatalogOpen(true)}>
                  <Text style={[styles.link, { color: colors.brand }]}>＋ Catalog</Text>
                </Pressable>
                <Pressable onPress={() => setEditMaterial('new')}>
                  <Text style={[styles.link, { color: colors.brand }]}>＋ Material</Text>
                </Pressable>
              </View>
            </View>
            {data.materials.length > 0 ? (
              <View style={styles.catRow}>
                <Chip label="All" on={categoryFilter === 'all'} onPress={() => setCategoryFilter('all')} />
                {categories.map((c) => (
                  <Chip key={c} label={c} on={categoryFilter === c} onPress={() => setCategoryFilter(c)} />
                ))}
              </View>
            ) : null}
            {data.materials.length === 0 ? (
              <Empty text="No materials yet. Tap ＋ Catalog to add the standard burger / fast-food list, or ＋ Material for one item." />
            ) : null}
            {visibleMaterials.map((m) => {
              const q = stock[m.id] ?? 0;
              const isLow = m.reorderLevel > 0 && q <= m.reorderLevel;
              return (
                <Pressable key={m.id} onPress={() => setEditMaterial(m)} style={[styles.row, { backgroundColor: colors.white, borderColor: isLow ? colors.expenseText : colors.hairline }]}>
                  <View style={styles.flex}>
                    <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>
                      {m.name}
                      {m.inputs?.length ? <Text style={{ color: colors.brand }}>  · prepared</Text> : null}
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

        {tab === 'menu' ? (
          <>
            <Text style={[styles.hint, { color: colors.muted }]}>
              Tap a menu item to set its recipe. Each sale of it then takes those materials out of stock at the branch that sold it.
            </Text>
            {books.products.length === 0 ? <Empty text="No menu items yet. Add your burgers in Products first." /> : null}
            {books.products.map((p) => {
              const recipe = recipeFor(p.id, data.recipes);
              const c = recipe ? itemCosting(p.sellingPrice, recipe.lines, data) : null;
              return (
                <Pressable key={p.id} onPress={() => setRecipeProduct(p)} style={[styles.row, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
                  <View style={styles.flex}>
                    <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={[styles.rowSub, { color: colors.muted }]}>
                      Sells {formatRs(p.sellingPrice)}
                      {recipe ? ` · ${recipe.lines.length} material${recipe.lines.length === 1 ? '' : 's'}` : ''}
                    </Text>
                  </View>
                  {c ? (
                    <View style={styles.right}>
                      <Text style={[styles.rowValue, { color: colors.ink }]}>Cost {formatRs(c.cost)}</Text>
                      <Text style={[styles.rowSub, { color: c.margin >= 0 ? colors.saleText : colors.expenseText }]}>
                        Margin {formatRs(c.margin)} · {c.marginPercent}%
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.link, { color: colors.brand }]}>＋ Recipe</Text>
                  )}
                </Pressable>
              );
            })}
          </>
        ) : null}

        {tab === 'moves' ? (
          <>
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

        {tab === 'suppliers' ? <SuppliersTab onAdd={() => setSupplierSheet('new')} onOpen={(s) => setSupplierSheet(s)} /> : null}

        {tab === 'reports' ? <Reports period={period} setPeriod={setPeriod} onToast={toast.show} /> : null}
      </ScrollView>

      <MoveForm kind={move} onClose={() => setMove(null)} onDone={done} />
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

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[kitchenStyles.tile, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
      <Text style={[kitchenStyles.tileLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[kitchenStyles.tileValue, { color: tone ?? colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.empty, { color: colors.muted }]}>{text}</Text>;
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
      <View style={kitchenStyles.row}>
        <Tile label="SUPPLIERS" value={String(books.suppliers.length)} />
        <Tile label="TOTAL OWED" value={formatRs(owed)} tone={owed ? colors.expenseText : undefined} />
      </View>
      <View style={styles.sectionRow}>
        <Text style={[styles.section, { color: colors.ink }]}>Supplier payables</Text>
        <Pressable onPress={onAdd}>
          <Text style={[styles.link, { color: colors.brand }]}>＋ Supplier</Text>
        </Pressable>
      </View>
      <Text style={[styles.hint, { color: colors.muted }]}>
        Mark a kitchen purchase as “on credit” to add here. Tap a supplier to record a payment.
      </Text>
      {books.suppliers.length === 0 ? <Empty text="No suppliers yet. Add one, or buy on credit from Purchase." /> : null}
      {books.suppliers
        .slice()
        .sort((a, b) => b.payable - a.payable || b.createdAt - a.createdAt)
        .map((s) => (
          <Pressable key={s.id} onPress={() => onOpen(s)} style={[styles.row, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
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
  body: { padding: 16, gap: 10, paddingBottom: 40 },
  tabs: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  tab: { flex: 1, minHeight: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontFamily: fonts.semibold, fontSize: 12 },
  hero: { borderRadius: 20, padding: 20, alignItems: 'center', gap: 6 },
  heroIcon: { fontSize: 44 },
  heroTitle: { fontFamily: fonts.bold, fontSize: 22 },
  heroText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { width: '31%', flexGrow: 1, minHeight: 72, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  actionIcon: { fontSize: 22 },
  actionText: { fontFamily: fonts.semibold, fontSize: 12 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, gap: 8 },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  section: { fontFamily: fonts.bold, fontSize: 15, flexShrink: 1 },
  link: { fontFamily: fonts.semibold, fontSize: 13 },
  hint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },
  empty: { fontFamily: fonts.regular, fontSize: 13, textAlign: 'center', paddingVertical: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 14 },
  rowSub: { fontFamily: fonts.regular, fontSize: 12 },
  rowValue: { fontFamily: fonts.bold, fontSize: 14 },
  right: { alignItems: 'flex-end', gap: 2 },
  badge: { fontFamily: fonts.bold, fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  alertBanner: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 2 },
  alertTitle: { fontFamily: fonts.bold, fontSize: 13 },
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
