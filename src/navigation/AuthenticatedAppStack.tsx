import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AppTabBar } from '../components/AppTabBar';
import { AddExpenseScreen } from '../screens/AddExpenseScreen';
import { CreditBookScreen, CreditLedgerScreen } from '../screens/CreditBookScreen';
import { CreditSettingsScreen } from '../screens/CreditSettingsScreen';
import { KitchenScreen } from '../screens/KitchenScreen';
import { DataToolsScreen } from '../screens/DataToolsScreen';
import { StaffScreen } from '../screens/StaffScreen';
import { AuditLogScreen } from '../screens/AuditLogScreen';
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
import { requireFeature, requirePermission } from '../components/RequirePermission';

// Staff roles: screens a cashier (or manager) may not use show a lock instead.
// Firestore rules block the same actions on the server.
const Products = requirePermission(ProductsScreen, 'manageProducts', 'Products');
const Reports = requirePermission(ReportsScreen, 'viewReports', 'Reports');
const AddExpense = requirePermission(AddExpenseScreen, 'addExpense', 'Add expense');
const Expenses = requirePermission(ExpensesScreen, 'addExpense', 'Expenses');
const Month = requirePermission(MonthScreen, 'viewReports', 'Month');
const SettingsMenu = requirePermission(SettingsMenuScreen, 'shopSettings', 'Settings');
const ReceiptSettings = requirePermission(ReceiptSettingsScreen, 'shopSettings', 'Receipt');
const UpgradePlan = requirePermission(UpgradePlanScreen, 'shopSettings', 'Plan');
const CreditSettings = requireFeature(requirePermission(CreditSettingsScreen, 'shopSettings', 'Credit & WhatsApp'), 'creditBook', 'Credit & WhatsApp');
// Plan gates (Basic / Pro / Premium). The role check runs first, then the plan.
const CreditBook = requireFeature(CreditBookScreen, 'creditBook', 'Credit book');
const CreditLedger = requireFeature(CreditLedgerScreen, 'creditBook', 'Credit book');
const Kitchen = requireFeature(requirePermission(KitchenScreen, 'manageStock', 'Kitchen & Stock'), 'kitchenStock', 'Kitchen & Stock');
const DataTools = requireFeature(requirePermission(DataToolsScreen, 'exportData', 'Excel export & import'), 'exportData', 'Excel export & import');
const Staff = requireFeature(requirePermission(StaffScreen, 'manageStaff', 'Staff'), 'staff', 'Staff');
const AuditLog = requireFeature(requirePermission(AuditLogScreen, 'viewAudit', 'Audit log'), 'staff', 'Audit log');

const AppStack = createNativeStackNavigator<AppStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  return (
    <Tabs.Navigator tabBar={(props) => <AppTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Sales" component={SalesScreen} />
      <Tabs.Screen name="Products" component={Products} />
      <Tabs.Screen name="Reports" component={Reports} />
      <Tabs.Screen name="More" component={MoreScreen} />
    </Tabs.Navigator>
  );
}

export function AuthenticatedAppStack() {
  return (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
      <AppStack.Screen name="Tabs" component={MainTabs} />
      <AppStack.Screen name="NewSale" component={NewSaleScreen} />
      <AppStack.Screen name="AddExpense" component={AddExpense} />
      <AppStack.Screen name="Notifications" component={NotificationsScreen} />
      <AppStack.Screen name="Month" component={Month} />
      <AppStack.Screen name="Expenses" component={Expenses} />
      <AppStack.Screen name="SettingsMenu" component={SettingsMenu} />
      <AppStack.Screen name="ReceiptSettings" component={ReceiptSettings} />
      <AppStack.Screen name="ThemeSettings" component={ThemeSettingsScreen} />
      <AppStack.Screen name="UpgradePlan" component={UpgradePlan} />
      <AppStack.Screen name="TipsHelp" component={TipsScreen} />
      <AppStack.Screen name="CreditBook" component={CreditBook} />
      <AppStack.Screen name="CreditLedger" component={CreditLedger} />
      <AppStack.Screen name="CreditSettings" component={CreditSettings} />
      <AppStack.Screen name="Kitchen" component={Kitchen} />
      <AppStack.Screen name="DataTools" component={DataTools} />
      <AppStack.Screen name="Staff" component={Staff} />
      <AppStack.Screen name="AuditLog" component={AuditLog} />
    </AppStack.Navigator>
  );
}
