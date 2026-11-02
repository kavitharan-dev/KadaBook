import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { Sale } from '../data/types';
import { formatDay, formatRs, formatTime, startOfDay } from '../lib/format';
import { ErrorText, FillButton } from './ui';
import { fonts } from '../theme/fonts';

const DAY = 24 * 60 * 60 * 1000;

export type SaleEdit = { note: string; customerName: string; customerPhone: string; createdAt: number };

/** Edit a saved sale: note, customer, and move it to another day (time of day is kept). */
export function EditSaleModal({
  sale,
  onClose,
  onSave,
}: {
  sale: Sale | null;
  onClose: () => void;
  onSave: (edit: SaleEdit) => Promise<void>;
}) {
  const { colors } = useTheme();
  const [note, setNote] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [at, setAt] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sale) return;
    setNote(sale.note ?? '');
    setName(sale.customerName ?? '');
    setPhone(sale.customerPhone ?? '');
    setAt(sale.createdAt);
    setError(null);
  }, [sale]);

  if (!sale) return null;

  const today = startOfDay(Date.now());
  const canForward = startOfDay(at) < today;
  const timeOfDay = sale.createdAt - startOfDay(sale.createdAt);
  // Moving to today keeps the time only if it is not later than now.
  const moveTo = (day: number) => setAt(Math.min(Date.now(), startOfDay(day) + timeOfDay));
  const moved = startOfDay(at) !== startOfDay(sale.createdAt);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await onSave({ note, customerName: name, customerPhone: phone, createdAt: at });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the change.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: colors.white }]}>
          <View style={styles.head}>
            <View style={styles.flex}>
              <Text style={[styles.title, { color: colors.ink }]}>
                Edit sale{sale.invoiceNo ? ` · #${sale.invoiceNo}` : ''}
              </Text>
              <Text style={[styles.sub, { color: colors.muted }]}>{formatRs(sale.amount)}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={[styles.close, { backgroundColor: colors.keypad }]}>
              <Text style={{ color: colors.muted, fontFamily: fonts.bold }}>✕</Text>
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            <Text style={[styles.label, { color: colors.muted }]}>DATE</Text>
            <View style={[styles.dateRow, { borderColor: moved ? colors.brand : colors.line }]}>
              <Pressable onPress={() => moveTo(startOfDay(at) - DAY)} style={styles.step} hitSlop={6}>
                <Text style={[styles.stepText, { color: colors.ink }]}>‹</Text>
              </Pressable>
              <View style={styles.dateCenter}>
                <Text style={[styles.dateText, { color: colors.ink }]}>{formatDay(at)}</Text>
                <Text style={[styles.sub, { color: colors.muted }]}>{formatTime(at)}</Text>
              </View>
              <Pressable
                onPress={() => canForward && moveTo(startOfDay(at) + DAY)}
                style={[styles.step, !canForward && { opacity: 0.3 }]}
                hitSlop={6}
              >
                <Text style={[styles.stepText, { color: colors.ink }]}>›</Text>
              </Pressable>
            </View>
            <View style={styles.chips}>
              {[
                { label: 'Today', day: today },
                { label: 'Yesterday', day: today - DAY },
                { label: 'Original', day: startOfDay(sale.createdAt) },
              ].map((chip) => {
                const on = startOfDay(at) === chip.day;
                return (
                  <Pressable
                    key={chip.label}
                    onPress={() => moveTo(chip.day)}
                    style={[styles.chip, { backgroundColor: on ? colors.brand : colors.keypad }]}
                  >
                    <Text style={[styles.chipText, { color: on ? colors.onFill : colors.ink }]}>{chip.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { color: colors.muted }]}>NOTE</Text>
            <TextInput
              value={note}
              onChangeText={(v) => setNote(v.slice(0, 120))}
              placeholder="e.g. Paid by son, deliver tomorrow"
              placeholderTextColor={colors.muted}
              multiline
              textAlignVertical="top"
              style={[styles.input, styles.note, { borderColor: colors.line, color: colors.ink }]}
            />
            <Text style={[styles.count, { color: colors.muted }]}>{note.length}/120</Text>

            <Text style={[styles.label, { color: colors.muted }]}>CUSTOMER</Text>
            <TextInput
              value={phone}
              onChangeText={(v) => setPhone(v.replace(/[^\d+]/g, '').slice(0, 15))}
              placeholder="Phone"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              style={[styles.input, { borderColor: colors.line, color: colors.ink }]}
            />
            <TextInput
              value={name}
              onChangeText={(v) => setName(v.slice(0, 60))}
              placeholder="Name"
              placeholderTextColor={colors.muted}
              style={[styles.input, { borderColor: colors.line, color: colors.ink }]}
            />
            <ErrorText message={error} />
          </ScrollView>

          <FillButton label="Save changes" color={colors.saleText} onPress={save} busy={busy} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(15,23,42,0.55)' },
  card: { width: '100%', maxWidth: 440, maxHeight: '90%', alignSelf: 'center', borderRadius: 22, padding: 18, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: fonts.bold, fontSize: 18 },
  sub: { fontFamily: fonts.regular, fontSize: 12 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  body: { gap: 8 },
  label: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, marginTop: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 14, minHeight: 58 },
  step: { width: 52, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 28, fontFamily: fonts.semibold },
  dateCenter: { flex: 1, alignItems: 'center' },
  dateText: { fontFamily: fonts.semibold, fontSize: 15 },
  chips: { flexDirection: 'row', gap: 6 },
  chip: { flex: 1, minHeight: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: fonts.semibold, fontSize: 12 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 14 },
  note: { minHeight: 70, paddingTop: 10 },
  count: { fontFamily: fonts.regular, fontSize: 11, textAlign: 'right' },
});
