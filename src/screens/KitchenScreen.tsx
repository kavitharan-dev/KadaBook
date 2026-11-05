import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  BuyForm,
  CountForm,
  ItemForm,
  MakeForm,
  QuickFoodForm,
  QuickRawForm,
  SendForm,
  WasteForm,
} from '../components/kitchen/KitchenForms';
import { KitchenSuccessBurst, type KitchenBurstKind } from '../components/kitchen/KitchenSuccessBurst';
import { BranchStockCard, BranchStockReport } from '../components/BranchStockCard';
import { BranchChips, Chip, Input, Sheet } from '../components/kitchen/KitchenUi';
import { GradientStatCard, gradients } from '../components/DashboardCards';
import { FadeUp } from '../components/FadeUp';
import { HomeActionTile } from '../components/HomeActionTile';
import {
  BoxDuoIcon,
  CartDuoIcon,
  ChartDuoIcon,
  GridDuoIcon,
  ReceiptDuoIcon,
  TrendDuoIcon,
  TrophyDuoIcon,
} from '../components/Icons';
import { Toast, useToast } from '../components/Toast';
import { FillButton, Header, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useBooks } from '../context/BooksContext';
import { useKitchen } from '../context/KitchenContext';
import { useTheme } from '../context/ThemeContext';
import { ITEM_KIND_LABEL, MOVE_LABEL, type ItemKind, type RawMaterial, type StockMove } from '../data/kitchenTypes';
import type { Supplier } from '../data/types';
import { formatDay, formatRs, formatTime, startOfDay } from '../lib/format';
import { formatQty, stockLevels, stockValue } from '../lib/kitchenOps';
import { maybeNotifyKitchenLowStock } from '../lib/kitchenLowStockNotify';
import { shareKitchenReport } from '../lib/kitchenReportShare';
import { branchBlocked, quotaUpgradeWhatsAppMessage } from '../lib/planQuota';
import { useRole } from '../lib/roles';
import { usesKitchenStock } from '../lib/shopType';
import { itemKind } from '../lib/stockEngine';
import { useTier } from '../lib/useTier';
import type { AppStackParamList } from '../navigation/types';
import { fonts } from '../theme/fonts';
import { useShopGate } from '../context/ShopGateContext';

type Panel = 'home' | 'log' | 'pay' | 'report';
type Period = 'today' | 'week' | 'month' | 'lastMonth';
type FormKind = 'buy' | 'send' | 'make' | 'count' | 'waste' | 'food' | 'raw';

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

const KIND_ORDER: ItemKind[] = ['finished', 'direct', 'raw'];

