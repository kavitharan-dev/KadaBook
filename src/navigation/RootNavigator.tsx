import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import type { ReactNode } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppLoading } from '../components/AppLoading';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/LocaleContext';
import { useTheme } from '../context/ThemeContext';
import { ForgotPasswordScreen, SignUpScreen } from '../screens/AuthScreens';
import { LoginScreen } from '../screens/LoginScreen';
import { AuthenticatedTree } from './AuthenticatedTree';
import type { AuthStackParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function NavContainer({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const theme = {
    ...DefaultTheme,
    colors: { ...DefaultTheme.colors, background: colors.white, card: colors.white, text: colors.ink, border: colors.line },
  };
  return <NavigationContainer theme={theme}>{children}</NavigationContainer>;
}

function Guest() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

export function RootNavigator() {
  const { user, ready } = useAuth();
  const { t } = useI18n();
  if (!ready) {
    return <AppLoading message={t((m) => m.loading.checking)} />;
  }
  return <NavContainer>{user ? <AuthenticatedTree /> : <Guest />}</NavContainer>;
}
