import { Alert, Platform } from 'react-native';

export type ConfirmDeleteOptions = {
  title: string;
  message: string;
  cancel: string;
  deleteLabel: string;
  onDelete: () => void;
};

export function confirmDelete(options: ConfirmDeleteOptions) {
  const { title, message, cancel, deleteLabel, onDelete } = options;
  if (Platform.OS === 'web') {
    const confirmOnWeb = (globalThis as { confirm?: (message: string) => boolean }).confirm;
    if (confirmOnWeb?.(`${title}\n${message}`)) onDelete();
    return;
  }
  Alert.alert(title, message, [
    { text: cancel, style: 'cancel' },
    { text: deleteLabel, style: 'destructive', onPress: onDelete },
  ]);
}
