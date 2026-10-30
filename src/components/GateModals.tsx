import { useEffect } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useI18n } from '../context/LocaleContext';
import { useShopGate } from '../context/ShopGateContext';
import { useTheme } from '../context/ThemeContext';
import { FillButton } from './ui';
import { fonts } from '../theme/fonts';

export function AccessBlockedModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { openRenewWhatsApp } = useShopGate();
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 }} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.white,
            borderRadius: 16,
            padding: 20,
            gap: 12,
          }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.ink }}>{t((m) => m.gate.blockedTitle)}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.muted, lineHeight: 20 }}>
            {t((m) => m.gate.blockedBody)}
          </Text>
          <FillButton label={t((m) => m.gate.renewWhatsApp)} onPress={() => { openRenewWhatsApp(); onClose(); }} />
          <Pressable onPress={onClose} style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ fontFamily: fonts.semibold, color: colors.brand }}>{t((m) => m.common.close)}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function AnnouncementPopupHost() {
  const { popup, dismissAnnouncement, gate, markAnnouncementView } = useShopGate();
  const { locale, t } = useI18n();
  const { colors } = useTheme();
  useEffect(() => {
    if (popup?.id) markAnnouncementView(popup.id);
  }, [popup?.id, markAnnouncementView]);
  if (!popup || gate !== 'app') return null;
  const title = locale === 'ta' ? popup.titleTa || popup.titleEn : popup.titleEn;
  const message = locale === 'ta' ? popup.messageTa || popup.messageEn : popup.messageEn;
  return (
    <Modal visible transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: colors.white, borderRadius: 16, padding: 20, gap: 10 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.ink }}>{title}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.muted, lineHeight: 20 }}>{message}</Text>
          {popup.dismissible ? (
            <FillButton
              label={t((m) => m.common.close)}
              onPress={() => dismissAnnouncement(popup.id, 'popup')}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
