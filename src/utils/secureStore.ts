import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const getSecureItem = async (key: string): Promise<string | null> => {
  if (Platform.OS === 'web') {
    return await AsyncStorage.getItem(key);
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.warn(`SecureStore.getItemAsync failed for key "${key}". Falling back to AsyncStorage:`, error);
    return await AsyncStorage.getItem(key);
  }
};

export const setSecureItem = async (key: string, value: string): Promise<void> => {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
  } else {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.warn(`SecureStore.setItemAsync failed for key "${key}". Falling back to AsyncStorage:`, error);
      await AsyncStorage.setItem(key, value);
    }
  }
};

export const removeSecureItem = async (key: string): Promise<void> => {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
  } else {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.warn(`SecureStore.deleteItemAsync failed for key "${key}". Falling back to AsyncStorage:`, error);
      await AsyncStorage.removeItem(key);
    }
  }
};
