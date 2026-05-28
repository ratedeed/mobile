import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';
// ================================================================
// Cloudinary Upload Utility for React Native
// ================================================================

import { getCloudinarySignature } from '../api';

interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
  format: string;
}

export const CLOUDINARY_FOLDERS = {
  CONTRACTOR_PROFILE: 'ratedeed/contractor_profile_pictures',
  CONTRACTOR_BANNER: 'ratedeed/contractor_banner_images',
  POST_IMAGES: 'ratedeed/post_images',
  PORTFOLIO: 'ratedeed/portfolio',
  LICENSES: 'ratedeed/licenses',
  USER_PROFILE: 'ratedeed/user_profile_pictures',
  USER_BANNER: 'ratedeed/user_banner_images',
  CHAT: 'ratedeed/chat',
} as const;

/**
 * Upload a local file URI to Cloudinary using signed parameters from the backend.
 * @param localUri - The local file URI (e.g., from ImagePicker)
 * @param folder - The Cloudinary folder
 * @returns The secure URL of the uploaded image
 */
export async function uploadToCloudinary(
  localUri: string,
  folder: string
): Promise<string> {
  // If the URI is already a Cloudinary/web URL, return it immediately (caching/retry optimization)
  if (localUri.startsWith('http://') || localUri.startsWith('https://')) {
    return localUri;
  }

  try {
    // Step 1: Get signed upload parameters from backend
    const signData = await getCloudinarySignature(folder);

    if (!signData || !signData.signature) {
      throw new Error('Failed to get upload signature from server. Please try again.');
    }

    // Step 2: Upload directly to Cloudinary
    const formData = new FormData();

    if (localUri.startsWith('data:')) {
      // Data URI (base64) — pass the raw string to Cloudinary
      formData.append("file", localUri);
    } else {
      // File URI — use React Native FormData file object
      const filename = localUri.split('/').pop() || 'image.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      const fileToUpload = {
        uri: Platform.OS === "android" ? localUri : localUri.replace("file://", ""),
        name: filename,
        type: type || "image/jpeg",
      };

      formData.append("file", fileToUpload as any);
    }

    formData.append('api_key', String(signData.api_key));
    formData.append('signature', String(signData.signature));
    formData.append('timestamp', String(signData.timestamp));
    formData.append('folder', folder);

    const cloudinaryRes = await fetch(
      `https://api.cloudinary.com/v1_1/${signData.cloud_name}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!cloudinaryRes.ok) {
      throw new Error('Image upload failed. Please try again.');
    }

    const data = (await cloudinaryRes.json()) as CloudinaryUploadResult;
    return data.secure_url;
  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        folder,
        localUriLength: localUri ? localUri.length : 0,
        isDataUri: localUri ? localUri.startsWith('data:') : false,
      }
    });
    throw error;
  }
}