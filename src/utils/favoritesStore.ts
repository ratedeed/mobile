import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

const FAVORITES_KEY = 'ratedeed_favorites';

async function getAuthToken(): Promise<string | null> {
  const userInfo = await AsyncStorage.getItem('userInfo');
  return userInfo ? JSON.parse(userInfo).token : null;
}

export const getFavorites = async (): Promise<string[]> => {
  try {
    const json = await AsyncStorage.getItem(FAVORITES_KEY);
    return json ? JSON.parse(json) : [];
  } catch (e) {
      // console.error('Failed to get favorites', e);
    return [];
  }
};

/**
 * Syncs local favorites with the server (merges them)
 */
export const syncFavoritesWithServer = async () => {
  const token = await getAuthToken();
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/users/favorites`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const serverIds = await response.json();
      if (Array.isArray(serverIds)) {
        const local = await getFavorites();
        const merged = Array.from(new Set([...local, ...serverIds]));
        await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(merged));
      // console.log('[Favorites] Mobile sync successful');
      }
    }
  } catch (err) {
      // console.error('[Favorites] Sync failed:', err);
  }
};

export const addFavorite = async (id: string) => {
  try {
    const current = await getFavorites();
    if (!current.includes(id)) {
      const updated = [...current, id];
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
      
      const token = await getAuthToken();
      if (token) {
        // Toggle endpoint on backend handles add/remove
        await fetch(`${API_BASE_URL}/api/users/favorite/${id}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    }
  } catch (e) {
      // console.error('Failed to add favorite', e);
  }
};

export const removeFavorite = async (id: string) => {
  try {
    const current = await getFavorites();
    const updated = current.filter(fid => fid !== id);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    
    const token = await getAuthToken();
    if (token) {
      // Toggle endpoint on backend handles add/remove
      await fetch(`${API_BASE_URL}/api/users/favorite/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }
  } catch (e) {
      // console.error('Failed to remove favorite', e);
  }
};

export const isFavorite = async (id: string): Promise<boolean> => {
  const current = await getFavorites();
  return current.includes(id);
};
