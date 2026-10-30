import { Modal, StyleSheet, Text, View } from 'react-native';
import { Field, FillButton } from './ui';
import { useI18n } from '../context/LocaleContext';
import { useTheme } from '../context/ThemeContext';
import { fonts } from '../theme/fonts';

type OpeningBalanceModalProps = {
  visible: boolean;
  value: string;
  onChangeValue: (text: string) => void;
  busy: boolean;
  onSkip: () => void;
  onSave: () => void;
};

export function OpeningBalanceModal({
  visible,
  value,
  onChangeValue,
  busy,
  onSkip,
  onSave,
}: OpeningBalanceModalProps) {
  const { t } = useI18n();
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
          <Text style={[styles.title, { color: colors.ink }]}>{t((m) => m.sale.openingTitle)}</Text>
          <Text style={[styles.hint, { color: colors.muted }]}>{t((m) => m.sale.openingHint)}</Text>
          <Field value={value} onChangeText={onChangeValue} placeholder="0" keyboardType="number-pad" />
          <View style={styles.actions}>
            <FillButton label={t((m) => m.sale.openingSkip)} onPress={onSkip} busy={busy} color={colors.line} />
            <FillButton label={t((m) => m.sale.openingSave)} onPress={onSave} busy={busy} color={colors.saleText} />
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
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 12,
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
  actions: {
    gap: 10,
  },
});
