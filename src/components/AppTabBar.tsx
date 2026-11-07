import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useI18n } from '../context/LocaleContext';
import { useTheme } from '../context/ThemeContext';
import { useRole, type Permission } from '../lib/roles';
import { GearIcon, HomeIcon, ProductIcon, ReportIcon, SaleIcon } from './Icons';
import { TabBarIcon } from './TabBarIcon';

const TABS: { name: string; key: 'home' | 'sales' | 'products' | 'reports' | 'more'; Icon: typeof HomeIcon; needs?: Permission }[] = [
  { name: 'Home', key: 'home', Icon: HomeIcon },
  { name: 'Sales', key: 'sales', Icon: SaleIcon },
  { name: 'Products', key: 'products', Icon: ProductIcon, needs: 'manageProducts' },
  { name: 'Reports', key: 'reports', Icon: ReportIcon, needs: 'viewReports' },
  { name: 'More', key: 'more', Icon: GearIcon },
];

export function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { colors } = useTheme();
  const { can } = useRole();
  const bottomPad = Math.max(insets.bottom, 4);

  return (
    <View
      style={[
        styles.bar,
        {
          paddingTop: 6,
          paddingBottom: bottomPad,
          borderTopColor: colors.hairline,
          backgroundColor: colors.white,
        },
      ]}
    >
      {TABS.map((tab, index) => {
        // Cashiers do not get the Products and Reports tabs.
        if (tab.needs && !can(tab.needs)) return null;
        const active = state.index === index;
        const color = active ? colors.brand : colors.muted;
        return (
          <TabBarIcon
            key={tab.name}
            active={active}
            color={color}
            label={t((m) => m.tabs[tab.key])}
            Icon={tab.Icon}
            onPress={() => navigation.navigate(tab.name)}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
