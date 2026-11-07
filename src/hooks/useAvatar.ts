import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { loadAvatar, saveAvatar } from '../lib/avatarPreference';

/** Profile photo for the signed-in user — picked from the gallery, stored locally on-device. */
export function useAvatar(uid: string | undefined) {
  const [uri, setUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid) {
      setUri(null);
      return;
    }
    let cancelled = false;
    loadAvatar(uid).then((value) => {
      if (!cancelled) setUri(value);
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const pick = useCallback(async () => {
    if (!uid) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo access in your phone settings to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    const dataUri = `data:image/jpeg;base64,${result.assets[0].base64}`;
    setBusy(true);
    try {
      await saveAvatar(uid, dataUri);
      setUri(dataUri);
    } finally {
      setBusy(false);
    }
  }, [uid]);

  return { uri, pick, busy };
}
