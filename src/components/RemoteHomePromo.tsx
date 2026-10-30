import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRemoteConfig } from '../context/RemoteConfigContext';
import { useTheme } from '../context/ThemeContext';
import { fonts } from '../theme/fonts';

export function RemoteHomePromo() {
  const { config } = useRemoteConfig();
  const { colors } = useTheme();
  const banners = config.banners.filter((banner) => banner.enabled && banner.imageUrl);
  const announcement = config.announcement;

  return (
    <View>
      {announcement.enabled && (announcement.title || announcement.message) ? (
        <View style={[styles.notice, { backgroundColor: colors.gradientTop }]}>
          {announcement.title ? (
            <Text style={[styles.title, { color: colors.ink }]}>{announcement.title}</Text>
          ) : null}
          {announcement.message ? (
            <Text style={[styles.message, { color: colors.muted }]}>{announcement.message}</Text>
          ) : null}
        </View>
      ) : null}
      {banners.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {banners.map((banner) => (
            <Pressable
              key={banner.imageUrl}
              disabled={!banner.link}
              onPress={() => {
                if (banner.link) void Linking.openURL(banner.link);
              }}
            >
              <Image source={{ uri: banner.imageUrl }} style={styles.banner} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 4,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  row: {
    gap: 10,
    paddingBottom: 12,
  },
  banner: {
    width: 280,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#E8F1FF',
  },
});
