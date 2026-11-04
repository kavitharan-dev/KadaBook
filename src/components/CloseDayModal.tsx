import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FillButton } from './ui';
import { PrintButton } from './PrintButton';
import { useI18n } from '../context/LocaleContext';
import { useTheme } from '../context/ThemeContext';
import { formatRs } from '../lib/format';
import type { DayCloseSummary } from '../lib/dayClose';
import type { PrintPhase } from '../lib/usePrintFeedback';
import { fonts } from '../theme/fonts';

type CloseDayModalProps = {
  visible: boolean;
  summary: DayCloseSummary;
  alreadyClosed: boolean;
  busy: boolean;
  printPhase?: PrintPhase;
  sharePhase?: PrintPhase;
  onClose: () => void;
  onPrint: () => void;
  onWhatsApp: () => void;
  onConfirmClose: () => void;
  onResume: () => void;
};

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: strong ? colors.ink : colors.muted }, strong && styles.rowStrong]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.ink }, strong && styles.rowStrong]}>{value}</Text>
    </View>
  );
}

function SectionLabel({ label }: { label: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.section, { color: colors.brand }]}>{label}</Text>;
}

export function CloseDayModal({
  visible,
  summary,
  alreadyClosed,
  busy,
  printPhase = 'idle',
  sharePhase = 'idle',
  onClose,
  onPrint,
  onWhatsApp,
  onConfirmClose,
  onResume,
}: CloseDayModalProps) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const actionBusy = busy || printPhase === 'printing' || sharePhase === 'printing';
  const shareLabel =
    sharePhase === 'printing'
      ? t((m) => m.reportsTab.sharing)
      : sharePhase === 'done'
        ? t((m) => m.reportsTab.shared)
        : sharePhase === 'error'
          ? t((m) => m.reportsTab.retryShare)
          : t((m) => m.home.closeWhatsApp);
  const netLabel =
    summary.netProfit < 0 ? t((m) => m.home.closeNetLoss) : t((m) => m.home.closeNetProfit);
  const netValue =
    summary.netProfit < 0 ? `− ${formatRs(Math.abs(summary.netProfit))}` : formatRs(summary.netProfit);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
          <Text style={[styles.title, { color: colors.ink }]}>
            {alreadyClosed ? t((m) => m.home.dayClosedTitle) : t((m) => m.home.closeDayTitle)}
          </Text>
          <Text style={[styles.hint, { color: colors.muted }]}>{summary.dateLabel}</Text>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner} showsVerticalScrollIndicator={false}>
            <SectionLabel label={t((m) => m.home.closeSectionSales)} />
            <Row label={t((m) => m.home.closeProductSales)} value={formatRs(summary.productSales)} />
            <Row label={t((m) => m.home.closeQuickSales)} value={formatRs(summary.quickSales)} />
            <Row label={t((m) => m.home.closeTotalSales)} value={formatRs(summary.totalSales)} strong />
            <Row label={t((m) => m.home.closeCardSales)} value={formatRs(summary.cardSales)} />
            <Row label={t((m) => m.home.closeCashSales)} value={formatRs(summary.cashSales)} />

            <View style={[styles.divider, { backgroundColor: colors.hairline }]} />
            <SectionLabel label={t((m) => m.home.closeSectionCredit)} />
            <Row label={t((m) => m.home.closeCreditSales)} value={formatRs(summary.creditSales)} />
            <Row label={t((m) => m.home.closeCreditCollected)} value={formatRs(summary.creditCollected)} />

            <View style={[styles.divider, { backgroundColor: colors.hairline }]} />
            <SectionLabel label={t((m) => m.home.closeSectionExpenses)} />
            <Row label={t((m) => m.home.closeOperating)} value={formatRs(summary.operatingExpenses)} />
            <Row label={t((m) => m.home.closeStockPurchase)} value={formatRs(summary.stockPurchase)} />
            <Row label={t((m) => m.home.closeTotalExpenses)} value={formatRs(summary.totalExpenses)} strong />

            <View style={[styles.divider, { backgroundColor: colors.hairline }]} />
            <SectionLabel label={t((m) => m.home.closeSectionProfit)} />
            <Row label={t((m) => m.home.closeProductProfit)} value={formatRs(summary.productProfit)} />
            <Row
              label={t((m) => m.home.closeQuickProfit, { percent: summary.quickProfitPercent })}
              value={formatRs(summary.quickProfit)}
            />
            <Row label={t((m) => m.home.closeGrossProfit)} value={formatRs(summary.grossProfit)} />
            <Row label={t((m) => m.home.closeOperatingMinus)} value={formatRs(summary.operatingExpenses)} />
            <Row label={netLabel} value={netValue} strong />
            <Text style={[styles.formula, { color: colors.muted }]}>{t((m) => m.home.closeNetProfitHint)}</Text>

            <View style={[styles.divider, { backgroundColor: colors.hairline }]} />
            <SectionLabel label={t((m) => m.home.closeSectionCash)} />
            <Row label={t((m) => m.home.closeOpeningCash)} value={formatRs(summary.openingCash)} />
            <Row label={t((m) => m.home.closeCashSales)} value={formatRs(summary.cashSales)} />
            <Row label={t((m) => m.home.closeCreditCollected)} value={formatRs(summary.creditCollected)} />
            <Row label={t((m) => m.home.closeTotalExpenses)} value={formatRs(summary.totalExpenses)} />
            <Row label={t((m) => m.home.closeExpectedCash)} value={formatRs(summary.expectedCash)} strong />
            <Text style={[styles.formula, { color: colors.muted }]}>{t((m) => m.home.closeExpectedCashHint)}</Text>
          </ScrollView>
          <View style={styles.actions}>
            <PrintButton large phase={printPhase} label={t((m) => m.home.closePrint)} onPress={onPrint} />
            <FillButton
              label={shareLabel}
              onPress={onWhatsApp}
              busy={sharePhase === 'printing'}
              color={sharePhase === 'error' ? colors.expenseText : colors.brand}
            />
            {alreadyClosed ? (
              <FillButton label={t((m) => m.home.resumeSales)} onPress={onResume} busy={actionBusy} color={colors.line} />
            ) : (
              <FillButton label={t((m) => m.home.confirmCloseDay)} onPress={onConfirmClose} busy={actionBusy} color={colors.expenseText} />
            )}
            <FillButton label={t((m) => m.home.closeDismiss)} onPress={onClose} busy={actionBusy} color={colors.line} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '88%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 17,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  scroll: {
    maxHeight: 340,
  },
  scrollInner: {
    gap: 8,
    paddingVertical: 4,
  },
  section: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 0.4,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  rowLabel: {
    fontFamily: fonts.regular,
    fontSize: 14,
    flex: 1,
  },
  rowValue: {
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  rowStrong: {
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  formula: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  actions: {
    gap: 8,
    marginTop: 4,
  },
});
