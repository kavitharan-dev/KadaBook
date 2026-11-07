import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAvatar } from '../hooks/useAvatar';
import { PAYMENT_MODE_LABEL } from '../data/saleExtras';
import type { Sale } from '../data/types';
import { formatDay, formatRs, formatTime } from '../lib/format';
import { DEFAULT_RECEIPT_SETTINGS, loadReceiptSettings, type ReceiptSettings } from '../lib/receiptSettings';
import type { ColorPalette } from '../theme/palettes';
import { fonts } from '../theme/fonts';

/** Rupees without the "Rs." prefix, for the item columns. */
function money(value: number) {
  return Math.round(value).toLocaleString('en-IN');
}

/**
 * The saved bill, laid out like a shop receipt: shop name on top, bill info, item table,
 * totals, payment and the footer message from Receipt settings.
 */
export function BillReceipt({ sale, shopName }: { sale: Sale; shopName: string }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const avatar = useAvatar(user?.uid);
  const [settings, setSettings] = useState<ReceiptSettings>(DEFAULT_RECEIPT_SETTINGS);

  useEffect(() => {
    let alive = true;
    loadReceiptSettings()
      .then((loaded) => alive && setSettings(loaded))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const mode = sale.paymentMode ?? 'cash';
  const paid = mode === 'credit' ? sale.paidAmount ?? 0 : sale.amount;
  const balance = Math.max(0, sale.amount - paid);
  const discount = sale.discount;
  const off = discount?.amount ?? 0;
  const subtotal = sale.subtotal ?? sale.amount + off;
  const billNo = sale.invoiceNo ? `${settings.invoicePrefix}-${sale.invoiceNo}` : '—';
  // A quick sale has no items; show it as one line so the table never looks empty.
  const lines = sale.items?.length
    ? sale.items
    : [{ name: 'Sale amount', qty: 1, unitPrice: subtotal, lineTotal: subtotal }];
  const qtyTotal = lines.reduce((sum, l) => sum + l.qty, 0);

  const ink = { color: colors.ink };
  const muted = { color: colors.muted };
  const dash = <View style={[styles.dash, { borderColor: colors.line }]} />;
  const info = (label: string, value: string, alignRight?: boolean) => (
    <View style={[styles.infoCell, alignRight ? styles.infoRight : null]}>
      <Text style={[styles.infoLabel, muted]}>{label}</Text>
      <Text style={[styles.infoValue, ink]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
  const sumRow = (label: string, value: string, tone?: string) => (
    <View style={styles.sumRow}>
      <Text style={[styles.sumLabel, { color: tone ?? colors.muted }]}>{label}</Text>
      <Text style={[styles.sumValue, { color: tone ?? colors.ink }]}>{value}</Text>
    </View>
  );

  return (
    <View style={styles.wrap}>
      <SavedStrip colors={colors} />

      <View style={[styles.paper, { backgroundColor: colors.white, borderColor: colors.line }]}>
        {/* Shop header */}
        <View style={styles.header}>
          {avatar.uri ? (
            <Image source={{ uri: avatar.uri }} style={styles.logoImage} />
          ) : (
            <View style={[styles.logo, { backgroundColor: colors.brand }]}>
              <Text style={[styles.logoText, { color: colors.onFill }]}>{(shopName.trim()[0] ?? 'K').toUpperCase()}</Text>
            </View>
          )}
          <Text style={[styles.shopName, ink]} numberOfLines={2}>
            {shopName}
          </Text>
          {settings.shopLine.trim() ? (
            <Text style={[styles.shopLine, muted]} numberOfLines={2}>
              {settings.shopLine.trim()}
            </Text>
          ) : null}
          <View style={[styles.tag, { backgroundColor: colors.gradientTop }]}>
            <Text style={[styles.tagText, { color: colors.brand }]}>INVOICE</Text>
          </View>
        </View>

        {dash}

        {/* Bill info */}
        <View style={styles.infoRow}>
          {info('Bill No', billNo)}
          {info('Date', formatDay(sale.createdAt), true)}
        </View>
        <View style={styles.infoRow}>
          {info('Customer', sale.customerName || (sale.customerPhone ? 'Customer' : 'Walk-in'))}
          {info('Time', formatTime(sale.createdAt), true)}
        </View>
        {sale.customerPhone ? <View style={styles.infoRow}>{info('Phone', sale.customerPhone)}</View> : null}

        {dash}

        {/* Items */}
        <View style={[styles.tableHead, { backgroundColor: colors.keypad }]}>
          <Text style={[styles.th, styles.colItem, ink]}>Item</Text>
          <Text style={[styles.th, styles.colQty, ink]}>Qty</Text>
          <Text style={[styles.th, styles.colRate, ink]}>Rate</Text>
          <Text style={[styles.th, styles.colAmt, ink]}>Amount</Text>
        </View>
        {lines.map((line, i) => (
          <View key={`${line.name}-${i}`} style={[styles.tr, { borderBottomColor: colors.hairline }]}>
            <Text style={[styles.td, styles.colItem, ink]} numberOfLines={2}>
              {line.name}
            </Text>
            <Text style={[styles.td, styles.colQty, ink]}>{line.qty}</Text>
            <Text style={[styles.td, styles.colRate, muted]}>{money(line.unitPrice)}</Text>
            <Text style={[styles.tdStrong, styles.colAmt, ink]}>{money(line.lineTotal)}</Text>
          </View>
        ))}
        <Text style={[styles.count, muted]}>
          {lines.length} item{lines.length === 1 ? '' : 's'} · Qty {qtyTotal}
        </Text>

        {dash}

        {/* Totals */}
        {off > 0 ? sumRow('Subtotal', formatRs(subtotal)) : null}
        {off > 0
          ? sumRow(discount?.type === 'percent' ? `Discount (${discount.value}%)` : 'Discount', `− ${formatRs(off)}`, colors.saleText)
          : null}
        <View style={[styles.totalBand, { backgroundColor: colors.ink }]}>
          <Text style={[styles.totalLabel, { color: colors.white }]}>TOTAL</Text>
          <Text style={[styles.totalValue, { color: colors.white }]} numberOfLines={1} adjustsFontSizeToFit>
            {formatRs(sale.amount)}
          </Text>
        </View>

        {/* Payment */}
        <View style={styles.sumRow}>
          <Text style={[styles.sumLabel, muted]}>Paid by</Text>
          <View style={[styles.chip, { backgroundColor: mode === 'credit' ? colors.expenseWash : colors.saleWash }]}>
            <Text style={[styles.chipText, { color: mode === 'credit' ? colors.expenseText : colors.saleText }]}>
              {PAYMENT_MODE_LABEL[mode]}
            </Text>
          </View>
        </View>
        {sumRow('Received', formatRs(paid))}
        {balance > 0 ? (
          <View style={[styles.due, { backgroundColor: colors.expenseWash, borderColor: colors.expenseText }]}>
            <Text style={[styles.dueLabel, { color: colors.expenseText }]}>Balance due · credit book</Text>
            <Text style={[styles.dueValue, { color: colors.expenseText }]}>{formatRs(balance)}</Text>
          </View>
        ) : null}

        {dash}

        {/* Footer */}
        <Text style={[styles.footer, ink]}>{settings.footerLine.trim() || 'Thank you!'}</Text>
        <Text style={[styles.powered, muted]}>Powered by SMART [PVT] LTD</Text>
      </View>
    </View>
  );
}

/** "✓ Sale saved" strip above the bill; the tick pops in once. */
function SavedStrip({ colors }: { colors: ColorPalette }): ReactNode {
  const scale = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }).start();
  }, [scale]);
  return (
    <View style={[styles.saved, { backgroundColor: colors.saleWash }]}>
      <Animated.View style={[styles.tick, { backgroundColor: colors.sale, transform: [{ scale }] }]}>
        <Text style={[styles.tickText, { color: colors.onFill }]}>✓</Text>
      </Animated.View>
      <Text style={[styles.savedText, { color: colors.saleText }]}>Sale saved successfully</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  saved: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'center',
  },
  tick: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tickText: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 16 },
  savedText: { fontFamily: fonts.semibold, fontSize: 13 },

  paper: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 16, gap: 8 },
  header: { alignItems: 'center', gap: 4 },
  logo: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  logoImage: { width: 44, height: 44, borderRadius: 22, marginBottom: 4 },
  logoText: { fontFamily: fonts.bold, fontSize: 20 },
  shopName: { fontFamily: fonts.bold, fontSize: 20, textAlign: 'center', letterSpacing: 0.3 },
  shopLine: { fontFamily: fonts.regular, fontSize: 12, textAlign: 'center', lineHeight: 16 },
  tag: { marginTop: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.5 },

  dash: { borderTopWidth: 1, borderStyle: 'dashed', marginVertical: 4 },

  infoRow: { flexDirection: 'row', gap: 12 },
  infoCell: { flex: 1, gap: 1 },
  infoRight: { alignItems: 'flex-end' },
  infoLabel: { fontFamily: fonts.regular, fontSize: 11 },
  infoValue: { fontFamily: fonts.semibold, fontSize: 13 },

  tableHead: { flexDirection: 'row', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 8 },
  th: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.3 },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  td: { fontFamily: fonts.regular, fontSize: 13 },
  tdStrong: { fontFamily: fonts.semibold, fontSize: 13 },
  colItem: { flex: 1, paddingRight: 6 },
  colQty: { width: 34, textAlign: 'center' },
  colRate: { width: 58, textAlign: 'right' },
  colAmt: { width: 70, textAlign: 'right' },
  count: { fontFamily: fonts.regular, fontSize: 11, textAlign: 'right', paddingHorizontal: 8 },

  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 24, paddingHorizontal: 2 },
  sumLabel: { fontFamily: fonts.regular, fontSize: 13 },
  sumValue: { fontFamily: fonts.semibold, fontSize: 14 },
  totalBand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginVertical: 4,
  },
  totalLabel: { fontFamily: fonts.bold, fontSize: 14, letterSpacing: 1.5 },
  totalValue: { fontFamily: fonts.bold, fontSize: 22, flexShrink: 1, marginLeft: 12 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { fontFamily: fonts.semibold, fontSize: 12 },
  due: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 2,
  },
  dueLabel: { fontFamily: fonts.semibold, fontSize: 12 },
  dueValue: { fontFamily: fonts.bold, fontSize: 16 },

  footer: { fontFamily: fonts.semibold, fontSize: 13, textAlign: 'center', marginTop: 2 },
  powered: { fontFamily: fonts.regular, fontSize: 10, textAlign: 'center', letterSpacing: 0.4 },
});
