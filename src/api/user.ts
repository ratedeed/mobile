import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import { User } from '../types';

const getAuthHeaders = async () => {
  const token = await AsyncStorage.getItem('userToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handleResponse = async (response: Response) => {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'An error occurred');
  }
  return data;
};

export const getUserProfile = async (): Promise<User> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/users/profile`, {
    headers,
  });
  return handleResponse(res);
};

export const updateUserProfile = async (data: Partial<User>): Promise<User> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/users/profile`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  return handleResponse(res);
};

export const updateProfilePicture = async (pictureUrl: string): Promise<User> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/users/profile`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ profilePicture: pictureUrl }),
  });
  return handleResponse(res);
};

export const updateBannerImage = async (imageUrl: string): Promise<User> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/users/profile`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ bannerImage: imageUrl }),
  });
  return handleResponse(res);
};

export const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/users/password`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  handleResponse(res);
};

export const enable2FA = async (): Promise<{ qrCode: string }> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/users/2fa/enable`, {
    method: 'POST',
    headers,
  });
  return handleResponse(res);
};

export const disable2FA = async (code: string): Promise<void> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/users/2fa/disable`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code }),
  });
  handleResponse(res);
};

export const fetchUserProfile = async (): Promise<User> => {
  return getUserProfile();
};
