import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppLogo } from '../components/AppLogo';
import { FillButton, Screen } from '../components/ui';
import { useI18n } from '../context/LocaleContext';
import { useShopGate } from '../context/ShopGateContext';
import { useTheme } from '../context/ThemeContext';
import { fonts } from '../theme/fonts';

function GateShell({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Screen>
      <View style={styles.wrap}>
        <AppLogo size={48} />
        <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
        <Text style={[styles.body, { color: colors.muted }]}>{body}</Text>
        {children}
      </View>
    </Screen>
  );
}

export function MaintenanceGateScreen() {
  const { t } = useI18n();
  return <GateShell title={t((m) => m.gate.maintenanceTitle)} body={t((m) => m.gate.maintenanceBody)} />;
}

export function UpdateRequiredGateScreen() {
  const { t } = useI18n();
  return <GateShell title={t((m) => m.gate.updateTitle)} body={t((m) => m.gate.updateBody)} />;
}

export function PendingGateScreen() {
  const { t } = useI18n();
  return <GateShell title={t((m) => m.gate.pendingTitle)} body={t((m) => m.gate.pendingBody)} />;
}

export function RejectedGateScreen() {
  const { t } = useI18n();
  const { profile, openRenewWhatsApp } = useShopGate();
  const { t: tr } = useI18n();
  return (
    <GateShell
      title={tr((m) => m.gate.rejectedTitle)}
      body={profile?.rejectReason ? profile.rejectReason : tr((m) => m.gate.rejectedBody)}
    >
      <FillButton label={t((m) => m.gate.contactWhatsApp)} onPress={openRenewWhatsApp} />
    </GateShell>
  );
}

export function SuspendedGateScreen() {
  const { t } = useI18n();
  const { openRenewWhatsApp } = useShopGate();
  return (
    <GateShell title={t((m) => m.gate.suspendedTitle)} body={t((m) => m.gate.suspendedBody)}>
      <FillButton label={t((m) => m.gate.contactWhatsApp)} onPress={openRenewWhatsApp} />
    </GateShell>
  );
}

export function GraceBanner() {
  const { t } = useI18n();
  const { graceDaysLeft, openRenewWhatsApp } = useShopGate();
  const { colors } = useTheme();
  if (graceDaysLeft <= 0) return null;
  return (
    <Pressable onPress={openRenewWhatsApp} style={[styles.banner, { backgroundColor: colors.expenseWash }]}>
      <Text style={[styles.bannerText, { color: colors.expenseText }]}>
        {t((m) => m.gate.graceBanner, { days: graceDaysLeft })}
      </Text>
    </Pressable>
  );
}

export function TrialChip() {
  const { t } = useI18n();
  const { status, trialDays } = useShopGate();
  const { colors } = useTheme();
  if (status !== 'trial' || trialDays <= 0) return null;
  return (
    <View style={[styles.chip, { backgroundColor: colors.brand }]}>
      <Text style={styles.chipText}>{t((m) => m.gate.trialChip, { days: trialDays })}</Text>
    </View>
  );
}

export function ExpiredRenewBar() {
  const { t } = useI18n();
  const { status, openRenewWhatsApp } = useShopGate();
  const { colors } = useTheme();
  if (status !== 'expired') return null;
  return (
    <LinearGradient colors={['#1D5FE0', '#3B82F6']} style={styles.renewBar}>
      <Text style={styles.renewText}>{t((m) => m.gate.expiredReadOnly)}</Text>
      <Pressable onPress={openRenewWhatsApp} style={styles.renewBtn}>
        <Text style={styles.renewBtnText}>{t((m) => m.gate.renewWhatsApp)}</Text>
      </Pressable>
    </LinearGradient>
  );
}

export function HomeAnnouncementBanner() {
  const { banner, dismissAnnouncement } = useShopGate();
  const { locale } = useI18n();
  const { colors } = useTheme();
  if (!banner) return null;
  const title = locale === 'ta' ? banner.titleTa || banner.titleEn : banner.titleEn;
  const message = locale === 'ta' ? banner.messageTa || banner.messageEn : banner.messageEn;
  return (
    <View style={[styles.annBanner, { borderColor: colors.line, backgroundColor: colors.gradientTop }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.annTitle, { color: colors.ink }]}>{title}</Text>
        <Text style={[styles.annMsg, { color: colors.muted }]}>{message}</Text>
      </View>
      {banner.dismissible ? (
        <Pressable onPress={() => dismissAnnouncement(banner.id, 'banner')} hitSlop={8}>
          <Text style={{ color: colors.brand, fontFamily: fonts.semibold }}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    alignItems: 'center',
    gap: 16,
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
  banner: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
  },
  bannerText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    textAlign: 'center',
  },
  chip: {
    position: 'absolute',
    right: 16,
    top: 8,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    color: '#fff',
    fontFamily: fonts.semibold,
    fontSize: 11,
  },
  renewBar: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  renewText: {
    color: '#fff',
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  renewBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  renewBtnText: {
    color: '#fff',
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  annBanner: {
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  annTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  annMsg: {
    fontFamily: fonts.regular,
    fontSize: 13,
    marginTop: 4,
  },
});
