import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { CalculatorPad as AmountPad } from '../components/CalculatorPad';
import { SaleExtrasPanel, EMPTY_EXTRAS, buildExtras, extrasTotals, type SaleExtrasState } from '../components/SaleExtrasPanel';
import { TodaySalesHistory } from '../components/TodaySalesHistory';
import { CartLineRow } from '../components/CartLineRow';
import { SaleCheckoutModal } from '../components/SaleCheckoutModal';
import { Toast, useToast } from '../components/Toast';
import { ProductTile } from '../components/ProductTile';
import { ScanIcon } from '../components/Icons';
import { BranchChips } from '../components/kitchen/KitchenUi';
import { ErrorText, Field, FillButton, Header, Screen } from '../components/ui';
import { effectiveSellKind, hasRecipe } from '../lib/productSell';
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
import { closeToDashboard } from '../lib/navigation';
import { printOrShareReceipt } from '../lib/printReceipt';
import { billTotal } from '../lib/saleOps';
import { customerBalance } from '../lib/shopPlus';
import { useResponsive } from '../lib/useResponsive';
import { usePrintFeedback } from '../lib/usePrintFeedback';
import { useTheme } from '../context/ThemeContext';
import { tryMergeCartLine } from '../lib/stockCart';
import type { AppStackParamList } from '../navigation/types';
import type { ColorPalette } from '../theme/palettes';
import { useStyleSheet } from '../theme/useStyleSheet';
import { fonts } from '../theme/fonts';

type SaleMode = 'quick' | 'products' | 'saved';

