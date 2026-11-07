import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CameraIcon } from '../components/Icons';
import { ErrorText, Field, FillButton, Header, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useAvatar } from '../hooks/useAvatar';
import { useI18n } from '../context/LocaleContext';
import { useShopGate } from '../context/ShopGateContext';
import { useTheme } from '../context/ThemeContext';
import { fonts } from '../theme/fonts';

function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted }}>{label}</Text>
      {children}
    </View>
  );
}

export function ShopDetailsScreen() {
  const navigation = useNavigation();
  const { user, updateShopProfile } = useAuth();
  const { profile } = useShopGate();
  const { t } = useI18n();
  const { colors } = useTheme();
  const avatar = useAvatar(user?.uid);

  const currentName =
    profile?.shopName && profile.shopName !== 'Shop' ? profile.shopName : (user?.shopName ?? '');

  const [shopName, setShopName] = useState(currentName);
  const [ownerName, setOwnerName] = useState(profile?.ownerName ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [address, setAddress] = useState(profile?.district ?? '');
  const [gstin, setGstin] = useState(profile?.gstin ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // `profile` comes from a live Firestore listener and gets a new object identity on every
  // snapshot — including unrelated writes elsewhere in the same doc (a sale's openingBalances,
  // the local-then-server double-fire after this screen's own save). Re-syncing fields on every
  // one of those was wiping whatever the person had typed but not yet saved, and comparing
  // "dirty" against the live profile could flip it under them mid-edit too. Hydrate once, the
  // first time real profile data shows up, into a frozen baseline — fields and the dirty check
  // both key off that snapshot, not the live listener, from then on.
  const hydrated = useRef(false);
  const [baseline, setBaseline] = useState({
    shopName: currentName,
    ownerName: profile?.ownerName ?? '',
    phone: profile?.phone ?? '',
    email: profile?.email ?? '',
    district: profile?.district ?? '',
    gstin: profile?.gstin ?? '',
  });
  useEffect(() => {
    if (hydrated.current || !profile) return;
    hydrated.current = true;
    const next = {
      shopName: currentName,
      ownerName: profile.ownerName ?? '',
      phone: profile.phone ?? '',
      email: profile.email ?? '',
      district: profile.district ?? '',
      gstin: profile.gstin ?? '',
    };
    setBaseline(next);
    setShopName(next.shopName);
    setOwnerName(next.ownerName);
    setPhone(next.phone);
    setEmail(next.email);
    setAddress(next.district);
    setGstin(next.gstin);
  }, [profile, currentName]);

  const dirty =
    shopName.trim() !== baseline.shopName ||
    ownerName.trim() !== baseline.ownerName ||
    phone.trim() !== baseline.phone ||
    email.trim() !== baseline.email ||
    address.trim() !== baseline.district ||
    gstin.trim() !== baseline.gstin;

  async function save() {
    setError(null);
    setMessage(null);
    if (!shopName.trim()) {
      setError(t((m) => m.more.shopError));
      return;
    }
    setBusy(true);
    try {
      const patch = {
        shopName: shopName.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        district: address.trim(),
        gstin: gstin.trim(),
      };
      await updateShopProfile(patch);
      setBaseline(patch);
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
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={avatar.pick} disabled={avatar.busy} style={{ alignItems: 'center', gap: 8 }}>
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: colors.gradientTop,
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {avatar.uri ? (
              <Image source={{ uri: avatar.uri }} style={{ width: 88, height: 88, borderRadius: 44 }} />
            ) : (
              <Text style={{ fontFamily: fonts.bold, fontSize: 32, color: colors.brand }}>
                {(shopName.trim()[0] ?? 'K').toUpperCase()}
              </Text>
            )}
            <View
              style={{
                position: 'absolute',
                right: -2,
                bottom: -2,
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: colors.brand,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: colors.white,
              }}
            >
              <CameraIcon color="#FFFFFF" size={14} />
            </View>
          </View>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.brand }}>Shop logo</Text>
        </Pressable>

        <FieldBlock label={t((m) => m.more.shopName)}>
          <Field value={shopName} onChangeText={setShopName} placeholder={t((m) => m.more.shopName)} />
        </FieldBlock>

        <FieldBlock label="Owner name">
          <Field value={ownerName} onChangeText={setOwnerName} placeholder="e.g. Ramesh Kumar" />
        </FieldBlock>

        <FieldBlock label="Shop phone number">
          <Field value={phone} onChangeText={setPhone} placeholder="e.g. 9876543210" keyboardType="phone-pad" />
        </FieldBlock>

        <FieldBlock label="Shop email">
          <Field
            value={email}
            onChangeText={setEmail}
            placeholder="e.g. shop@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </FieldBlock>

        <FieldBlock label="Shop address">
          <Field
            value={address}
            onChangeText={setAddress}
            placeholder="Street, area, city, PIN code"
            multiline
            numberOfLines={3}
            style={{ height: 80, paddingTop: 14, textAlignVertical: 'top' }}
          />
        </FieldBlock>

        <FieldBlock label="GSTIN / Tax ID">
          <Field
            value={gstin}
            onChangeText={setGstin}
            placeholder="e.g. 33AAAAA0000A1Z5"
            autoCapitalize="characters"
          />
        </FieldBlock>

        <FillButton label={t((m) => m.more.saveShop)} onPress={save} busy={busy} disabled={busy || !dirty} />
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
