import { useCallback, useState } from 'react';
import { launchImageLibrary, launchCamera, ImagePickerResponse } from 'react-native-image-picker';

interface UseImagePickerOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: 0 | 0.1 | 0.2 | 0.3 | 0.4 | 0.5 | 0.6 | 0.7 | 0.8 | 0.9 | 1;
}

export const useImagePicker = (options: UseImagePickerOptions = {}) => {
  const { maxWidth = 1920, maxHeight = 1920, quality = 0.8 } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickFromLibrary = useCallback(async (): Promise<string | null> => {
    setLoading(true);
    setError(null);

    try {
      const result: ImagePickerResponse = await launchImageLibrary({
        mediaType: 'photo',
        maxWidth,
        maxHeight,
        quality,
      });

      if (result.didCancel || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        throw new Error('Image size must be less than 5MB');
      }
      if (!asset.uri) {
        throw new Error('No image data returned');
      }

      return asset.uri;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pick image');
      return null;
    } finally {
      setLoading(false);
    }
  }, [maxWidth, maxHeight, quality]);

  const takePhoto = useCallback(async (): Promise<string | null> => {
    setLoading(true);
    setError(null);

    try {
      const result: ImagePickerResponse = await launchCamera({
        mediaType: 'photo',
        maxWidth,
        maxHeight,
        quality,
        cameraType: 'back',
      });

      if (result.didCancel || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        throw new Error('Image size must be less than 5MB');
      }
      if (!asset.uri) {
        throw new Error('No image data returned');
      }

      return asset.uri;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to take photo');
      return null;
    } finally {
      setLoading(false);
    }
  }, [maxWidth, maxHeight, quality]);

  const pickMultiple = useCallback(async (): Promise<string[]> => {
    setLoading(true);
    setError(null);

    try {
      const result: ImagePickerResponse = await launchImageLibrary({
        mediaType: 'photo',
        maxWidth,
        maxHeight,
        quality,
        selectionLimit: 10,
      });

      if (result.didCancel || !result.assets || result.assets.length === 0) {
        return [];
      }

      const urls: string[] = [];
      for (const asset of result.assets) {
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          throw new Error('One or more images exceed the 5MB size limit');
        }
        if (asset.uri) {
          urls.push(asset.uri);
        }
      }

      return urls;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pick images');
      return [];
    } finally {
      setLoading(false);
    }
  }, [maxWidth, maxHeight, quality]);

  return {
    pickFromLibrary,
    takePhoto,
    pickMultiple,
    loading,
    error,
  };
};