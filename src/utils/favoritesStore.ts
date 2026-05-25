import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import { get, post as apiPost, del } from './apiClient';
import { getSecureItem } from './secureStore';

const FAVORITES_KEY = 'ratedeed_favorites';

export const getFavorites = async (): Promise<string[]> => {
  const token = await getSecureItem('auth_token');

  // 1. Always try server first — this is the single source of truth
  if (token) {
    try {
      const serverIds = await get(`${API_BASE_URL}/api/users/favorites`);
      if (Array.isArray(serverIds)) {
        await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(serverIds));
        return serverIds;
      }
    } catch {
      // server unreachable — fall back to local cache below
    }
  }

  // 2. Fallback to local cache (guest mode or offline)
  try {
    const json = await AsyncStorage.getItem(FAVORITES_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
};

export const syncFavoritesWithServer = async () => {
  const token = await getSecureItem('auth_token');
  if (!token) return;

  try {
    const serverIds = await get(`${API_BASE_URL}/api/users/favorites`);
    if (Array.isArray(serverIds)) {
      const local = await getFavorites();
      const merged = Array.from(new Set([...local, ...serverIds]));
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(merged));
    }
  } catch {
    // sync failure is non-critical
  }
};

export const addFavorite = async (id: string) => {
  try {
    const current = await getFavorites();
    if (!current.includes(id)) {
      const updated = [...current, id];
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    }
    await apiPost(`${API_BASE_URL}/api/users/favorite/${id}`, {});
  } catch {
    // favorite failure is non-critical
  }
};

export const removeFavorite = async (id: string) => {
  try {
    const current = await getFavorites();
    const updated = current.filter(fid => fid !== id);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    await del(`${API_BASE_URL}/api/users/favorite/${id}`);
  } catch {
    // favorite removal failure is non-critical
  }
};

export const isFavorite = async (id: string): Promise<boolean> => {
  const current = await getFavorites();
  return current.includes(id);
};