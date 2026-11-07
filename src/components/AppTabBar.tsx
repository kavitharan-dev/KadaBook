import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useI18n } from '../context/LocaleContext';
import { useTheme } from '../context/ThemeContext';
import { useRole, type Permission } from '../lib/roles';
import { Designable } from '../devtools/designMode/Designable';
import { tabBarLayout } from '../designConfig/tabBar';
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

  return (
    <Designable screen="tabBar" id="bar" base={tabBarLayout.bar} resizeKeys={['paddingHorizontal', 'paddingVertical']}>
      {(v) => (
        <View style={[styles.wrap, { paddingTop: v.paddingTop, paddingHorizontal: v.paddingHorizontal, paddingBottom: Math.max(insets.bottom, v.minBottomGap) }]}>
          <View
            style={[
              styles.bar,
              {
                borderRadius: v.borderRadius,
                paddingVertical: v.paddingVertical,
                backgroundColor: colors.white,
                boxShadow: '0px 10px 24px rgba(15,23,42,0.14)',
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
        </View>
      )}
    </Designable>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
