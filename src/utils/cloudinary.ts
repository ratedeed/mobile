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
  // Step 1: Get signed upload parameters from backend
  const signData = await getCloudinarySignature(folder);

  if (!signData) {
    throw new Error('Failed to get Cloudinary upload signature from server');
  }

  // Step 2: Upload directly to Cloudinary
  const formData = new FormData();
  
  // Extract filename from URI
  const filename = localUri.split('/').pop() || 'image.jpg';
  
  // Infer type
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : `image`;

  formData.append('file', {
    uri: localUri,
    name: filename,
    type,
  } as any);
  
  formData.append('api_key', signData.api_key);
  formData.append('signature', signData.signature);
  formData.append('timestamp', signData.timestamp);
  formData.append('folder', folder);

  const cloudinaryRes = await fetch(
    `https://api.cloudinary.com/v1_1/${signData.cloud_name}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!cloudinaryRes.ok) {
    const errorText = await cloudinaryRes.text();
    throw new Error(`Cloudinary upload failed: ${errorText}`);
  }

  const data = (await cloudinaryRes.json()) as CloudinaryUploadResult;
  return data.secure_url;
}