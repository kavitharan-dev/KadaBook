import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Home: undefined;
  Sales: undefined;
  Products: undefined;
  Reports: undefined;
  More: undefined;
};

export type AppStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  NewSale: undefined;
  AddExpense: undefined;
  Notifications: undefined;
  Month: undefined;
  Expenses: undefined;
  SettingsMenu: undefined;
  ReceiptSettings: undefined;
  ThemeSettings: undefined;
  UpgradePlan: undefined;
  TipsHelp: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};
