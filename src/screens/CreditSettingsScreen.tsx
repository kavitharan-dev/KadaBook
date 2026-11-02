import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Toast, useToast } from '../components/Toast';
import { FillButton, Header, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  DEFAULT_CREDIT_SETTINGS,
  TEMPLATE_TAGS,
  fillTemplate,
  loadCreditSettings,
  saveCreditSettings,
  type CreditSettings,
} from '../lib/creditSettings';
import { formatDay, formatRs } from '../lib/format';
import { waMe } from '../lib/shopPlus';
import { fonts } from '../theme/fonts';

/** Credit book messages: the shop's WhatsApp number and the reminder / receipt texts. */
export function CreditSettingsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const [settings, setSettings] = useState<CreditSettings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadCreditSettings().then(setSettings);
  }, []);

  if (!settings) return null;

  const phoneDigits = settings.shopWhatsApp.replace(/\D/g, '');
  const phoneBad = phoneDigits.length > 0 && phoneDigits.length < 9;
  const sample = {
    customer: 'Kumar',
    amount: formatRs(3000),
    paid: formatRs(2000),
    shop: user?.shopName ?? 'My Shop',
    shopPhone: settings.shopWhatsApp.trim(),
    date: formatDay(Date.now()),
  };

  function patch(next: Partial<CreditSettings>) {
    setSettings((s) => (s ? { ...s, ...next } : s));
  }

  async function save() {
    if (!settings) return;
    if (phoneBad) {
      toast.show('error', 'Enter a full WhatsApp number (at least 9 digits).');
      return;
    }
    setBusy(true);
    try {
      await saveCreditSettings({ ...settings, shopWhatsApp: settings.shopWhatsApp.trim() });
      toast.show('success', 'Credit & WhatsApp settings saved');
    } catch {
      toast.show('error', 'Could not save the settings.');
    } finally {
      setBusy(false);
    }
  }

  async function testNumber() {
    if (phoneDigits.length < 9) {
      toast.show('error', 'Enter the shop WhatsApp number first.');
      return;
    }
    try {
      await Linking.openURL(waMe(settings!.shopWhatsApp, fillTemplate(settings!.reminderTemplate, sample)));
    } catch {
      toast.show('error', 'Could not open WhatsApp on this phone.');
    }
  }

  return (
    <Screen>
      <Header title="Credit & WhatsApp" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* Shop number */}
        <View style={[styles.card, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
          <View style={styles.cardHead}>
            <View style={[styles.badge, { backgroundColor: colors.saleWash }]}>
              <Text style={styles.badgeIcon}>💬</Text>
            </View>
            <View style={styles.flex}>
              <Text style={[styles.cardTitle, { color: colors.ink }]}>Shop WhatsApp number</Text>
              <Text style={[styles.cardSub, { color: colors.muted }]}>
                Shown in reminders and receipts so customers can reply or call. Leave empty to hide it.
              </Text>
            </View>
          </View>
          <View style={styles.phoneRow}>
            <TextInput
              value={settings.shopWhatsApp}
              onChangeText={(text) => patch({ shopWhatsApp: text.replace(/[^\d+ ]/g, '').slice(0, 18) })}
              placeholder="0771234567"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              style={[
                styles.input,
                styles.flex,
                { borderColor: phoneBad ? colors.expenseText : colors.line, color: colors.ink },
              ]}
            />
            <Pressable onPress={testNumber} style={[styles.testBtn, { backgroundColor: colors.keypad }]}>
              <Text style={[styles.testText, { color: colors.brand }]}>Test</Text>
            </Pressable>
          </View>
          {phoneBad ? (
            <Text style={[styles.cardSub, { color: colors.expenseText }]}>At least 9 digits.</Text>
          ) : null}
        </View>

        <TemplateCard
          icon="⏰"
          title="Reminder message"
          sub="Sent from a customer's page in the credit book."
          value={settings.reminderTemplate}
          onChange={(v) => patch({ reminderTemplate: v })}
          onReset={() => patch({ reminderTemplate: DEFAULT_CREDIT_SETTINGS.reminderTemplate })}
          preview={fillTemplate(settings.reminderTemplate, sample)}
        />

        <TemplateCard
          icon="🧾"
          title="Payment receipt message"
          sub="Sent after you collect a payment. {paid} is what they paid, {amount} is what is left."
          value={settings.receiptTemplate}
          onChange={(v) => patch({ receiptTemplate: v })}
          onReset={() => patch({ receiptTemplate: DEFAULT_CREDIT_SETTINGS.receiptTemplate })}
          preview={fillTemplate(settings.receiptTemplate, sample)}
        >
          <View style={styles.switchRow}>
            <Text style={[styles.switchText, { color: colors.ink }]}>Offer to send after collecting a payment</Text>
            <Switch
              value={settings.offerReceipt}
              onValueChange={(v) => patch({ offerReceipt: v })}
              trackColor={{ true: colors.sale, false: colors.line }}
              thumbColor={colors.onFill}
            />
          </View>
        </TemplateCard>

        <FillButton label="Save settings" color={colors.saleText} onPress={save} busy={busy} />
      </ScrollView>
      <Toast toast={toast.toast} onHide={toast.hide} />
    </Screen>
  );
}

