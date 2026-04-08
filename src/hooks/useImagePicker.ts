import { useCallback, useState } from 'react';
import { launchImageLibrary, launchCamera, ImagePickerResponse, Asset } from 'react-native-image-picker';
import { uploadToCloudinary } from '../api/admin';

interface UseImagePickerOptions {
  folder?: string;
  maxWidth?: number;
  maxHeight?: number;
  quality?: 0 | 0.1 | 0.2 | 0.3 | 0.4 | 0.5 | 0.6 | 0.7 | 0.8 | 0.9 | 1;
}

export const useImagePicker = (options: UseImagePickerOptions = {}) => {
  const { folder = 'ratedeed/uploads', maxWidth = 1920, maxHeight = 1920, quality = 0.8 } = options;

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
        includeBase64: false,
      });

      if (result.didCancel || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset: Asset = result.assets[0];
      if (!asset.uri) {
        throw new Error('No image URI returned');
      }

      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const file = new File([blob], asset.fileName || 'image.jpg', { type: asset.type });

      const imageUrl = await uploadToCloudinary(file, folder);
      return imageUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pick image');
      return null;
    } finally {
      setLoading(false);
    }
  }, [folder, maxWidth, maxHeight, quality]);

  const takePhoto = useCallback(async (): Promise<string | null> => {
    setLoading(true);
    setError(null);

    try {
      const result: ImagePickerResponse = await launchCamera({
        mediaType: 'photo',
        maxWidth,
        maxHeight,
        quality,
        includeBase64: false,
        cameraType: 'back',
      });

      if (result.didCancel || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset: Asset = result.assets[0];
      if (!asset.uri) {
        throw new Error('No image URI returned');
      }

      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const file = new File([blob], asset.fileName || 'image.jpg', { type: asset.type });

      const imageUrl = await uploadToCloudinary(file, folder);
      return imageUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to take photo');
      return null;
    } finally {
      setLoading(false);
    }
  }, [folder, maxWidth, maxHeight, quality]);

  const pickMultiple = useCallback(async (): Promise<string[]> => {
    setLoading(true);
    setError(null);

    try {
      const result: ImagePickerResponse = await launchImageLibrary({
        mediaType: 'photo',
        maxWidth,
        maxHeight,
        quality,
        includeBase64: false,
        selectionLimit: 10,
      });

      if (result.didCancel || !result.assets || result.assets.length === 0) {
        return [];
      }

      const urls: string[] = [];
      for (const asset of result.assets) {
        if (asset.uri) {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          const file = new File([blob], asset.fileName || 'image.jpg', { type: asset.type });
          const imageUrl = await uploadToCloudinary(file, folder);
          urls.push(imageUrl);
        }
      }

      return urls;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pick images');
      return [];
    } finally {
      setLoading(false);
    }
  }, [folder, maxWidth, maxHeight, quality]);

  return {
    pickFromLibrary,
    takePhoto,
    pickMultiple,
    loading,
    error,
  };
};
