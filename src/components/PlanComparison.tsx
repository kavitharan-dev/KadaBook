import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import {
  FEATURE_STATUS,
  FEATURE_TITLE,
  STANDARD_FEATURES,
  BASIC_FEATURES,
  ALL_FEATURES,
  TIER_LABEL,
  type Tier,
  type TierFeature,
} from '../lib/tiers';
import { useTier } from '../lib/useTier';
import { fonts } from '../theme/fonts';

export function PlanComparison() {
  const { colors } = useTheme();
  const { tier: current, grandfather } = useTier();
  const [open, setOpen] = useState(false);
  const tiers: Tier[] = ['basic', 'pro'];
  const features: TierFeature[] = ALL_FEATURES.filter((f) => FEATURE_STATUS[f] === 'live' || BASIC_FEATURES.includes(f) || STANDARD_FEATURES.includes(f));

  function cell(tier: Tier, feature: TierFeature) {
    if (tier === 'basic') return BASIC_FEATURES.includes(feature) ? '✓' : '—';
    return STANDARD_FEATURES.includes(feature) ? '✓' : '+';
  }

  return (
    <View style={[styles.card, { borderColor: colors.hairline, backgroundColor: colors.white }]}>
      <Text style={[styles.title, { color: colors.ink }]}>What each plan includes</Text>
      {grandfather ? (
        <Text style={[styles.note, { color: colors.muted }]}>
          Your shop currently has all features active. Admin can customize later.
        </Text>
      ) : null}
      <View style={[styles.row, styles.head, { borderBottomColor: colors.rowLine }]}>
        <Text style={[styles.featureCol, styles.headText, { color: colors.muted }]}>Feature</Text>
        {tiers.map((tier) => (
          <Text
            key={tier}
            style={[styles.tierCol, styles.headText, { color: tier === current ? colors.brand : colors.muted }]}
          >
            {TIER_LABEL[tier]}
          </Text>
        ))}
      </View>
      {(open ? features : features.slice(0, 6)).map((feature) => (
        <View key={feature} style={[styles.row, { borderBottomColor: colors.rowLine }]}>
          <View style={styles.featureCol}>
            <Text style={[styles.featureText, { color: colors.ink }]}>{FEATURE_TITLE[feature]}</Text>
            {FEATURE_STATUS[feature] === 'soon' ? (
              <Text style={[styles.soon, { color: colors.brand }]}>Coming soon</Text>
            ) : null}
          </View>
          {tiers.map((tier) => {
            const mark = cell(tier, feature);
            return (
              <Text
                key={tier}
                style={[
                  styles.tierCol,
                  styles.mark,
                  { color: mark === '✓' ? colors.saleText : colors.muted },
                ]}
              >
                {mark}
              </Text>
            );
          })}
        </View>
      ))}
      {features.length > 6 ? (
        <Pressable onPress={() => setOpen((v) => !v)} style={styles.toggle}>
          <Text style={[styles.toggleText, { color: colors.brand }]}>
            {open ? 'Show less' : `Show all ${features.length} features (+ = add-on)`}
          </Text>
        </Pressable>
      ) : null}
      <Text style={[styles.note, { color: colors.muted }]}>
        Standard add-ons (kitchen, staff, branches…) are priced separately and added by admin.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  head: {
    paddingTop: 0,
  },
  headText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  featureCol: {
    flex: 1.7,
    paddingRight: 8,
  },
  tierCol: {
    flex: 0.7,
    textAlign: 'center',
  },
  featureText: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  soon: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    marginTop: 2,
  },
  mark: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  toggle: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  note: {
    marginTop: 10,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
});
