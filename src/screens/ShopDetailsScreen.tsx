import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ErrorText, Field, FillButton, Header, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/LocaleContext';
import { useShopGate } from '../context/ShopGateContext';
import { useTheme } from '../context/ThemeContext';
import { fonts } from '../theme/fonts';

export function ShopDetailsScreen() {
  const navigation = useNavigation();
  const { user, updateShopName } = useAuth();
  const { profile } = useShopGate();
  const { t } = useI18n();
  const { colors } = useTheme();

  const currentName =
    profile?.shopName && profile.shopName !== 'Shop' ? profile.shopName : (user?.shopName ?? '');
  const [shopName, setShopName] = useState(currentName);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setShopName(currentName);
  }, [currentName]);

  async function save() {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await updateShopName(shopName.trim());
      setMessage(t((m) => m.more.shopSaved));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t((m) => m.more.shopError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header title="Shop Details" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted }}>
            {t((m) => m.more.shopName)}
          </Text>
          <Field value={shopName} onChangeText={setShopName} placeholder={t((m) => m.more.shopName)} />
        </View>
        <FillButton
          label={t((m) => m.more.saveShop)}
          onPress={save}
          busy={busy}
          disabled={busy || !shopName.trim() || shopName.trim() === currentName}
        />
        <ErrorText message={error} />
        {message ? (
          <Text style={{ textAlign: 'center', fontFamily: fonts.semibold, fontSize: 13, color: colors.saleText }}>
            {message}
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
