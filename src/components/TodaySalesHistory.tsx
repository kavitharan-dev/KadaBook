import { Alert, Pressable, Text, View } from 'react-native';
import type { Sale } from '../data/types';
import { useI18n } from '../context/LocaleContext';
import { formatRs, formatTime, isSameDay } from '../lib/format';
import { printOrShareReceipt } from '../lib/printReceipt';
import { saleSummaryLine } from '../lib/receipt';
import type { ColorPalette } from '../theme/palettes';
import { useStyleSheet } from '../theme/useStyleSheet';
import { fonts } from '../theme/fonts';

type TodaySalesHistoryProps = {
  sales: Sale[];
  shopName: string;
  compact?: boolean;
};

export function TodaySalesHistory({ sales, shopName, compact }: TodaySalesHistoryProps) {
  const { t } = useI18n();
  const styles = useStyleSheet(todaySalesHistoryStyles);
  const today = Date.now();
  const rows = sales
    .filter((sale) => isSameDay(sale.createdAt, today))
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt);

  if (rows.length === 0) return null;

  async function onPrint(sale: Sale) {
    const result = await printOrShareReceipt(shopName, sale);
    if (!result.ok) {
      Alert.alert(t((m) => m.settings.printFailed), result.message);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>{t((m) => m.sale.todayHistory)}</Text>
      {rows.map((sale) => (
        <View key={sale.id} style={[styles.row, compact && styles.rowCompact]}>
          <View style={styles.copy}>
            <Text style={styles.line1}>
              {sale.invoiceNo ? `${t((m) => m.sale.invoice)} ${sale.invoiceNo}` : formatTime(sale.createdAt)}
              {' · '}
              {formatRs(sale.amount)}
            </Text>
            <Text style={styles.line2}>
              {saleSummaryLine(sale)} · {formatTime(sale.createdAt)}
            </Text>
          </View>
          <Pressable onPress={() => onPrint(sale)} style={styles.print}>
            <Text style={styles.printText}>{t((m) => m.salesTab.print)}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function todaySalesHistoryStyles(c: ColorPalette) {
  return {
  wrap: {
    gap: 0,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: c.hairline,
    paddingTop: 12,
  },
  heading: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: c.muted,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: c.rowLine,
    paddingVertical: 4,
  },
  rowCompact: {
    minHeight: 48,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  line1: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: c.ink,
  },
  line2: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.muted,
  },
  print: {
    minHeight: 36,
    minWidth: 56,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  printText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: c.brand,
  },
};
}
