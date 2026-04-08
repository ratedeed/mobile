import { get, put, getAuthHeaders } from '../utils/apiClient';
import { API_BASE_URL } from '../config';

export const fetchUserProfile = async () => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE_URL}/api/users/profile`, authHeaders);
};

export const getUserProfile = async () => {
  return fetchUserProfile();
};

export const updateUserProfile = async (profileData) => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE_URL}/api/users/profile`, profileData, authHeaders);
};

export const changePassword = async (currentPassword, newPassword) => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE_URL}/api/users/change-password`, { currentPassword, newPassword }, authHeaders);
};

export const enable2FA = async () => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE_URL}/api/users/2fa`, { enable: true }, authHeaders);
};

export const disable2FA = async (code) => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE_URL}/api/users/2fa`, { enable: false, code }, authHeaders);
};
