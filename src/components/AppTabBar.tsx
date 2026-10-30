import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useI18n } from '../context/LocaleContext';
import { useTheme } from '../context/ThemeContext';
import { HomeIcon, MoreIcon, ProductIcon, ReportIcon, SaleIcon } from './Icons';
import { TabBarIcon } from './TabBarIcon';

const TABS = [
  { name: 'Home', key: 'home' as const, Icon: HomeIcon },
  { name: 'Sales', key: 'sales' as const, Icon: SaleIcon },
  { name: 'Products', key: 'products' as const, Icon: ProductIcon },
  { name: 'Reports', key: 'reports' as const, Icon: ReportIcon },
  { name: 'More', key: 'more' as const, Icon: MoreIcon },
] as const;

export function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { colors } = useTheme();
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
