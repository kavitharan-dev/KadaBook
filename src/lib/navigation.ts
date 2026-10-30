import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/types';

export function closeToDashboard(navigation: NativeStackNavigationProp<AppStackParamList>) {
  if (navigation.canGoBack()) {
    navigation.navigate('Tabs', { screen: 'Home' });
    return;
  }
  navigation.navigate('Tabs', { screen: 'Home' });
}
