import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = 'ratedeed_favorites';

export const getFavorites = async (): Promise<string[]> => {
  try {
    const json = await AsyncStorage.getItem(FAVORITES_KEY);
    return json ? JSON.parse(json) : [];
  } catch (e) {
    console.error('Failed to get favorites', e);
    return [];
  }
};

export const addFavorite = async (id: string) => {
  try {
    const current = await getFavorites();
    if (!current.includes(id)) {
      const updated = [...current, id];
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error('Failed to add favorite', e);
  }
};

export const removeFavorite = async (id: string) => {
  try {
    const current = await getFavorites();
    const updated = current.filter(fid => fid !== id);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to remove favorite', e);
  }
};

export const isFavorite = async (id: string): Promise<boolean> => {
  const current = await getFavorites();
  return current.includes(id);
};
