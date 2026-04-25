import { getCloudinarySignature } from '../utils/apiClient';

/**
 * Upload a file to Cloudinary using signed parameters from the backend.
 * Specialized for React Native FormData.
 * @param fileUri - Local URI of the file
 * @param folder - Cloudinary folder name
 * @returns Secure URL of the uploaded image
 */
export async function uploadToCloudinary(
  fileUri: string,
  folder: string = 'ratedeed/uploads'
): Promise<string> {
  try {
    // Step 1: Get signed upload parameters from backend
    const signData = await getCloudinarySignature(folder);

    if (!signData) {
      throw new Error('Failed to get Cloudinary upload signature from server');
    }

    // Step 2: Prepare FormData for React Native
    const formData = new FormData();
    
    // Extract filename from URI
    const fileName = fileUri.split('/').pop() || 'upload.jpg';
    const match = /\.(\w+)$/.exec(fileName);
    const type = match ? `image/${match[1]}` : `image/jpeg`;

    // React Native FormData requires an object with uri, name, and type
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: type,
    } as any);

    formData.append('api_key', signData.api_key);
    formData.append('signature', signData.signature);
    formData.append('timestamp', signData.timestamp.toString());
    formData.append('folder', folder);

    // Step 3: Upload directly to Cloudinary
    const cloudinaryRes = await fetch(
      `https://api.cloudinary.com/v1_1/${signData.cloud_name}/image/upload`,
      {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    if (!cloudinaryRes.ok) {
      const errorData = await cloudinaryRes.json().catch(() => ({}));
      throw new Error(
        `Cloudinary upload failed: ${errorData?.error?.message || cloudinaryRes.statusText}`
      );
    }

    const data = await cloudinaryRes.json();
    return data.secure_url;
  } catch (error) {
      // console.error('uploadToCloudinary error:', error);
    throw error;
  }
}
