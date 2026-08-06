import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import { get, post as apiPost, del } from './apiClient';
import { getSecureItem } from './secureStore';
import { isDemoMode } from './demoMode';

const FAVORITES_KEY = 'ratedeed_favorites';
const SEEDED_KEY = 'ratedeed_favorites_seeded';

const seedFavorites = async (): Promise<string[]> => {
  return ['contractor-1', 'contractor-3', 'contractor-7'];
};

export const getFavorites = async (): Promise<string[]> => {
  if (isDemoMode()) {
    try {
      const seeded = await AsyncStorage.getItem(SEEDED_KEY);
      if (!seeded) {
        const initial = await seedFavorites();
        await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(initial));
        await AsyncStorage.setItem(SEEDED_KEY, '1');
        return initial;
      }
      const json = await AsyncStorage.getItem(FAVORITES_KEY);
      return json ? JSON.parse(json) : [];
    } catch {
      return [];
    }
  }

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
  if (isDemoMode()) return;
  const token = await getSecureItem('auth_token');
  if (!token) return;

  try {
    const serverIds = await get(`${API_BASE_URL}/api/users/favorites`);
    if (Array.isArray(serverIds)) {
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(serverIds));
    }
  } catch {
    // sync failure is non-critical
  }
};

export const addFavorite = async (id: string): Promise<void> => {
  const current = await getFavorites();
  const alreadyFav = current.includes(id);
  if (!alreadyFav) {
    const updated = [...current, id];
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  }
  if (isDemoMode()) return;
  try {
    await apiPost(`${API_BASE_URL}/api/users/favorite/${id}`, {});
  } catch (error) {
    if (!alreadyFav) {
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(current));
    }
    throw error;
  }
};

export const removeFavorite = async (id: string): Promise<void> => {
  const current = await getFavorites();
  const wasFav = current.includes(id);
  if (wasFav) {
    const updated = current.filter(fid => fid !== id);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  }
  if (isDemoMode()) return;
  try {
    await apiPost(`${API_BASE_URL}/api/users/favorite/${id}`, {});
  } catch (error) {
    if (wasFav) {
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(current));
    }
    throw error;
  }
};

export const isFavorite = async (id: string): Promise<boolean> => {
  const current = await getFavorites();
  return current.includes(id);
};