function TemplateCard({
  icon,
  title,
  sub,
  value,
  onChange,
  onReset,
  preview,
  children,
}: {
  icon: string;
  title: string;
  sub: string;
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
  preview: string;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const [sel, setSel] = useState({ start: value.length, end: value.length });

  /** Puts the tag where the cursor is (or at the end). */
  function insert(tag: string) {
    const start = Math.min(sel.start, value.length);
    const end = Math.min(sel.end, value.length);
    const next = value.slice(0, start) + tag + value.slice(end);
    onChange(next.slice(0, 600));
    const at = start + tag.length;
    setSel({ start: at, end: at });
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
      <View style={styles.cardHead}>
        <View style={[styles.badge, { backgroundColor: colors.gradientTop }]}>
          <Text style={styles.badgeIcon}>{icon}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={[styles.cardTitle, { color: colors.ink }]}>{title}</Text>
          <Text style={[styles.cardSub, { color: colors.muted }]}>{sub}</Text>
        </View>
      </View>

      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.slice(0, 600))}
        onSelectionChange={(e) => setSel(e.nativeEvent.selection)}
        multiline
        textAlignVertical="top"
        placeholder="Type your message"
        placeholderTextColor={colors.muted}
        style={[styles.input, styles.message, { borderColor: colors.line, color: colors.ink }]}
      />

      <Text style={[styles.tagsLabel, { color: colors.muted }]}>Tap to insert</Text>
      <View style={styles.tags}>
        {TEMPLATE_TAGS.map((tag) => (
          <Pressable
            key={tag}
            onPress={() => insert(tag)}
            style={({ pressed }) => [styles.tag, { backgroundColor: pressed ? colors.line : colors.keypad }]}
          >
            <Text style={[styles.tagText, { color: colors.brand }]}>{tag}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.tagsLabel, { color: colors.muted }]}>Preview</Text>
      <View style={[styles.chat, { backgroundColor: colors.gradientTop }]}>
        <View style={[styles.bubble, { backgroundColor: colors.saleWash }]}>
          <Text style={[styles.bubbleText, { color: colors.ink }]}>{preview || ' '}</Text>
          <Text style={[styles.bubbleTime, { color: colors.muted }]}>now ✓✓</Text>
        </View>
      </View>

      {children}

      <Pressable onPress={onReset} hitSlop={8}>
        <Text style={[styles.reset, { color: colors.brand }]}>Reset to the default message</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: 16, gap: 14, paddingBottom: 32 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  cardHead: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  badge: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badgeIcon: { fontSize: 20 },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 15 },
  cardSub: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, marginTop: 2 },
  phoneRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  testBtn: { minHeight: 46, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  testText: { fontFamily: fonts.semibold, fontSize: 14 },
  message: { minHeight: 120, paddingTop: 10, fontSize: 14, lineHeight: 20 },
  tagsLabel: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  tagText: { fontFamily: fonts.semibold, fontSize: 12 },
  chat: { borderRadius: 12, padding: 10 },
  bubble: {
    alignSelf: 'flex-end',
    maxWidth: '92%',
    borderRadius: 12,
    borderTopRightRadius: 4,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  bubbleText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  bubbleTime: { fontFamily: fonts.regular, fontSize: 10, alignSelf: 'flex-end', marginTop: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  switchText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13 },
  reset: { fontFamily: fonts.semibold, fontSize: 13 },
});
