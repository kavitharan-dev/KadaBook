import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, ImageBackground, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { CalculatorPad as AmountPad } from '../components/CalculatorPad';
import { SaleExtrasPanel, EMPTY_EXTRAS, buildExtras, extrasTotals, type SaleExtrasState } from '../components/SaleExtrasPanel';
import { CartLineRow } from '../components/CartLineRow';
import { SaleCheckoutModal } from '../components/SaleCheckoutModal';
import { Toast, useToast } from '../components/Toast';
import { ScanIcon, SearchIcon, MoreIcon, CartDuoIcon, ReceiptDuoIcon, BackIcon } from '../components/Icons';
import { BranchChips } from '../components/kitchen/KitchenUi';
import { ErrorText, FillButton, Screen } from '../components/ui';
import { effectiveSellKind } from '../lib/productSell';
import { usesKitchenStock } from '../lib/shopType';
import { AccessBlockedModal } from '../components/GateModals';
import { useAuth } from '../context/AuthContext';
import { useShopGate } from '../context/ShopGateContext';
import { useBooks } from '../context/BooksContext';
import { useKitchen } from '../context/KitchenContext';
import { useRole } from '../lib/roles';
import { useI18n } from '../context/LocaleContext';
import { discountAmount } from '../data/saleExtras';
import type { DraftInfo, Product, SaleLine, SavedOrder } from '../data/types';
import { productSellingPrice } from '../lib/booksNormalize';
import { formatRs, formatTime } from '../lib/format';
import { formatQty } from '../lib/kitchenOps';
import type { RawMaterial } from '../data/kitchenTypes';
import { closeToDashboard } from '../lib/navigation';
import { printOrShareReceipt } from '../lib/printReceipt';
import { billTotal } from '../lib/saleOps';
import { customerBalance } from '../lib/shopPlus';
import { useResponsive } from '../lib/useResponsive';
import { useTier } from '../lib/useTier';
import { usePrintFeedback } from '../lib/usePrintFeedback';
import { useTheme } from '../context/ThemeContext';
import { tryMergeCartLine } from '../lib/stockCart';
import type { AppStackParamList } from '../navigation/types';
import type { ColorPalette } from '../theme/palettes';
import { useStyleSheet } from '../theme/useStyleSheet';
import { fonts } from '../theme/fonts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SaleMode = 'quick' | 'products' | 'saved';

/** Never blocks a linked product: the fridge can be ahead of what was entered. */
function fridgeWarning(product: Product, billQty: number, branchStock: Record<string, number>, items: RawMaterial[]) {
  if (!product.stockItemId) return null;
  const have = branchStock[product.stockItemId] ?? 0;
  const need = billQty * (product.portionQty && product.portionQty > 0 ? product.portionQty : 1);
  if (need <= have) return null;
  const unit = items.find((m) => m.id === product.stockItemId)?.unit ?? product.unit;
  return `${product.name}: Fridge shows ${formatQty(have, unit)}`;
}

function addProductToBill(
  cart: SaleLine[],
  product: Product,
  setError: (msg: string | null) => void,
  kitchenMenu?: boolean,
): SaleLine[] {
  const unitPrice = productSellingPrice(product);
  // Kitchen menu / juice with no fridge link: always add (ignore product.stock === 0).
  if (kitchenMenu && !product.stockItemId) {
    const existing = cart.find((line) => line.productId === product.id);
    const unitCost = Math.round(product.purchasePrice) || 0;
    setError(null);
    if (existing) {
      const nextQty = existing.qty + 1;
      return cart.map((line) =>
        line.productId === product.id
          ? { ...line, qty: nextQty, unitPrice, unitCost, lineTotal: Math.round(nextQty * unitPrice) }
          : line,
      );
    }
    return [
      ...cart,
      {
        productId: product.id,
        name: product.name,
        qty: 1,
        unitPrice,
        unitCost,
        lineTotal: Math.round(unitPrice),
      },
    ];
  }
  const next = tryMergeCartLine(cart, product, 1, unitPrice);
  if (!next) {
    const inCart = cart.find((l) => l.productId === product.id)?.qty ?? 0;
    const remaining = product.stock - inCart;
    if (product.stock <= 0) setError(`${product.name} is out of stock.`);
    else setError(`${product.name}: only ${remaining} ${product.unit} left.`);
    return cart;
  }
  setError(null);
  return next;
}

