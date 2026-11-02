import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  type StyleProp,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/LocaleContext';
import type { Sale } from '../data/types';
import { formatRs } from '../lib/format';
import type { PrintPhase } from '../lib/usePrintFeedback';
import { BillReceipt } from './BillReceipt';
import { PrintButton } from './PrintButton';
import { ErrorText, FillButton } from './ui';
import { fonts } from '../theme/fonts';

export type CheckoutTotals = { subtotal: number; off: number; toPay: number; creditBalance: number };

/**
 * The checkout bottom sheet. Step 1: customer and payment, then save.
 * Step 2: the saved bill with "New sale" and "Print".
 */
export function SaleCheckoutModal({
  visible,
  done,
  sale,
  totals,
  panel,
  busy,
  error,
  printPhase,
  onConfirm,
  onClose,
  onNewSale,
  onPrint,
  toast,
  shopName,
}: {
  visible: boolean;
  /** True once the sale is saved: shows the bill instead of the form. */
  done: boolean;
  /** The saved sale, once it shows up in the books. */
  sale: Sale | null;
  /** Live totals from the form, for the amount at the top. */
  totals: CheckoutTotals;
  /** The customer and payment panel. */
  panel: ReactNode;
  busy: boolean;
  error: string | null;
  printPhase: PrintPhase;
  onConfirm: () => void;
  onClose: () => void;
  onNewSale: () => void;
  onPrint: () => void;
  /** The screen toast, drawn inside the Modal so it shows above the sheet. */
  toast?: ReactNode;
  /** Printed at the top of the bill. */
  shopName: string;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef<any>(null);
  const contentRef = useRef<any>(null);
  const [kb, setKb] = useState(0);

  // The Modal window does not shrink for the keyboard (edge-to-edge Android), so lift the sheet
  // by the keyboard height and scroll the field being typed in into view.
  useEffect(() => {
    if (!visible) return;
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      setKb(e.endCoordinates.height);
      setTimeout(revealFocused, ios ? 250 : 80);
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setKb(0));
    return () => {
      show.remove();
      hide.remove();
      setKb(0);
    };
  }, [visible]);

  function revealFocused() {
    const input = TextInput.State.currentlyFocusedInput?.();
    const content = contentRef.current;
    if (!input || !content) return;
    try {
      input.measureLayout(
        content,
        (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 90), animated: true }),
        () => scrollRef.current?.scrollToEnd({ animated: true }),
      );
    } catch {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }

  const sheetMaxHeight = windowHeight - kb - insets.top - 12;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={done ? onNewSale : onClose}>
      <View style={[styles.backdrop, done ? styles.backdropCenter : null]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={done ? undefined : onClose} />
        {done ? (
          // Saved bill: a centered card that zooms in.
          <PopIn style={[styles.popup, { backgroundColor: colors.white, maxHeight: windowHeight - insets.top - insets.bottom - 32 }]}>
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              {sale ? <BillReceipt sale={sale} shopName={shopName} /> : <ActivityIndicator color={colors.brand} style={styles.wait} />}
            </ScrollView>
            <View style={styles.actions}>
              <View style={styles.flex}>
                {sale ? (
                  <PrintButton phase={printPhase} onPress={onPrint} label={`🖨  ${t((m) => m.salesTab.print)}`} large />
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={onNewSale}
                style={({ pressed }) => [
                  styles.newBtn,
                  { borderColor: colors.brand, backgroundColor: pressed ? colors.keypad : 'transparent' },
                ]}
              >
                <Text style={[styles.newText, { color: colors.brand }]}>＋ {t((m) => m.sale.newSale)}</Text>
              </Pressable>
            </View>
          </PopIn>
        ) : (
        <View style={[
            styles.sheet,
            {
              backgroundColor: colors.white,
              marginBottom: kb,
              maxHeight: sheetMaxHeight,
              paddingBottom: kb > 0 ? 12 : 16 + insets.bottom,
            },
          ]}>
          <View style={[styles.handle, { backgroundColor: colors.line }]} />
            <>
              <View style={styles.head}>
                <Text style={[styles.kicker, { color: colors.muted }]}>{t((m) => m.sale.checkoutTitle)}</Text>
                <Pressable
                  onPress={onClose}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  style={[styles.close, { backgroundColor: colors.keypad }]}
                >
                  <Text style={[styles.closeText, { color: colors.muted }]}>✕</Text>
                </Pressable>
              </View>
              <ScrollView
                ref={scrollRef}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View ref={contentRef} collapsable={false} style={styles.body}>
                  <AmountHero totals={totals} compact={kb > 0} />
                  {panel}
                  <ErrorText message={error} />
                </View>
              </ScrollView>
              <FillButton
                label={`${t((m) => m.sale.checkoutConfirm)} · ${formatRs(totals.toPay)}`}
                color={colors.sale}
                onPress={onConfirm}
                busy={busy}
              />
            </>
        </View>
        )}
      </View>
      {toast}
    </Modal>
  );
}

/** Big "To pay" amount, with the received / credit split once part of it goes on credit. */
function AmountHero({ totals, compact }: { totals: CheckoutTotals; compact?: boolean }) {
  const { colors } = useTheme();
  const { subtotal, off, toPay, creditBalance } = totals;
  return (
    <View style={[styles.hero, { backgroundColor: colors.gradientTop, borderColor: colors.hairline }]}>
      <Text style={[styles.heroLabel, { color: colors.muted }]}>TO PAY</Text>
      <Text
        style={[styles.heroAmount, compact ? styles.heroAmountSmall : null, { color: colors.ink }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {formatRs(toPay)}
      </Text>
      {off > 0 ? (
        <Text style={[styles.heroNote, { color: colors.muted }]}>
          <Text style={styles.strike}>{formatRs(subtotal)}</Text> · {formatRs(off)} off
        </Text>
      ) : null}
      {creditBalance > 0 ? (
        <View style={styles.pills}>
          <Pill label="Received" value={formatRs(toPay - creditBalance)} bg={colors.saleWash} fg={colors.saleText} />
          <Pill label="To credit book" value={formatRs(creditBalance)} bg={colors.expenseWash} fg={colors.expenseText} />
        </View>
      ) : null}
    </View>
  );
}

function Pill({ label, value, bg, fg }: { label: string; value: string; bg: string; fg: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillLabel, { color: fg }]}>{label}</Text>
      <Text style={[styles.pillValue, { color: fg }]}>{value}</Text>
    </View>
  );
}

/** Fades and zooms its card in when it first appears. */
function PopIn({ style, children }: { style: StyleProp<ViewStyle>; children: ReactNode }) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 110, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);
  return <Animated.View style={[style, { opacity, transform: [{ scale }] }]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.55)' },
  sheet: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 8,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  backdropCenter: { justifyContent: 'center', paddingHorizontal: 16 },
  popup: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: 24,
    padding: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 18,
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: 2 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { fontFamily: fonts.semibold, fontSize: 14 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 14, fontFamily: fonts.bold },
  body: { gap: 12, paddingBottom: 4 },
  wait: { paddingVertical: 48 },

  hero: { borderRadius: 18, borderWidth: 1, paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center', gap: 2 },
  heroLabel: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.2 },
  heroAmount: { fontFamily: fonts.bold, fontSize: 38 },
  heroAmountSmall: { fontSize: 26 },
  heroNote: { fontFamily: fonts.regular, fontSize: 13 },
  strike: { textDecorationLine: 'line-through' },
  pills: { flexDirection: 'row', gap: 8, marginTop: 10, alignSelf: 'stretch' },
  pill: { flex: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center' },
  pillLabel: { fontFamily: fonts.semibold, fontSize: 11 },
  pillValue: { fontFamily: fonts.bold, fontSize: 16 },

  actions: { flexDirection: 'row', gap: 10 },
  newBtn: {
    flex: 1,
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newText: { fontFamily: fonts.semibold, fontSize: 16 },

  bill: { gap: 14 },
  success: { alignItems: 'center', gap: 4, paddingTop: 6 },
  badgeRing: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  badge: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  badgeTick: { fontSize: 28, fontFamily: fonts.bold, lineHeight: 32 },
  successTitle: { fontFamily: fonts.semibold, fontSize: 16 },
  successAmount: { fontFamily: fonts.bold, fontSize: 34 },
  meta: { fontFamily: fonts.regular, fontSize: 12 },

  receipt: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 8 },
  receiptTitle: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.2, marginBottom: 2 },
  customer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.bold, fontSize: 16 },
  customerName: { fontFamily: fonts.semibold, fontSize: 15 },
  dashed: { borderTopWidth: 1, borderStyle: 'dashed', marginVertical: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, minHeight: 24 },
  rowLabel: { fontFamily: fonts.regular, fontSize: 13 },
  rowValue: { fontFamily: fonts.semibold, fontSize: 14 },
  itemName: { flex: 1, fontFamily: fonts.regular, fontSize: 14 },
  totalLabel: { fontFamily: fonts.bold, fontSize: 16 },
  totalValue: { fontFamily: fonts.bold, fontSize: 18 },
  modeChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  modeText: { fontFamily: fonts.semibold, fontSize: 12 },
  due: {
    marginTop: 4,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dueLabel: { fontFamily: fonts.semibold, fontSize: 13 },
  dueValue: { fontFamily: fonts.bold, fontSize: 16 },
});
