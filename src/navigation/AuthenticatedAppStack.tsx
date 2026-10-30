import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AppTabBar } from '../components/AppTabBar';
import { AddExpenseScreen } from '../screens/AddExpenseScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ExpensesScreen, MonthScreen } from '../screens/ListsScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { NewSaleScreen } from '../screens/NewSaleScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ProductsScreen } from '../screens/ProductsScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import {
  ReceiptSettingsScreen,
  SettingsMenuScreen,
  ThemeSettingsScreen,
  UpgradePlanScreen,
} from '../screens/SettingsScreens';
import { TipsScreen } from '../screens/TipsScreen';
import { SalesScreen } from '../screens/SalesScreen';
import type { AppStackParamList, TabParamList } from './types';

const AppStack = createNativeStackNavigator<AppStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  return (
    <Tabs.Navigator tabBar={(props) => <AppTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Sales" component={SalesScreen} />
      <Tabs.Screen name="Products" component={ProductsScreen} />
      <Tabs.Screen name="Reports" component={ReportsScreen} />
      <Tabs.Screen name="More" component={MoreScreen} />
    </Tabs.Navigator>
  );
}

export function AuthenticatedAppStack() {
  return (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
      <AppStack.Screen name="Tabs" component={MainTabs} />
      <AppStack.Screen name="NewSale" component={NewSaleScreen} />
      <AppStack.Screen name="AddExpense" component={AddExpenseScreen} />
      <AppStack.Screen name="Notifications" component={NotificationsScreen} />
      <AppStack.Screen name="Month" component={MonthScreen} />
      <AppStack.Screen name="Expenses" component={ExpensesScreen} />
      <AppStack.Screen name="SettingsMenu" component={SettingsMenuScreen} />
      <AppStack.Screen name="ReceiptSettings" component={ReceiptSettingsScreen} />
      <AppStack.Screen name="ThemeSettings" component={ThemeSettingsScreen} />
      <AppStack.Screen name="UpgradePlan" component={UpgradePlanScreen} />
      <AppStack.Screen name="TipsHelp" component={TipsScreen} />
    </AppStack.Navigator>
  );
}
