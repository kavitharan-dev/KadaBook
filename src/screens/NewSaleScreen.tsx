import { useMemo, useState, useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AmountPad } from '../components/AmountPad';
import { TodaySalesHistory } from '../components/TodaySalesHistory';
import { ErrorText, Field, FillButton, Header, Screen } from '../components/ui';
import { AccessBlockedModal } from '../components/GateModals';
import { useAuth } from '../context/AuthContext';
import { useShopGate } from '../context/ShopGateContext';
import { useBooks } from '../context/BooksContext';
import { useI18n } from '../context/LocaleContext';
import type { Product, SaleLine } from '../data/types';
import { productSellingPrice } from '../lib/booksNormalize';
import { formatRs } from '../lib/format';
import { closeToDashboard } from '../lib/navigation';
import { billTotal } from '../lib/saleOps';
import { useResponsive } from '../lib/useResponsive';
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
  const { canAccess } = useShopGate();
  const [blockedOpen, setBlockedOpen] = useState(false);
  const { t } = useI18n();
  const { books, addQuickSale, checkoutBill, saveOrder, deleteSavedOrder } = useBooks();
  const { colors } = useTheme();
  const { contentMaxWidth, padX, keySize } = useResponsive();
  const [mode, setMode] = useState<SaleMode>('quick');
  const [amount, setAmount] = useState('');
  const [calcStack, setCalcStack] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<SaleLine[]>([]);

  const cartTotal = billTotal(cart);
  const calcStackTotal = calcStack.reduce((a, b) => a + b, 0);
  const padAmount = Math.round(Number(amount) || 0);
  const saveTotal = calcStack.length > 0 ? calcStackTotal : padAmount;

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

  useEffect(() => {
    if (!canAccess('addSale')) setBlockedOpen(true);
  }, [canAccess]);

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
    try {
      await addQuickSale(total);
      setCalcStack([]);
      setAmount('');
      setNotice(t((m) => m.sale.saved));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t((m) => m.sale.errorSave));
    } finally {
      setBusy(false);
    }
  }

  async function billCart() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await checkoutBill(cart);
      setCart([]);
      setNotice(t((m) => m.sale.saved));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t((m) => m.sale.errorSave));
    } finally {
      setBusy(false);
    }
  }

  async function saveCartOrder() {
    setError(null);
    setBusy(true);
    try {
      await saveOrder(cart);
      setNotice(t((m) => m.sale.saveOrder));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t((m) => m.sale.errorSave));
    } finally {
      setBusy(false);
    }
  }

  const tabs: { key: SaleMode; label: string }[] = [
    { key: 'products', label: t((m) => m.sale.tabProducts) },
    { key: 'quick', label: t((m) => m.sale.tabQuick) },
    { key: 'saved', label: t((m) => m.sale.tabSaved) },
  ];

  return (
    <Screen>
      <AccessBlockedModal visible={blockedOpen} onClose={() => { setBlockedOpen(false); closeToDashboard(navigation); }} />
      <Header title={t((m) => m.sale.title)} onBack={() => closeToDashboard(navigation)} />
      <View style={[styles.tabs, { paddingHorizontal: Math.max(12, padX - 4), borderBottomColor: colors.hairline }]}>
        {tabs.map((tab) => {
          const on = tab.key === mode;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setMode(tab.key)}
              style={[styles.tab, { borderBottomColor: on ? colors.brand : 'transparent' }]}
            >
              <Text style={[styles.tabText, { color: on ? colors.brand : colors.muted }]} numberOfLines={1}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {mode === 'quick' ? (
        <View
          style={[
            styles.quickBody,
            { paddingHorizontal: padX, alignItems: contentMaxWidth ? 'center' : undefined },
          ]}
        >
          <View
            style={[
              styles.content,
              styles.quickContent,
              contentMaxWidth ? { maxWidth: contentMaxWidth, width: '100%' } : undefined,
            ]}
          >
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
            <FillButton
              label={t((m) => m.sale.calcSave)}
              color={colors.saleText}
              onPress={() => saveQuick()}
              busy={busy}
              disabled={saveTotal <= 0}
            />
            {notice ? <Text style={[styles.notice, { color: colors.saleText }]}>{notice}</Text> : null}
            <ErrorText message={error} />
            <Pressable onPress={() => closeToDashboard(navigation)} style={[styles.close, { borderColor: colors.line }]}>
              <Text style={[styles.closeText, { color: colors.brand }]}>{t((m) => m.common.closeDashboard)}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
      <ScrollView
        contentContainerStyle={[styles.body, { paddingHorizontal: padX, alignItems: contentMaxWidth ? 'center' : undefined }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.content, contentMaxWidth ? { maxWidth: contentMaxWidth, width: '100%' } : undefined]}>
        {mode === 'products' ? (
          <>
            <Field value={search} onChangeText={setSearch} placeholder={t((m) => m.sale.searchProducts)} />
            <View style={styles.grid}>
              {filteredProducts.map((product) => {
                const out = product.stock <= 0;
                const low = product.stock > 0 && product.stock <= 5;
                return (
                  <Pressable
                    key={product.id}
                    onPress={() => setCart((lines) => addProductToBill(lines, product, setError))}
                    style={[styles.productCard, out && styles.productOut]}
                    disabled={out}
                  >
                    {low ? <Text style={styles.lowTag}>Low</Text> : null}
                    <Text style={styles.productName} numberOfLines={2}>
                      {product.name}
                    </Text>
                    <Text style={styles.productPrice}>{productSellingPrice(product).toLocaleString('en-IN')}</Text>
                    <Text style={styles.productStock}>
                      {product.stock > 0 ? `${product.stock} ${product.unit}` : '—'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {cart.length === 0 ? (
              <Text style={styles.cartEmpty}>{t((m) => m.sale.cartEmpty)}</Text>
            ) : (
              <View style={styles.cart}>
                {cart.map((line) => (
                  <View key={line.productId ?? line.name} style={styles.cartRow}>
                    <Text style={styles.cartName} numberOfLines={1}>
                      {line.name}
                    </Text>
                    <Text style={styles.cartMeta}>
                      {line.qty} × {line.unitPrice} = {line.lineTotal}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.billBar}>
              <Text style={styles.billTotal}>{formatRs(cartTotal)}</Text>
              <View style={styles.billActions}>
                <FillButton
                  label={t((m) => m.sale.bill)}
                  color={colors.saleText}
                  onPress={() => billCart()}
                  busy={busy}
                  disabled={cart.length === 0}
                />
              </View>
            </View>
            {cart.length > 0 ? (
              <Pressable onPress={() => saveCartOrder()} style={styles.secondary}>
                <Text style={styles.secondaryText}>{t((m) => m.sale.saveOrder)}</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}

        {mode === 'saved' ? (
          <>
            {books.savedOrders.length === 0 ? (
              <Text style={styles.cartEmpty}>{t((m) => m.sale.savedOrdersEmpty)}</Text>
            ) : (
              books.savedOrders.map((order) => (
                <View key={order.id} style={styles.savedRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartName}>{formatRs(order.total)}</Text>
                    <Text style={styles.cartMeta}>{order.items.length} item(s)</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      setCart(order.items);
                      setMode('products');
                      setError(null);
                    }}
                    style={styles.loadBtn}
                  >
                    <Text style={styles.loadBtnText}>{t((m) => m.sale.loadOrder)}</Text>
                  </Pressable>
                  <Pressable onPress={() => deleteSavedOrder(order.id)} style={styles.deleteBtn}>
                    <Text style={styles.deleteBtnText}>×</Text>
                  </Pressable>
                </View>
              ))
            )}
          </>
        ) : null}

        <ErrorText message={error} />
        <Pressable onPress={() => closeToDashboard(navigation)} style={[styles.close, { borderColor: colors.line }]}>
          <Text style={[styles.closeText, { color: colors.brand }]}>{t((m) => m.common.closeDashboard)}</Text>
        </Pressable>

        <TodaySalesHistory sales={books.sales} shopName={user?.shopName ?? 'KadaBook'} compact />
        </View>
      </ScrollView>
      )}
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
};
}
