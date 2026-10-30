import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Header, Screen } from '../components/ui';
import { useI18n } from '../context/LocaleContext';
import { useTheme } from '../context/ThemeContext';
import type { Messages } from '../i18n';
import { fonts } from '../theme/fonts';

const SECTIONS: { title: (m: Messages) => string; body: (m: Messages) => string }[] = [
  { title: (m) => m.tips.endSaleTitle, body: (m) => m.tips.endSaleBody },
  { title: (m) => m.tips.reportsTitle, body: (m) => m.tips.reportsBody },
  { title: (m) => m.tips.stockTitle, body: (m) => m.tips.stockBody },
  { title: (m) => m.tips.printTitle, body: (m) => m.tips.printBody },
  { title: (m) => m.tips.phoneTitle, body: (m) => m.tips.phoneBody },
  { title: (m) => m.tips.receiptTitle, body: (m) => m.tips.receiptBody },
  { title: (m) => m.tips.langTitle, body: (m) => m.tips.langBody },
];

export function TipsScreen() {
  const navigation = useNavigation();
  const { t, messages } = useI18n();
  const { colors } = useTheme();

  return (
    <Screen>
      <Header title={t((m) => m.tips.title)} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        {SECTIONS.map((section, index) => (
          <View
            key={index}
            style={[styles.card, { borderColor: colors.hairline, backgroundColor: colors.white }]}
          >
            <Text style={[styles.cardTitle, { color: colors.ink }]}>{section.title(messages)}</Text>
            <Text style={[styles.cardBody, { color: colors.muted }]}>{section.body(messages)}</Text>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: 16,
    gap: 12,
    paddingBottom: 28,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  cardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  cardBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
});
