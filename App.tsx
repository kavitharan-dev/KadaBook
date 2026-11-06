import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { NotoSansTamil_600SemiBold } from '@expo-google-fonts/noto-sans-tamil';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { AppLoading } from './src/components/AppLoading';
import { AppUpdateNotice } from './src/components/AppUpdateNotice';
import { RemoteConfigGate } from './src/components/RemoteConfigGate';
import { AuthProvider } from './src/context/AuthContext';
import { LocaleProvider, useI18n } from './src/context/LocaleContext';
import { RemoteConfigProvider } from './src/context/RemoteConfigContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { DesignModeOverlay } from './src/devtools/designMode/DesignModeOverlay';
import { DesignModeProvider } from './src/devtools/designMode/DesignModeContext';
import { RootNavigator } from './src/navigation/RootNavigator';

function AppShell() {
  const { t } = useI18n();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    NotoSansTamil_600SemiBold,
  });

  if (!fontsLoaded && !fontError) {
    return <AppLoading message={t((m) => m.loading.starting)} />;
  }

  return (
    <RemoteConfigProvider>
      <AppUpdateNotice />
      <RemoteConfigGate>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </RemoteConfigGate>
    </RemoteConfigProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <DesignModeProvider>
        <SafeAreaProvider>
          <LocaleProvider>
            <ThemeProvider>
              <AppShell />
            </ThemeProvider>
          </LocaleProvider>
        </SafeAreaProvider>
        <DesignModeOverlay />
      </DesignModeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