export function NewSaleScreen() {
  const styles = useStyleSheet(newSaleStyles);
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const { canAccess, profile } = useShopGate();
  const [blockedOpen, setBlockedOpen] = useState(false);
  const { t, locale } = useI18n();
  const { books, addQuickSale, checkoutBill, saveOrder, deleteSavedOrder, todayClosed, resumeToday } = useBooks();
  const [resumeBusy, setResumeBusy] = useState(false);
  const { colors } = useTheme();
  const kitchen = useKitchen();
  const { can } = useRole();
  const { has } = useTier();
  const isKitchenShop = usesKitchenStock(profile?.shopType ?? user?.shopType);
  const canProductSale = has('productSale');
  const { contentMaxWidth, padX, keySize } = useResponsive();
  const insets = useSafeAreaInsets();

  // The keyboard can cover the payment / discount / customer fields (no auto-resize on newer Android),
  // so pad the list by the keyboard height and scroll the form into view.
  const scrollRef = useRef<any>(null);
  const [kbHeight, setKbHeight] = useState(0);
  const modeRef = useRef<SaleMode>(isKitchenShop && canProductSale ? 'products' : 'quick');
  const printFx = usePrintFeedback();
  const toast = useToast();
  const [mode, setMode] = useState<SaleMode>(isKitchenShop && canProductSale ? 'products' : 'quick');
  const [amount, setAmount] = useState('');
  const [calcStack, setCalcStack] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cart, setCart] = useState<SaleLine[]>([]);
  const [extras, setExtras] = useState<SaleExtrasState>(EMPTY_EXTRAS);
  const [justSavedAt, setJustSavedAt] = useState<number | null>(null);
  // Customer / payment popup, then the bill once saved.
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Plan ticks drive these (grandfather = all on via useTier).
  const canBarcode = has('barcode');
  const allow = {
    pay: has('paymentModes'),
    discount: has('discount'),
    customer: has('creditBook'),
  };

  // Existing customers for the phone / name suggestions, with what each one still owes.
  const customerOptions = useMemo(
    () =>
      books.customers.map((c) => ({ name: c.name, phone: c.phone, due: customerBalance(books, c.id) })),
    [books],
  );

  const cartTotal = billTotal(cart);
  const calcStackTotal = calcStack.reduce((a, b) => a + b, 0);
  const padAmount = Math.round(Number(amount) || 0);
  // Numbers already added with "+" plus the number still being typed.
  const saveTotal = calcStackTotal + padAmount;
  const subtotal = mode === 'quick' ? saveTotal : cartTotal;
  const baseExtras = buildExtras(extras, allow, subtotal);
  // Kitchen & Stock: every sale carries the branch it was made at.
  const extrasInput = kitchen.activeBranchId ? { ...baseExtras, branchId: kitchen.activeBranchId } : baseExtras;
  // Tiles show what this branch has, not the shop total.
  const branchStock = useMemo(
    () => (kitchen.activeBranchId ? kitchen.stockAt(kitchen.activeBranchId) : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kitchen.activeBranchId, kitchen.data.stock],
  );
  const off = discountAmount(subtotal, extrasInput?.discount);
  const cartToPay = Math.max(0, cartTotal - off);


  // The sale that was just saved, once it shows up in the books (for "Print receipt").
  const lastSale = useMemo(() => {
    if (justSavedAt === null) return null;
    return (
      books.sales
        .filter((sale) => sale.createdAt >= justSavedAt)
        .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null
    );
  }, [books.sales, justSavedAt]);

  useEffect(() => {
    if (!canAccess('addSale')) setBlockedOpen(true);
  }, [canAccess]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Shop type can resolve after mount — land kitchen staff on Food, not Quick.
  useEffect(() => {
    if (!isKitchenShop || !canProductSale || mode !== 'quick') return;
    if (amount || calcStack.length || cart.length) return;
    setMode('products');
  }, [isKitchenShop, canProductSale]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (canProductSale || mode !== 'products') return;
    setMode('quick');
  }, [canProductSale]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      setKbHeight(e.endCoordinates.height);
      // Quick Sale: the form sits at the bottom, so bring it above the keyboard.
      if (modeRef.current === 'quick') {
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
      }
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setKbHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  function pushCalcAmount() {
    setError(null);
    setNotice(null);
    const value = Math.round(Number(amount) || 0);
    if (value <= 0) {
      setError(t((m) => m.sale.calcEnterAmount));
      return;
    }
    setCalcStack((stack) => [...stack, value]);
    setAmount('');
    toast.show('info', `Added ${formatRs(value)}`);
  }

  function afterSaved(startedAt: number) {
    const { toPay, creditBalance } = extrasTotals(extras, allow, subtotal);
    toast.show(
      'success',
      creditBalance > 0
        ? `Sale saved · ${formatRs(toPay)}. ${formatRs(creditBalance)} added to the credit book.`
        : `Sale saved · ${formatRs(toPay)}`,
    );
    setExtras(EMPTY_EXTRAS);
    setJustSavedAt(startedAt - 2000);
  }

  function openCheckout() {
    setError(null);
    setNotice(null);
    if (mode === 'quick' && saveTotal <= 0) {
      setError(t((m) => m.sale.calcEnterAmount));
      return;
    }
    setJustSavedAt(null);
    setCheckoutOpen(true);
  }

  /** Closes the bill popup and leaves a clean screen for the next sale. */
  function startNewSale() {
    setCheckoutOpen(false);
    setJustSavedAt(null);
    setError(null);
  }

  function showError(caught: unknown) {
    const message = caught instanceof Error ? caught.message : t((m) => m.sale.errorSave);
    setError(message);
    toast.show('error', message);
  }

  async function saveQuick() {
    setError(null);
    setNotice(null);
    const total = saveTotal;
    if (total <= 0) {
      setError(t((m) => m.sale.calcEnterAmount));
      return;
    }
    setBusy(true);
    const startedAt = Date.now();
    try {
      await addQuickSale(total, undefined, extrasInput);
      setCalcStack([]);
      setAmount('');
      afterSaved(startedAt);
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function billCart() {
    setError(null);
    setNotice(null);
    setBusy(true);
    const startedAt = Date.now();
    try {
      await checkoutBill(cart, extrasInput);
      setCart([]);
      afterSaved(startedAt);
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(false);
    }
  }

  /** The unfinished bill in one mode, as draft lines. Calculator amounts become one line each. */
  function draftLines(which: 'quick' | 'products'): SaleLine[] {
    if (which === 'products') return cart;
    const amounts = padAmount > 0 ? [...calcStack, padAmount] : calcStack;
    return amounts.map((v) => ({ name: 'Amount', qty: 1, unitPrice: v, lineTotal: v }));
  }

  function draftInfo(which: 'quick' | 'products'): DraftInfo {
    return {
      kind: which === 'quick' ? 'quick' : 'bill',
      customerName: extras.customerName,
      customerPhone: extras.customerPhone,
    };
  }

  function clearBill(which: 'quick' | 'products') {
    if (which === 'quick') {
      setCalcStack([]);
      setAmount('');
    } else {
      setCart([]);
    }
    setExtras(EMPTY_EXTRAS);
  }

  /** Parks the current bill in Drafts and clears the screen for the next customer. */
  async function holdBill() {
    const which = mode === 'quick' ? 'quick' : 'products';
    const lines = draftLines(which);
    if (!lines.length) return;
    setError(null);
    setBusy(true);
    try {
      await saveOrder(lines, draftInfo(which));
      clearBill(which);
      toast.show('success', `Bill held in Drafts · ${formatRs(billTotal(lines))}. Ready for the next customer.`);
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(false);
    }
  }

  /** Opens a draft. Whatever was on screen in that mode is held first, so nothing is lost. */
  async function resumeDraft(order: SavedOrder) {
    const which = order.kind === 'quick' ? 'quick' : 'products';
    const current = draftLines(which);
    try {
      if (current.length) await saveOrder(current, draftInfo(which));
      await deleteSavedOrder(order.id);
    } catch (caught) {
      showError(caught);
      return;
    }
    if (which === 'quick') {
      setCalcStack(order.items.map((l) => l.lineTotal));
      setAmount('');
    } else {
      setCart(order.items);
    }
    setExtras({ ...EMPTY_EXTRAS, customerName: order.customerName ?? '', customerPhone: order.customerPhone ?? '' });
    changeMode(which);
    toast.show('info', `Draft resumed · ${formatRs(order.total)}${current.length ? '. Previous bill moved to Drafts.' : ''}`);
  }

  // Leaving with an unfinished bill (back button, Home, swipe) keeps it in Drafts.
  const leaveRef = useRef<() => void>(() => undefined);
  leaveRef.current = () => {
    if (busy) return;
    for (const which of ['quick', 'products'] as const) {
      const lines = draftLines(which);
      if (lines.length) saveOrder(lines, draftInfo(which)).catch(() => undefined);
    }
  };
  useEffect(() => navigation.addListener('beforeRemove', () => leaveRef.current()), [navigation]);

  async function printLast() {
    if (!lastSale) return;
    const result = await printFx.run(() => printOrShareReceipt(user?.shopName ?? 'KadaBook', lastSale));
    if (!result) return;
    if (result.ok) toast.show('success', 'Receipt printed');
    else toast.show('error', `${t((m) => m.settings.printFailed)}: ${result.message}`);
  }

  function setLineQty(line: SaleLine, qty: number) {
    const key = line.productId ?? line.name;
    setCart((lines) =>
      lines.map((l) =>
        (l.productId ?? l.name) === key ? { ...l, qty, lineTotal: Math.round(qty * l.unitPrice) } : l,
      ),
    );
    setError(null);
  }

  function removeLine(line: SaleLine) {
    const key = line.productId ?? line.name;
    setCart((lines) => lines.filter((l) => (l.productId ?? l.name) !== key));
    toast.show('info', `${line.name} removed`);
  }

  function changeMode(next: SaleMode) {
    if (next === 'products' && !canProductSale) {
      setError('Product sale is not on your plan. Ask admin to enable it.');
      return;
    }
    setMode(next);
    setError(null);
    setNotice(null);
    setJustSavedAt(null);
  }

  const tabs: { key: SaleMode; label: string; locked?: boolean }[] = [
    // Kitchen sells food tiles first; retail keeps Products / Quick. Locked tabs stay visible.
    {
      key: 'products',
      label: isKitchenShop ? (locale === 'en' ? 'Menu' : t((m) => m.sale.tabProducts)) : locale === 'en' ? 'Products' : t((m) => m.sale.tabProducts),
      locked: !canProductSale,
    },
    { key: 'quick', label: t((m) => m.sale.tabQuick) },
    {
      key: 'saved',
      label: books.savedOrders.length
        ? `${t((m) => m.sale.tabSaved)} (${books.savedOrders.length})`
        : t((m) => m.sale.tabSaved),
    },
  ];

  // ── Collect unique categories for the category filter chips ──
  const allCategories = useMemo(() => {
    const cats = Array.from(new Set(books.products.map((p) => p.category).filter(Boolean)));
    return cats.slice(0, 7);
  }, [books.products]);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categoryFilteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = books.products;
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.barcode ?? '').includes(q),
      );
    }
    if (selectedCategory) {
      list = list.filter((p) => p.category === selectedCategory);
    }
    return list;
  }, [books.products, search, selectedCategory]);

  // Colors cycling for the left accent bar on each product row
  const ACCENT_COLORS = ['#1D5FE0', '#9B59B6', '#E67E22', '#F1C40F', '#E74C3C', '#2ECC71', '#1ABC9C', '#E91E63'];
  const holdButton = (
    <Pressable onPress={() => holdBill()} disabled={busy} style={styles.secondary}>
      <Text style={styles.secondaryText}>⏸  {t((m) => m.sale.saveOrder)}</Text>
    </Pressable>
  );

  const extrasPanel = (
    <SaleExtrasPanel
      value={extras}
      onChange={setExtras}
      subtotal={subtotal}
      allow={allow}
      customers={customerOptions}
      embedded
    />
  );

  const noticeText = notice ? <Text style={[styles.notice, { color: colors.saleText }]}>{notice}</Text> : null;

  return (
    <Screen edgeToEdgeTop>
      <SaleCheckoutModal
        visible={checkoutOpen}
        done={justSavedAt !== null}
        sale={lastSale}
        totals={{ subtotal, ...extrasTotals(extras, allow, subtotal) }}
        panel={extrasPanel}
        busy={busy}
        error={error}
        printPhase={printFx.phase}
        onConfirm={() => (mode === 'quick' ? saveQuick() : billCart())}
        onClose={() => {
          setCheckoutOpen(false);
          setError(null);
        }}
        onNewSale={startNewSale}
        onPrint={printLast}
        shopName={user?.shopName ?? 'KadaBook'}
        toast={checkoutOpen ? <Toast toast={toast.toast} onHide={toast.hide} /> : null}
      />
      <AccessBlockedModal
        visible={blockedOpen}
        onClose={() => {
          setBlockedOpen(false);
          closeToDashboard(navigation);
        }}
      />

      {/* ═══════════════════════════════════════════════════
          GRADIENT HEADER — New Sale + Create a new invoice
          ═══════════════════════════════════════════════════ */}
      <View style={styles.gradientHeaderShadowWrap}>
      <ImageBackground
        source={require('../../assets/appbar-bg.png')}
        resizeMode="cover"
        imageStyle={{ width: '100%', height: '100%' }}
        style={[styles.gradientHeader, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.headerRow}>
          {/* Back button */}
          <Pressable
            onPress={() => closeToDashboard(navigation)}
            style={styles.headerBackBtn}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <BackIcon color="#fff" size={19} />
          </Pressable>

          {/* Title block */}
          <View style={styles.headerTitleBlock}>
            <Text style={styles.headerMainTitle}>{t((m) => m.sale.title)}</Text>
            <Text style={styles.headerSubtitle}>Create a new invoice</Text>
          </View>

          {/* Right icons */}
          <View style={styles.headerRightIcons}>
            {canBarcode ? (
              <Pressable
                onPress={() => setScannerOpen(true)}
                style={styles.headerIconBtn}
                accessibilityRole="button"
                accessibilityLabel={t((m) => m.sale.scanBarcode)}
              >
                <ScanIcon color="#fff" size={19} />
              </Pressable>
            ) : null}
            <Pressable style={styles.headerIconBtn} accessibilityRole="button" accessibilityLabel="More">
              <MoreIcon color="#fff" size={19} />
            </Pressable>
          </View>
        </View>

        {/* ── Tab Chips (Food / Quick Sale / Drafts) ── */}
        <View style={styles.tabChipsRow}>
          {tabs.map((tab) => {
            const on = tab.key === mode;
            const locked = Boolean(tab.locked);
            return (
              <Pressable
                key={tab.key}
                onPress={() => changeMode(tab.key)}
                style={[styles.tabChip, on && styles.tabChipActive, locked && { opacity: 0.5 }]}
                accessibilityRole="button"
              >
                <Text style={[styles.tabChipIcon]}>
                  {tab.key === 'products' ? '🍽' : tab.key === 'quick' ? '⚡' : '📄'}
                </Text>
                <Text style={[styles.tabChipText, on && styles.tabChipTextActive]} numberOfLines={1}>
                  {locked ? `🔒 ${tab.label}` : tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ImageBackground>
      </View>

      {/* Day-closed banner */}
      {todayClosed ? (
        <View style={[styles.dayClosedBanner, { backgroundColor: colors.expenseWash, borderColor: colors.expenseText }]}>
          <Text style={[styles.dayClosedText, { color: colors.ink }]}>{t((m) => m.home.dayClosedSaleBlock)}</Text>
          {can('closeDay') ? (
            <FillButton
              label={t((m) => m.home.resumeSales)}
              busy={resumeBusy}
              color={colors.saleText}
              onPress={async () => {
                setResumeBusy(true);
                try {
                  await resumeToday();
                  toast.show('success', t((m) => m.home.resumeSales));
                } catch (caught) {
                  setError(caught instanceof Error ? caught.message : t((m) => m.home.resumeFailed));
                } finally {
                  setResumeBusy(false);
                }
              }}
            />
          ) : null}
        </View>
      ) : null}

      {/* Branch picker (multi-branch kitchens) */}
      {kitchen.data.branches.length > 1 && !kitchen.branchLocked ? (
        <View style={{ paddingHorizontal: Math.max(12, padX - 4), paddingBottom: 6, paddingTop: 6 }}>
          <BranchChips
            branches={kitchen.data.branches}
            value={kitchen.activeBranchId ?? kitchen.data.branches[0]?.id ?? ''}
            onChange={(id) => kitchen.setScope(id)}
            allowAll={false}
          />
        </View>
      ) : null}

      {/* ═══════════════════════════════════
          PRODUCTS MODE — List-view layout
          ═══════════════════════════════════ */}
      {mode === 'products' ? (
        <View style={[styles.productsSplit, contentMaxWidth ? { alignItems: 'center' } : null]}>
          <View style={[styles.productsSplitInner, contentMaxWidth ? { maxWidth: contentMaxWidth, width: '100%' } : { width: '100%', flex: 1 }]}>

            {/* ── Search + Filter ── */}
            <View style={[styles.searchRow, { paddingHorizontal: Math.max(12, padX) }]}>
              <View style={[styles.searchInputWrap, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
                <SearchIcon color={colors.muted} size={17} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder={isKitchenShop ? 'Search menu or barcode...' : t((m) => m.sale.searchProducts)}
                  placeholderTextColor={colors.placeholder}
                  autoCapitalize="none"
                  style={[styles.searchTextInput, { color: colors.ink }]}
                  onSubmitEditing={() => {
                    const code = search.trim();
                    if (isKitchenShop) {
                      const hit = books.products.find((p) => p.name.toLowerCase().includes(code.toLowerCase()));
                      if (!hit) { if (code) setError('No food match.'); return; }
                      setCart((current) => addProductToBill(current, hit, setError, true));
                      setSearch(''); setMode('products'); return;
                    }
                    const hit = books.products.find((p) => p.barcode && p.barcode.toLowerCase() === code.toLowerCase());
                    if (!hit) { if (code) setError(t((m) => m.sale.scanNotFound).replace('{code}', code)); return; }
                    setCart((current) => addProductToBill(current, hit, setError, false));
                    setSearch(''); setMode('products');
                  }}
                />
              </View>
              <Pressable
                style={[styles.filterBtn, { backgroundColor: colors.white, borderColor: colors.hairline }]}
                accessibilityRole="button"
                accessibilityLabel="Filter"
              >
                <Text style={[styles.filterBtnText, { color: colors.muted }]}>⊟</Text>
              </Pressable>
            </View>

            {/* ── Category Chips ── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryChipsWrap}
              contentContainerStyle={[styles.categoryChipsScroll, { paddingHorizontal: Math.max(12, padX) }]}
            >
              {/* "All" chip */}
              <Pressable
                onPress={() => setSelectedCategory(null)}
                style={[
                  styles.categoryChip,
                  !selectedCategory
                    ? { backgroundColor: colors.brand }
                    : { backgroundColor: colors.white, borderColor: colors.hairline, borderWidth: 1 },
                ]}
              >
                <Text style={[styles.categoryChipText, { color: !selectedCategory ? '#fff' : colors.ink }]}>All</Text>
              </Pressable>
              {allCategories.map((cat) => {
                const on = selectedCategory === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setSelectedCategory(on ? null : cat)}
                    style={[
                      styles.categoryChip,
                      on
                        ? { backgroundColor: colors.brand }
                        : { backgroundColor: colors.white, borderColor: colors.hairline, borderWidth: 1 },
                    ]}
                  >
                    <Text style={[styles.categoryChipText, { color: on ? '#fff' : colors.ink }]}>{cat}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* ── Product List Rows ── */}
            <ScrollView
              style={styles.productsScroll}
              contentContainerStyle={[styles.productsListBody, { paddingHorizontal: Math.max(12, padX) }]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            >
              {categoryFilteredProducts.map((product, index) => {
                const kind = effectiveSellKind(product, kitchen.data.recipes);
                const linkedItem = product.stockItemId ? kitchen.data.materials.find((m) => m.id === product.stockItemId) : undefined;
                const linkedQty = product.stockItemId ? branchStock[product.stockItemId] ?? 0 : 0;
                const portion = product.portionQty && product.portionQty > 0 ? product.portionQty : 1;
                const isOut = isKitchenShop ? false : product.stock <= 0;
                const price = productSellingPrice(product);
                const inCart = cart.find((l) => l.productId === product.id)?.qty ?? 0;
                const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];

                // Stock label shown in the green badge
                const stockCount = product.stockItemId
                  ? linkedQty
                  : isKitchenShop && kind === 'menu'
                    ? null
                    : product.stock;
                const stockLabelFull = product.stockItemId
                  ? formatQty(linkedQty, linkedItem?.unit ?? product.unit)
                  : isKitchenShop && kind === 'menu'
                    ? 'Menu'
                    : product.stock > 0
                      ? `${product.stock}`
                      : '0';

                return (
                  <View
                    key={product.id}
                    style={[
                      styles.productRow,
                      { backgroundColor: colors.white, borderColor: colors.hairline },
                      isOut && { opacity: 0.45 },
                    ]}
                  >
                    {/* Left coloured accent bar */}
                    <View style={[styles.productRowAccent, { backgroundColor: accent }]} />

                    {/* Name + category */}
                    <View style={styles.productRowInfo}>
                      <Text style={[styles.productRowName, { color: colors.ink }]} numberOfLines={1}>
                        {product.name}
                      </Text>
                      <Text style={[styles.productRowCategory, { color: colors.muted }]} numberOfLines={1}>
                        {product.category}
                      </Text>
                    </View>

                    {/* Price + In-stock badge */}
                    <View style={styles.productRowMeta}>
                      <Text style={[styles.productRowPrice, { color: colors.brand }]}>
                        Rs. {price.toLocaleString('en-IN')}
                      </Text>
                      <View style={styles.stockBadge}>
                        <Text style={styles.stockBadgeText}>
                          {stockCount !== null ? `In stock (${stockLabelFull})` : stockLabelFull}
                        </Text>
                      </View>
                    </View>

                    {/* +/− controls */}
                    {inCart > 0 ? (
                      <View style={styles.qtyControls}>
                        <Pressable
                          onPress={() => {
                            if (inCart <= 1) removeLine(cart.find((l) => l.productId === product.id)!);
                            else setLineQty(cart.find((l) => l.productId === product.id)!, inCart - 1);
                          }}
                          style={[styles.qtyBtn, { borderColor: colors.brand }]}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${product.name}`}
                        >
                          <Text style={[styles.qtyBtnText, { color: colors.brand }]}>−</Text>
                        </Pressable>
                        <Text style={[styles.qtyValue, { color: colors.ink }]}>{inCart}</Text>
                        <Pressable
                          onPress={() => !isOut && setCart((lines) => addProductToBill(lines, product, setError, isKitchenShop))}
                          disabled={isOut}
                          style={[styles.qtyBtn, { borderColor: colors.brand, backgroundColor: colors.brand }]}
                          accessibilityRole="button"
                          accessibilityLabel={`Add ${product.name}`}
                        >
                          <Text style={[styles.qtyBtnText, { color: '#fff' }]}>+</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => !isOut && setCart((lines) => addProductToBill(lines, product, setError, isKitchenShop))}
                        disabled={isOut}
                        style={[styles.addBtn, { borderColor: colors.brand }]}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${product.name}`}
                      >
                        <Text style={[styles.addBtnText, { color: colors.brand }]}>+</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
              {!checkoutOpen ? <ErrorText message={error} /> : null}
            </ScrollView>

            {/* ── Bottom Cart & Bill Bar ── */}
            <View style={[styles.bottomCartBar, { backgroundColor: colors.white, borderTopColor: colors.hairline, paddingBottom: Math.max(16, insets.bottom + 8) }]}>
              {/* Card Container */}
              <View style={[styles.cartSummaryCard, { backgroundColor: '#F8FAFD', borderColor: colors.line }]}>
                {/* Cart icon + item count */}
                <View style={[styles.cartIconWrap, { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1 }]}>
                  <CartDuoIcon color={colors.brand} size={22} />
                  <View style={[styles.cartCountBadge, { backgroundColor: colors.brand }]}>
                    <Text style={styles.cartCountBadgeText}>{cart.reduce((s, l) => s + l.qty, 0)}</Text>
                  </View>
                </View>
                <View style={styles.cartSummaryText}>
                  <Text style={[styles.cartItemsLabel, { color: colors.ink }]}>
                    {cart.length === 0
                      ? '0 items'
                      : `${cart.reduce((s, l) => s + l.qty, 0)} item${cart.reduce((s, l) => s + l.qty, 0) === 1 ? '' : 's'}`}
                  </Text>
                  <Text style={[styles.cartItemsHint, { color: colors.muted }]}>
                    {cart.length === 0 ? 'Tap items to add' : `${cart.length} product${cart.length === 1 ? '' : 's'}`}
                  </Text>
                </View>

                {/* Vertical Divider */}
                <View style={[styles.bottomCartDivider, { backgroundColor: colors.line }]} />

                {/* Total */}
                <View style={styles.bottomCartTotal}>
                  <Text style={[styles.totalLabel, { color: colors.muted }]}>Total</Text>
                  <Text style={[styles.totalValue, { color: colors.brand }]}>{formatRs(cartToPay)}</Text>
                </View>
              </View>

              {/* Full Width Bill button */}
              <Pressable
                onPress={openCheckout}
                disabled={cart.length === 0}
                style={[styles.billBtn, { backgroundColor: colors.brand, opacity: cart.length === 0 ? 0.6 : 1 }]}
                accessibilityRole="button"
              >
                <ReceiptDuoIcon color="#fff" size={20} />
                <Text style={styles.billBtnText}>{t((m) => m.sale.bill)}</Text>
              </Pressable>
            </View>

            {cart.length > 0 ? holdButton : null}
            {noticeText}
          </View>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.body,
            {
              paddingHorizontal: padX,
              alignItems: contentMaxWidth ? 'center' : undefined,
              paddingBottom: 20 + kbHeight,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          <View style={[styles.content, contentMaxWidth ? { maxWidth: contentMaxWidth, width: '100%' } : undefined]}>
            {mode === 'quick' ? (
              <>
                <AmountPad
                  amount={amount}
                  onChange={setAmount}
                  stack={calcStack}
                  onPlus={() => pushCalcAmount()}
                  keyHeight={keySize}
                  keyGap={10}
                  displayMinHeight={keySize + 64}
                  valueFontSize={keySize >= 64 ? 52 : 46}
                />
                <View style={styles.saveGap}>
                  <FillButton
                    label={t((m) => m.sale.calcSave)}
                    color={colors.saleText}
                    onPress={openCheckout}
                    disabled={saveTotal <= 0}
                  />
                </View>
                {saveTotal > 0 ? holdButton : null}
                {checkoutOpen ? null : <ErrorText message={error} />}
              </>
            ) : null}

            {mode === 'saved' ? (
              <>
                {books.savedOrders.length === 0 ? (
                  <View style={styles.draftEmpty}>
                    <Text style={styles.draftEmptyIcon}>🧾</Text>
                    <Text style={styles.cartEmpty}>{t((m) => m.sale.savedOrdersEmpty)}</Text>
                  </View>
                ) : (
                  books.savedOrders.map((order) => {
                    const who = order.customerName || order.customerPhone;
                    const what = order.kind === 'quick' ? 'Quick sale' : `${order.items.length} item${order.items.length === 1 ? '' : 's'}`;
                    return (
                      <View key={order.id} style={styles.draftCard}>
                        <View style={[styles.draftAvatar, { backgroundColor: who ? colors.brand : colors.keypad }]}>
                          <Text style={[styles.draftAvatarText, { color: who ? colors.onFill : colors.muted }]}>
                            {(order.customerName?.trim()[0] ?? '#').toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cartName} numberOfLines={1}>
                            {who || 'Walk-in customer'}
                          </Text>
                          <Text style={styles.cartMeta} numberOfLines={1}>
                            {what} · {formatTime(order.savedAt)}
                          </Text>
                          <Text style={styles.draftTotal}>{formatRs(order.total)}</Text>
                        </View>
                        <Pressable onPress={() => resumeDraft(order)} style={styles.loadBtn}>
                          <Text style={styles.loadBtnText}>▶ {t((m) => m.sale.loadOrder)}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            deleteSavedOrder(order.id);
                            toast.show('info', 'Draft deleted');
                          }}
                          style={styles.deleteBtn}
                        >
                          <Text style={styles.deleteBtnText}>×</Text>
                        </Pressable>
                      </View>
                    );
                  })
                )}
                {!checkoutOpen ? <ErrorText message={error} /> : null}
              </>
            ) : null}
          </View>
        </ScrollView>
      )}

      <BarcodeScannerModal
        visible={scannerOpen && canBarcode}
        title={t((m) => m.sale.scanBarcode)}
        hint={t((m) => m.sale.scanHint)}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => {
          setScannerOpen(false);
          if (!canBarcode) return;
          const hit = books.products.find((p) => p.barcode && p.barcode.toLowerCase() === code.toLowerCase());
          if (!hit) {
            setError(t((m) => m.sale.scanNotFound).replace('{code}', code));
            setSearch(code);
            return;
          }
          setCart((current) => addProductToBill(current, hit, setError, isKitchenShop));
          setSearch('');
          toast.show('success', hit.name);
        }}
      />
      {checkoutOpen ? null : <Toast toast={toast.toast} onHide={toast.hide} />}
    </Screen>
  );
}

function newSaleStyles(c: ColorPalette) {
  return {

  // ─── Gradient Header ───────────────────────────────────────────────
  gradientHeaderShadowWrap: {
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    backgroundColor: '#1D5FE0',
    shadowColor: '#0A2E7A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  gradientHeader: {
    width: '100%',
    backgroundColor: '#1D5FE0',
    paddingHorizontal: 16,
    paddingBottom: 22,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  headerBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBlock: {
    flex: 1,
  },
  headerMainTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: '#fff',
    lineHeight: 24,
  },
  headerSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
  headerRightIcons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Tab Chips ─────────────────────────────────────────────────────
  tabChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  tabChipActive: {
    backgroundColor: '#fff',
  },
  tabChipIcon: {
    fontSize: 13,
  },
  tabChipText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: '#fff',
  },
  tabChipTextActive: {
    color: '#1D5FE0',
  },

  // ─── Search Row ───────────────────────────────────────────────────
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    marginBottom: 8,
  },
  searchInputWrap: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchTextInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    height: '100%',
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnText: {
    fontSize: 18,
  },

  // ─── Category Chips ───────────────────────────────────────────────
  categoryChipsWrap: {
    flexGrow: 0,
    flexShrink: 0,
  },
  categoryChipsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
  },
  categoryChip: {
    height: 30,
    paddingHorizontal: 14,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 14,
  },

  // ─── Product List Row ─────────────────────────────────────────────
  productsScroll: {
    flex: 1,
  },
  productsListBody: {
    gap: 1,
    paddingBottom: 12,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 70,
    borderBottomWidth: 1,
    gap: 10,
    paddingRight: 12,
    paddingVertical: 8,
  },
  productRowAccent: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginLeft: 0,
  },
  productRowInfo: {
    flex: 1,
    gap: 2,
  },
  productRowName: {
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  productRowCategory: {
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  productRowMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  productRowPrice: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  stockBadge: {
    backgroundColor: '#E6F6EC',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  stockBadgeText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: '#14733D',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 20,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 18,
  },
  qtyValue: {
    fontFamily: fonts.bold,
    fontSize: 15,
    minWidth: 20,
    textAlign: 'center',
  },

  // ─── Bottom Cart Bar ──────────────────────────────────────────────
  bottomCartBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 12,
  },
  cartSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  cartIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartCountBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartCountBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#fff',
  },
  cartSummaryText: {
    flex: 1,
    gap: 2,
  },
  cartItemsLabel: {
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  cartItemsHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  bottomCartDivider: {
    width: 1,
    height: 38,
  },
  bottomCartTotal: {
    alignItems: 'flex-end',
    gap: 1,
    paddingRight: 4,
  },
  totalLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  totalValue: {
    fontFamily: fonts.bold,
    fontSize: 22,
  },
  billBtn: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  billBtnText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#fff',
  },

  // ─── Shared / legacy styles kept ─────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dayClosedBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  dayClosedText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
  },
  body: {
    paddingBottom: 20,
    gap: 12,
    flexGrow: 1,
  },
  content: {
    width: '100%',
    gap: 12,
  },
  draftEmpty: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 28,
  },
  draftEmptyIcon: {
    fontSize: 36,
  },
  draftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: c.hairline,
    borderRadius: 14,
    padding: 12,
    backgroundColor: c.white,
  },
  draftAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftAvatarText: {
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  draftTotal: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: c.ink,
    marginTop: 2,
  },
  saveGap: {
    marginTop: 24,
  },
  notice: {
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: c.saleText,
  },
  cartEmpty: {
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.muted,
  },
  cartName: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: c.ink,
  },
  cartMeta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.muted,
  },
  billBar: {
    gap: 10,
  },
  billTotal: {
    fontFamily: fonts.bold,
    fontSize: 26,
    color: c.ink,
    textAlign: 'center',
  },
  billActions: {
    width: '100%',
  },
  secondary: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: c.brand,
  },
  loadBtn: {
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: c.gradientTop,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadBtnText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: c.brand,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    fontSize: 22,
    color: c.muted,
  },
  productsSplit: {
    flex: 1,
  },
  productsSplitInner: {
    flex: 1,
  },
};
}
