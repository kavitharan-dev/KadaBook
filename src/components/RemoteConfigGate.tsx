import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppLogo } from './AppLogo';
import { Screen } from './ui';
import { useRemoteConfig } from '../context/RemoteConfigContext';
import { APP_VERSION } from '../config/build';
import { compareAppVersion } from '../lib/statusEngine';
import { useTheme } from '../context/ThemeContext';
import { fonts } from '../theme/fonts';

export function RemoteConfigGate({ children }: { children: ReactNode }) {
  const { config } = useRemoteConfig();
  const { colors } = useTheme();
  const needsUpdate =
    config.minAppVersion.trim().length > 0 && compareAppVersion(APP_VERSION, config.minAppVersion) < 0;

  if (config.maintenanceMode) {
    return (
      <Screen>
        <View style={styles.wrap}>
          <AppLogo size={64} />
          <Text style={[styles.title, { color: colors.ink }]}>Back soon</Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            {config.maintenanceMessage || 'KadaBook is under maintenance. Please try again later.'}
          </Text>
        </View>
      </Screen>
    );
  }

  if (needsUpdate) {
    return (
      <Screen>
        <View style={styles.wrap}>
          <AppLogo size={64} />
          <Text style={[styles.title, { color: colors.ink }]}>Please update the app</Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            This version is {APP_VERSION}. Install {config.minAppVersion} or newer to continue.
          </Text>
        </View>
      </Screen>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 22,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