function addProductToBill(
  cart: SaleLine[],
  product: Product,
  setError: (msg: string | null) => void,
): SaleLine[] {
  const unitPrice = productSellingPrice(product);
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
  const isKitchenShop = usesKitchenStock(profile?.shopType ?? user?.shopType);
  const { contentMaxWidth, padX, keySize } = useResponsive();

  // The keyboard can cover the payment / discount / customer fields (no auto-resize on newer Android),
  // so pad the list by the keyboard height and scroll the form into view.
  const scrollRef = useRef<any>(null);
  const [kbHeight, setKbHeight] = useState(0);
  const modeRef = useRef<SaleMode>('quick');
  const printFx = usePrintFeedback();
  const toast = useToast();
  const [mode, setMode] = useState<SaleMode>('quick');
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

  // Every feature is on for now. The plan split comes last.
  const allow = { pay: true, discount: true, customer: true };

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
  const off = discountAmount(subtotal, extrasInput?.discount);
  const cartToPay = Math.max(0, cartTotal - off);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return books.products;
    return books.products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.barcode ?? '').includes(q),
    );
  }, [books.products, search]);

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
      const sold = cart;
      setCart([]);
      if (isKitchenShop) {
        kitchen.recordSale(sold).catch(() => toast.show('error', 'Sale saved, but kitchen stock usage could not be recorded.'));
      }
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
    setMode(next);
    setError(null);
    setNotice(null);
    setJustSavedAt(null);
  }

  const tabs: { key: SaleMode; label: string }[] = [
    // The old English label "Sale – All" was unclear; other languages keep their translation.
    { key: 'products', label: locale === 'en' ? 'Products' : t((m) => m.sale.tabProducts) },
    { key: 'quick', label: t((m) => m.sale.tabQuick) },
    {
      key: 'saved',
      label: books.savedOrders.length
        ? `${t((m) => m.sale.tabSaved)} (${books.savedOrders.length})`
        : t((m) => m.sale.tabSaved),
    },
  ];
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
    <Screen>
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
      <Header title={t((m) => m.sale.title)} onBack={() => closeToDashboard(navigation)} />
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
      {kitchen.data.branches.length > 1 && !kitchen.branchLocked ? (
        <View style={{ paddingHorizontal: Math.max(12, padX - 4), paddingBottom: 6 }}>
          <BranchChips
            branches={kitchen.data.branches}
            value={kitchen.activeBranchId ?? kitchen.data.branches[0]?.id ?? ''}
            onChange={(id) => kitchen.setScope(id)}
            allowAll={false}
          />
        </View>
      ) : null}
      <View style={[styles.tabs, { paddingHorizontal: Math.max(12, padX - 4), borderBottomColor: colors.hairline }]}>
        {tabs.map((tab) => {
          const on = tab.key === mode;
          return (
            <Pressable
              key={tab.key}
              onPress={() => changeMode(tab.key)}
              style={[styles.tab, { borderBottomColor: on ? colors.brand : 'transparent' }]}
            >
              <Text style={[styles.tabText, { color: on ? colors.brand : colors.muted }]} numberOfLines={1}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {mode === 'products' ? (
        <View
          style={[
            styles.productsSplit,
            { paddingHorizontal: padX, paddingBottom: kbHeight > 0 ? kbHeight : 0 },
            contentMaxWidth ? { alignItems: 'center' } : null,
          ]}
        >
          <View style={[styles.productsSplitInner, contentMaxWidth ? { maxWidth: contentMaxWidth, width: '100%' } : { width: '100%', flex: 1 }]}>
            <View style={styles.searchRow}>
              <Field
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={() => {
                  const code = search.trim();
                  const hit = books.products.find((p) => p.barcode && p.barcode.toLowerCase() === code.toLowerCase());
                  if (!hit) {
                    if (code) setError(t((m) => m.sale.scanNotFound).replace('{code}', code));
                    return;
                  }
                  setCart((current) => addProductToBill(current, hit, setError));
                  setSearch('');
                  setMode('products');
                }}
                placeholder={t((m) => m.sale.searchProducts)}
                autoCapitalize="none"
                style={styles.searchField}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t((m) => m.sale.scanBarcode)}
                onPress={() => setScannerOpen(true)}
                style={[styles.scanBtn, { backgroundColor: colors.brand }]}
              >
                <ScanIcon color={colors.onFill} size={20} />
                <Text style={[styles.scanBtnText, { color: colors.onFill }]}>{t((m) => m.sale.scanBarcode)}</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.productsScroll}
              contentContainerStyle={styles.productsScrollBody}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            >
              <View style={styles.grid}>
                {filteredProducts.map((product) => {
                  const kind = effectiveSellKind(product, kitchen.data.recipes);
                  const recipeOk = hasRecipe(product.id, kitchen.data.recipes);
                  const kindBadge = !isKitchenShop
                    ? null
                    : kind === 'simple'
                      ? 'Simple'
                      : recipeOk
                        ? 'Menu'
                        : 'Needs recipe';
                  return (
                    <ProductTile
                      key={product.id}
                      name={product.name}
                      price={productSellingPrice(product).toLocaleString('en-IN')}
                      stockLabel={product.stock > 0 ? `${product.stock} ${product.unit}` : '—'}
                      low={product.stock > 0 && product.stock <= 5}
                      out={product.stock <= 0}
                      qty={cart.find((l) => l.productId === product.id)?.qty ?? 0}
                      kindBadge={kindBadge}
                      onPress={() => setCart((lines) => addProductToBill(lines, product, setError))}
                    />
                  );
                })}
              </View>
              {!checkoutOpen ? <ErrorText message={error} /> : null}
              <TodaySalesHistory sales={books.sales} shopName={user?.shopName ?? 'KadaBook'} compact />
            </ScrollView>

            <View style={[styles.stickyCart, { backgroundColor: colors.white, borderTopColor: colors.hairline }]}>
              {cart.length === 0 ? (
                <Text style={styles.cartEmpty}>{t((m) => m.sale.cartEmpty)}</Text>
              ) : (
                <ScrollView
                  style={styles.stickyCartScroll}
                  contentContainerStyle={styles.stickyCartScrollBody}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                >
                  {isKitchenShop
                    ? (() => {
                        const missing = cart.filter((line) => {
                          if (!line.productId) return false;
                          const product = books.products.find((p) => p.id === line.productId);
                          if (!product) return false;
                          return (
                            effectiveSellKind(product, kitchen.data.recipes) === 'menu' &&
                            !hasRecipe(product.id, kitchen.data.recipes)
                          );
                        });
                        if (!missing.length) return null;
                        return (
                          <Text style={[styles.cartEmpty, { color: colors.expenseText, textAlign: 'left' }]}>
                            Menu without recipe: {missing.map((m) => m.name).join(', ')}. Add recipe in Kitchen →
                            Recipes, then Produce → To Foods so stock is ready.
                          </Text>
                        );
                      })()
                    : null}
                  {cart.map((line) => {
                    const product = books.products.find((p) => p.id === line.productId);
                    return (
                      <CartLineRow
                        key={line.productId ?? line.name}
                        line={line}
                        unit={product?.unit ?? ''}
                        maxQty={product ? product.stock : null}
                        onQty={(qty) => setLineQty(line, qty)}
                        onRemove={() => removeLine(line)}
                        onLimit={(msg) => setError(msg)}
                      />
                    );
                  })}
                </ScrollView>
              )}
              <View style={styles.billBar}>
                <Text style={styles.billTotal}>{formatRs(cartToPay)}</Text>
                <View style={styles.billActions}>
                  <FillButton
                    label={t((m) => m.sale.bill)}
                    color={colors.saleText}
                    onPress={openCheckout}
                    disabled={cart.length === 0}
                  />
                </View>
              </View>
              {cart.length > 0 ? holdButton : null}
              {noticeText}
            </View>
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
                <TodaySalesHistory sales={books.sales} shopName={user?.shopName ?? 'KadaBook'} compact />
              </>
            ) : null}
          </View>
        </ScrollView>
      )}
      <BarcodeScannerModal
        visible={scannerOpen}
        title={t((m) => m.sale.scanBarcode)}
        hint={t((m) => m.sale.scanHint)}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => {
          setScannerOpen(false);
          const hit = books.products.find((p) => p.barcode && p.barcode.toLowerCase() === code.toLowerCase());
          if (!hit) {
            setError(t((m) => m.sale.scanNotFound).replace('{code}', code));
            setSearch(code);
            return;
          }
          setCart((current) => addProductToBill(current, hit, setError));
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  modalTitle: {
    fontFamily: fonts.semibold,
    fontSize: 17,
  },
  modalHint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  modalActions: {
    gap: 10,
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
  dayBar: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  dayBarText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: c.hairline,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
  },
  tabText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
  },
  body: {
    paddingBottom: 20,
    gap: 12,
    flexGrow: 1,
  },
  quickBody: {
    flex: 1,
    paddingBottom: 12,
    justifyContent: 'flex-start',
  },
  quickContent: {
    flex: 1,
    justifyContent: 'flex-start',
    gap: 14,
  },
  content: {
    width: '100%',
    gap: 12,
  },
  branchTag: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    maxWidth: 110,
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
    // Breathing room between the amount pad keys and the save button.
    marginTop: 24,
  },
  notice: {
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: c.saleText,
  },
  close: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: c.brand,
  },
  recent: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: c.muted,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    width: '23%',
    flexGrow: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: c.keypad,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: c.ink,
  },
  quickHint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  calcPanel: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  calcPanelTitle: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calcEmpty: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    paddingVertical: 8,
  },
  calcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  calcRowNo: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    width: 28,
  },
  calcRowAmount: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  calcRemove: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calcRemoveText: {
    fontSize: 24,
  },
  calcTotalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 2,
    alignItems: 'center',
    gap: 4,
  },
  calcTotalLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  calcTotalValue: {
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  productsSplit: {
    flex: 1,
  },
  productsSplitInner: {
    flex: 1,
  },
  // Fixed height ≈ 2 tile rows so ~3–4 products show; rest scroll inside this pane.
  productsScroll: {
    height: 270,
    flexGrow: 0,
    flexShrink: 0,
  },
  productsScrollBody: {
    gap: 10,
    paddingBottom: 8,
  },
  stickyCart: {
    flex: 1,
    minHeight: 0,
    borderTopWidth: 1,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 8,
  },
  stickyCartScroll: {
    flex: 1,
    minHeight: 0,
  },
  stickyCartScrollBody: {
    gap: 4,
    paddingBottom: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  searchField: {
    flex: 1,
  },
  scanBtn: {
    minHeight: 52,
    minWidth: 88,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  scanBtnText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  productCard: {
    width: '48%',
    flexGrow: 1,
    minHeight: 96,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.hairline,
    padding: 10,
    gap: 4,
    backgroundColor: c.white,
  },
  productOut: {
    opacity: 0.45,
  },
  lowTag: {
    position: 'absolute',
    left: 0,
    top: 8,
    fontFamily: fonts.semibold,
    fontSize: 9,
    color: c.onFill,
    backgroundColor: c.danger,
    paddingHorizontal: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  productName: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: c.ink,
    marginTop: 4,
  },
  productPrice: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: c.saleText,
  },
  productStock: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.muted,
  },
  cartEmpty: {
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.muted,
  },
  cart: {
    borderWidth: 1,
    borderColor: c.hairline,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  cartRow: {
    gap: 2,
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
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: c.rowLine,
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
  savedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  savedText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  printBtn: {
    minHeight: 38,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  printBtnText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
};
}
