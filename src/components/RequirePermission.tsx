import type { ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ROLE_LABEL, can, roleOf, type Permission } from '../lib/roles';
import { fonts } from '../theme/fonts';
import { FillButton, Header, Screen } from './ui';
import { FEATURE_TITLE, TIER_PRICE_HINT, minTierFor, type TierFeature } from '../lib/tiers';
import { useTier } from '../lib/useTier';

/** Shown instead of a screen the signed-in staff member's role does not allow. */
export function RoleLocked({ title }: { title: string }) {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user } = useAuth();
  return (
    <Screen>
      <Header title={title} onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined} />
      <View style={styles.wrap}>
        <Text style={styles.icon}>🔒</Text>
        <Text style={[styles.title, { color: colors.ink }]}>Not available for {ROLE_LABEL[roleOf(user)]}</Text>
        <Text style={[styles.text, { color: colors.muted }]}>Ask the shop owner if you need this.</Text>
      </View>
    </Screen>
  );
}

/** Wraps a screen so only roles with `permission` can open it. */
export function requirePermission<P extends object>(Screen_: ComponentType<P>, permission: Permission, title: string) {
  function Guarded(props: P) {
    const { user } = useAuth();
    return can(user, permission) ? <Screen_ {...props} /> : <RoleLocked title={title} />;
  }
  Guarded.displayName = `RequirePermission(${Screen_.displayName ?? Screen_.name})`;
  return Guarded;
}

/** Shown when the shop's plan does not include a feature. */
export function PlanLocked({ title, feature }: { title: string; feature: TierFeature }) {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { label, neededTier } = useTier();
  const needed = minTierFor(feature);
  return (
    <Screen>
      <Header title={title} onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined} />
      <View style={styles.wrap}>
        <Text style={styles.icon}>⭐</Text>
        <Text style={[styles.title, { color: colors.ink }]}>{FEATURE_TITLE[feature]}</Text>
        <Text style={[styles.text, { color: colors.muted }]}>
          Not on your plan yet. Ask admin to enable it (add-on). Your shop is on {label}
          {needed ? ` · usually from ${neededTier(feature)} (${TIER_PRICE_HINT[needed]})` : ''}.
        </Text>
        {can(user, 'shopSettings') ? (
          <View style={styles.cta}>
            <FillButton label={`See ${neededTier(feature)} plan`} onPress={() => navigation.navigate('UpgradePlan' as never)} />
          </View>
        ) : (
          <Text style={[styles.text, { color: colors.muted }]}>Ask the shop owner to upgrade.</Text>
        )}
      </View>
    </Screen>
  );
}

/** Wraps a screen so it opens only when the shop's plan includes `feature`. */
export function requireFeature<P extends object>(Screen_: ComponentType<P>, feature: TierFeature, title: string) {
  function Gated(props: P) {
    const { has } = useTier();
    return has(feature) ? <Screen_ {...props} /> : <PlanLocked title={title} feature={feature} />;
  }
  Gated.displayName = `RequireFeature(${Screen_.displayName ?? Screen_.name})`;
  return Gated;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  icon: { fontSize: 44 },
  title: { fontFamily: fonts.bold, fontSize: 17, textAlign: 'center' },
  text: { fontFamily: fonts.regular, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  cta: { alignSelf: 'stretch', marginTop: 12 },
});
