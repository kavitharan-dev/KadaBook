import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * expo-secure-store has no working web implementation (its web shim throws
 * "setValueWithKeyAsync is not a function"). Fall back to AsyncStorage on
 * web — it's localStorage-backed there — so PIN-lock storage doesn't crash
 * the web build. Native platforms keep using the real secure keychain.
 */
export const secureStore =
  Platform.OS === 'web'
    ? {
        getItemAsync: AsyncStorage.getItem,
        setItemAsync: AsyncStorage.setItem,
        deleteItemAsync: AsyncStorage.removeItem,
      }
    : {
        getItemAsync: SecureStore.getItemAsync,
        setItemAsync: SecureStore.setItemAsync,
        deleteItemAsync: SecureStore.deleteItemAsync,
      };