export function KitchenScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { profile, subscription, openRenewWhatsApp } = useShopGate();
  const k = useKitchen();
  const { data, scope, setScope } = k;
  const toast = useToast();
  const { can } = useRole();
  const { has } = useTier();
  const canSuppliers = has('suppliers');
  const isKitchenShop = usesKitchenStock(profile?.shopType ?? user?.shopType);
  const [panel, setPanel] = useState<Panel>('home');
  const [period, setPeriod] = useState<Period>('today');
  const [form, setForm] = useState<FormKind | null>(null);
  const [editItem, setEditItem] = useState<RawMaterial | 'new' | null>(null);
  const [branchName, setBranchName] = useState('');
  const [addingBranch, setAddingBranch] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [supplierSheet, setSupplierSheet] = useState<'new' | Supplier | null>(null);
  const [burst, setBurst] = useState<{ kind: KitchenBurstKind; text: string } | null>(null);
  const seedOnce = useRef(false);

  const stock = useMemo(() => stockLevels(data, scope), [data, scope]);
  const value = useMemo(() => stockValue(data, scope), [data, scope]);
  const low = data.materials.filter((m) => m.reorderLevel > 0 && (stock[m.id] ?? 0) <= m.reorderLevel);
  const finishedCount = data.materials.filter((m) => itemKind(m) === 'finished').length;

  useEffect(() => {
    if (k.loading || data.branches.length === 0) return;
    void maybeNotifyKitchenLowStock(data.materials, stock);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k.loading, data.materials.length, low.length]);

  // First kitchen open with empty catalog → load Mr Chef once (never wipe existing).
  useEffect(() => {
    if (!isKitchenShop || k.loading || data.branches.length === 0) return;
    if (data.materials.length > 0 || seedOnce.current || seeding) return;
    seedOnce.current = true;
    void (async () => {
      setSeeding(true);
      try {
        const added = await k.seedBurgerShop();
        toast.show('success', `Kitchen ready · ${added} items`);
      } catch (caught) {
        seedOnce.current = false;
        toast.show('error', caught instanceof Error ? caught.message : 'Could not load kitchen list.');
      } finally {
        setSeeding(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKitchenShop, k.loading, data.branches.length, data.materials.length]);

  const done = (message: string, kind: KitchenBurstKind = 'ok') => {
    setForm(null);
    setEditItem(null);
    setBurst({ kind, text: message });
  };

  function confirmDeleteBranch(branchId: string) {
    if (!can('manageBranches')) return;
    const target = data.branches.find((b) => b.id === branchId);
    if (!target) return;
    if (data.branches.length <= 1) {
      Alert.alert('Keep one branch', 'You need at least one branch for kitchen stock.');
      return;
    }
    Alert.alert(
      `Delete “${target.name}”?`,
      'Stock at this branch will be removed. Sales history stays. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await k.deleteBranch(branchId);
                toast.show('success', `${target.name} deleted`);
              } catch (caught) {
                toast.show('error', caught instanceof Error ? caught.message : 'Could not delete branch.');
              }
            })();
          },
        },
      ],
    );
  }

  async function createBranch() {
    const block = branchBlocked(data.branches.length, subscription);
    if (block) {
      setAddingBranch(false);
      Alert.alert('Branch limit reached', block.message, [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'WhatsApp admin',
          onPress: () =>
            openRenewWhatsApp(
              quotaUpgradeWhatsAppMessage({
                kind: 'branch',
                shopName: profile?.shopName ?? user?.shopName ?? '-',
                phone: String(profile?.phone ?? user?.phone ?? '-'),
                current: data.branches.length,
                limit: block.limit,
              }),
            ),
        },
      ]);
      return;
    }
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

  function goBack() {
    if (panel !== 'home') {
      setPanel('home');
      return;
    }
    navigation.goBack();
  }

  // Retail / non-kitchen logins must never use this screen.
  if (!isKitchenShop) {
    return (
      <Screen>
        <Header title="Kitchen" onBack={() => navigation.goBack()} />
        <View style={styles.body}>
          <Empty text="Kitchen is only for kitchen / restaurant shops." />
        </View>
      </Screen>
    );
  }

  // First run: a shop needs a main branch before anything else.
  if (!k.loading && data.branches.length === 0) {
    return (
      <Screen>
        <Header title="Kitchen" onBack={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.body}>
          <View style={[styles.hero, { backgroundColor: colors.gradientTop }]}>
            <Text style={styles.heroIcon}>🍔</Text>
            <Text style={[styles.heroTitle, { color: colors.ink }]}>Kitchen</Text>
            <Text style={[styles.heroText, { color: colors.muted }]}>
              Buy at main → send / make → sell. Juice can sell with no fridge link.
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

  function openSend() {
    if (k.branchLocked) {
      Alert.alert('Send stock', 'Your login is locked to one branch. Ask the owner to send stock.');
      return;
    }
    // Read live count — after Staff adds a sub-branch, chips refresh from the same kitchen data.
    if (data.branches.length < 2) {
      Alert.alert(
        'Add a sub-branch to send',
        'Your owner account is the main branch. Add a sub-branch in Staff & roles, then Send moves stock (e.g. Main → Counter).',
        [
          { text: 'Not now', style: 'cancel' },
          ...(can('manageBranches') && has('staff')
            ? [{ text: 'Open Staff & roles', onPress: () => navigation.navigate('Staff') }]
            : can('manageBranches')
              ? [{ text: 'Add branch', onPress: () => setAddingBranch(true) }]
              : []),
        ],
      );
      return;
    }
    setForm('send');
  }

  const dashActions = [
    { key: 'buy', label: 'Buy', gradient: gradients.green, Icon: CartDuoIcon, onPress: () => setForm('buy'), hidden: false },
    {
      key: 'send',
      label: 'Send',
      gradient: gradients.teal,
      Icon: TrendDuoIcon,
      onPress: openSend,
      // Always show — single-branch shops get guided to add a branch (Mr Chef starts with 1).
      hidden: false,
    },
    { key: 'make', label: 'Make', gradient: gradients.purple, Icon: BoxDuoIcon, onPress: () => setForm('make'), hidden: false },
    { key: 'food', label: '+ Food', gradient: gradients.orange, Icon: ReceiptDuoIcon, onPress: () => setForm('food'), hidden: false },
    { key: 'raw', label: '+ Raw', gradient: gradients.blue, Icon: BoxDuoIcon, onPress: () => setForm('raw'), hidden: false },
    { key: 'count', label: 'Count', gradient: gradients.blue, Icon: ChartDuoIcon, onPress: () => setForm('count'), hidden: false },
    { key: 'waste', label: 'Waste', gradient: gradients.red, Icon: TrophyDuoIcon, onPress: () => setForm('waste'), hidden: false },
    { key: 'log', label: 'Log', gradient: gradients.blue, Icon: GridDuoIcon, onPress: () => setPanel('log'), hidden: false },
    { key: 'pay', label: 'Pay', gradient: gradients.orange, Icon: TrophyDuoIcon, onPress: () => setPanel('pay'), hidden: !canSuppliers },
    { key: 'report', label: 'Report', gradient: gradients.teal, Icon: ChartDuoIcon, onPress: () => setPanel('report'), hidden: false },
  ].filter((a) => !a.hidden);

  const headerTitle = panel === 'log' ? 'Log' : panel === 'pay' ? 'Pay' : panel === 'report' ? 'Report' : 'Kitchen';
  const showBranchBar = panel === 'home' && data.branches.length > 0 && !k.branchLocked;

  return (
    <Screen>
      <Header title={headerTitle} onBack={goBack} />
      {showBranchBar ? (
        <View style={[styles.top, { backgroundColor: colors.canvas }]}>
          <BranchChips
            branches={data.branches}
            value={scope}
            onChange={setScope}
            onDelete={can('manageBranches') ? confirmDeleteBranch : undefined}
          />
        </View>
      ) : null}
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {k.error ? <Text style={[styles.hint, { color: colors.expenseText }]}>{k.error}</Text> : null}
        {seeding ? <Text style={[styles.hint, { color: colors.muted }]}>Loading kitchen list…</Text> : null}

        {panel === 'home' ? (
          <>
            <View style={styles.statRow}>
              <GradientStatCard
                delay={40}
                gradient={gradients.blue}
                glow="rgba(37,99,235,0.35)"
                label="Stock value"
                value={Math.round(value)}
                chip={scope === 'all' ? 'All branches' : 'This branch'}
                viewLabel="Open"
                Icon={TrendDuoIcon}
                onPress={() => setPanel('report')}
                style={styles.statHalf}
              />
              <GradientStatCard
                delay={90}
                gradient={low.length ? gradients.red : gradients.green}
                glow={low.length ? 'rgba(239,68,68,0.35)' : 'rgba(34,164,71,0.35)'}
                label="Low stock"
                value={low.length}
                chip={low.length ? 'Need reorder' : 'All good'}
                viewLabel="Buy"
                Icon={TrophyDuoIcon}
                onPress={() => setForm('buy')}
                style={styles.statHalf}
              />
            </View>

            <FadeUp delay={140} style={[styles.panel, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
              <View style={[styles.panelHead, { borderBottomColor: colors.hairline }]}>
                <GridDuoIcon color={colors.brand} size={18} />
                <Text style={[styles.panelTitle, { color: colors.brand }]}>Kitchen actions</Text>
              </View>
              <View style={styles.grid}>
                {dashActions.map((action, index) => (
                  <HomeActionTile
                    key={action.key}
                    delay={180 + index * 70}
                    gradient={action.gradient}
                    label={action.label}
                    Icon={action.Icon}
                    onPress={action.onPress}
                  />
                ))}
              </View>
            </FadeUp>

            <FadeUp delay={320}>
              <BranchStockCard />
            </FadeUp>

            {data.materials.length === 0 ? (
              <Empty text={seeding ? 'Setting up kitchen…' : 'No stock yet. Use + Raw / + Food.'} />
            ) : (
              <>
                <Text style={[styles.section, { color: colors.ink }]}>
                  In fridge{finishedCount ? ` · ${finishedCount} ready` : ''}
                </Text>
                {KIND_ORDER.map((kind) => {
                  const rows = data.materials.filter((m) => itemKind(m) === kind);
                  if (!rows.length) return null;
                  return (
                    <View key={kind} style={styles.group}>
                      <Text style={[styles.groupTitle, { color: colors.muted }]}>{ITEM_KIND_LABEL[kind]}</Text>
                      {rows.map((m) => {
                        const qty = stock[m.id] ?? 0;
                        const isLow = m.reorderLevel > 0 && qty <= m.reorderLevel;
                        return (
                          <Pressable
                            key={m.id}
                            onPress={() => setEditItem(m)}
                            style={[styles.row, { backgroundColor: colors.white, borderColor: colors.hairline }]}
                          >
                            <Text style={[styles.rowTitle, styles.flex, { color: colors.ink }]} numberOfLines={1}>
                              {m.name}
                            </Text>
                            <Text style={[styles.rowValue, { color: qty < 0 || isLow ? colors.expenseText : colors.ink }]}>
                              {formatQty(qty, m.unit)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  );
                })}
              </>
            )}
          </>
        ) : null}

        {panel === 'log' ? (
          <>
            {data.moves.filter((m) => scope === 'all' || m.branchId === scope).length === 0 ? <Empty text="No stock movements yet." /> : null}
            {data.moves
              .filter((m) => scope === 'all' || m.branchId === scope)
              .slice(0, 100)
              .map((mv) => (
                <MoveRow key={mv.id} move={mv} />
              ))}
          </>
        ) : null}

        {panel === 'pay' && canSuppliers ? (
          <SuppliersTab onAdd={() => setSupplierSheet('new')} onOpen={setSupplierSheet} />
        ) : null}

        {panel === 'report' ? <Reports period={period} setPeriod={setPeriod} onToast={toast.show} /> : null}
      </ScrollView>

      <BuyForm visible={form === 'buy'} onClose={() => setForm(null)} onDone={done} />
      <SendForm visible={form === 'send'} onClose={() => setForm(null)} onDone={done} />
      <MakeForm visible={form === 'make'} onClose={() => setForm(null)} onDone={done} />
      <CountForm visible={form === 'count'} onClose={() => setForm(null)} onDone={done} />
      <WasteForm visible={form === 'waste'} onClose={() => setForm(null)} onDone={done} />
      <QuickFoodForm visible={form === 'food'} onClose={() => setForm(null)} onDone={done} />
      <QuickRawForm visible={form === 'raw'} onClose={() => setForm(null)} onDone={done} />
      <ItemForm target={editItem} onClose={() => setEditItem(null)} onDone={done} />
      <SupplierSheet
        target={supplierSheet}
        onClose={() => setSupplierSheet(null)}
        onDone={(message) => {
          setSupplierSheet(null);
          toast.show('success', message);
        }}
      />
      <Sheet visible={addingBranch} title="Add branch" onClose={() => setAddingBranch(false)} actionLabel="Add branch" onAction={createBranch}>
        <Input value={branchName} onChangeText={setBranchName} placeholder="Branch name" autoFocus />
      </Sheet>
      <KitchenSuccessBurst
        kind={burst?.kind ?? null}
        text={burst?.text ?? ''}
        onDone={() => {
          if (burst) toast.show('success', burst.text);
          setBurst(null);
        }}
      />
      <Toast toast={toast.toast} onHide={toast.hide} />
    </Screen>
  );
}

function MoveRow({ move }: { move: StockMove }) {
  const { colors } = useTheme();
  const { data } = useKitchen();
  const branch = (id?: string) => data.branches.find((b) => b.id === id)?.name ?? '—';
  const where = move.otherBranchId ? branch(move.branchId) + ' · ' + branch(move.otherBranchId) : branch(move.branchId);
  const parts = Object.entries(move.qty).map(([id, q]) => {
    const m = data.materials.find((x) => x.id === id);
    return formatQty(q, m?.unit ?? '') + ' ' + (m?.name ?? 'Item');
  });
  const value = Object.values(move.cost).reduce((a, b) => a + b, 0);
  return (
    <View style={[styles.moveRow, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: colors.ink }]}>
          {MOVE_LABEL[move.type]}
          <Text style={[styles.rowSub, { color: colors.muted }]}>  · {where}</Text>
        </Text>
        <Text style={[styles.rowSub, { color: colors.muted }]} numberOfLines={3}>{parts.length ? parts.join(', ') : 'Matched, no change'}</Text>
        <Text style={[styles.rowSub, { color: colors.muted }]}>
          {formatDay(move.createdAt)} · {formatTime(move.createdAt)}
          {move.supplier ? ' · ' + move.supplier : ''}
          {move.note ? ' · ' + move.note : ''}
        </Text>
      </View>
      <Text style={[styles.rowValue, { color: value >= 0 ? colors.saleText : colors.expenseText }]}>
        {value >= 0 ? '+' : '−'}{formatRs(Math.abs(value))}
      </Text>
    </View>
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
  const { user } = useAuth();
  const { books } = useBooks();
  const { data, scope } = useKitchen();
  const [sharing, setSharing] = useState(false);
  const { start, end } = periodBounds(period);
  const options: [Period, string][] = [['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['lastMonth', 'Last month']];

  async function share() {
    setSharing(true);
    const result = await shareKitchenReport({ shopName: user?.shopName ?? 'KadaBook', data, sales: books.sales, scope, start, end });
    setSharing(false);
    if (!result.ok) onToast('error', result.message);
  }

  return (
    <>
      <View style={styles.wrap}>
        {options.map(([key, label]) => (
          <Chip key={key} label={label} on={period === key} onPress={() => setPeriod(key)} />
        ))}
      </View>
      <BranchStockReport start={start} end={end} />
      <FillButton label="Share report" busy={sharing} onPress={() => { void share(); }} />
    </>
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

function Empty({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.emptyCard, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
      <Text style={[styles.empty, { color: colors.muted }]}>{text}</Text>
    </View>
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
      <FillButton label="+ Add supplier" onPress={onAdd} />
      <Text style={[styles.hint, { color: colors.muted }]}>Or Buy on credit. Tap a supplier to pay.</Text>
      {books.suppliers.length === 0 ? <Empty text="No suppliers yet. Add one above, or Buy on credit." /> : null}
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  group: { gap: 6 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { flexGrow: 1, minWidth: 60, borderWidth: 1, borderRadius: 14, alignItems: 'center', paddingVertical: 12, gap: 4 },
  actionIcon: { fontSize: 22 },
  actionText: { fontFamily: fonts.semibold, fontSize: 13 },
  moveRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
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
  statRow: { flexDirection: 'row', gap: 10 },
  statHalf: { flex: 1, minWidth: 0 },
  panel: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 4,
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  panelTitle: { fontFamily: fonts.bold, fontSize: 15 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    gap: 0,
  },
  groupTitle: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.4, marginBottom: 4 },
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
