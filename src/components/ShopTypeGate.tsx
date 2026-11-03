import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useShopGate } from '../context/ShopGateContext';
import { useTheme } from '../context/ThemeContext';
import type { ShopType } from '../data/types';
import { SHOP_TYPE_HELP, SHOP_TYPE_LABEL, isShopType } from '../lib/shopType';
import { fonts } from '../theme/fonts';
import { ErrorText, FillButton } from './ui';

/** One-time prompt for older accounts that never chose Retail vs Kitchen. */
export function ShopTypeGate({ children }: { children: React.ReactNode }) {
  const { user, updateShopType } = useAuth();
  const { profile } = useShopGate();
  const { colors } = useTheme();
  const knownType = profile?.shopType ?? user?.shopType;
  const needsPick = !!user && !user.staffName && !isShopType(knownType);
  const [picked, setPicked] = useState<ShopType>('retail');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!needsPick) return <>{children}</>;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await updateShopType(picked);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save shop type.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {children}
      <Modal visible animationType="fade" transparent>
        <View style={styles.backdrop}>
          <View style={[styles.card, { backgroundColor: colors.white }]}>
            <Text style={[styles.title, { color: colors.ink }]}>What kind of shop is this?</Text>
            <Text style={[styles.sub, { color: colors.muted }]}>
              Retail shops hide Kitchen & Stock. Kitchen / restaurants keep raw materials and recipes. You can change this later in More.
            </Text>
            {(['retail', 'kitchen'] as ShopType[]).map((type) => {
              const on = picked === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => setPicked(type)}
                  style={[
                    styles.option,
                    {
                      borderColor: on ? colors.brand : colors.line,
                      backgroundColor: on ? colors.gradientTop : colors.white,
                    },
                  ]}
                >
                  <Text style={[styles.optionTitle, { color: colors.ink }]}>{SHOP_TYPE_LABEL[type]}</Text>
                  <Text style={[styles.optionHelp, { color: colors.muted }]}>{SHOP_TYPE_HELP[type]}</Text>
                </Pressable>
              );
            })}
            <FillButton label="Continue" onPress={save} busy={busy} />
            <ErrorText message={error} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 20,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  option: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  optionTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  optionHelp: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
});
