import { API_BASE_URL } from '../config';
import { getAuthHeaders, handleResponse } from '../utils/apiClient'; // Import getAuthHeaders and handleResponse

export const fetchUserProfile = async () => {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
    method: 'GET',
    headers: authHeaders,
  });
  return handleResponse(response);
};

export const updateUserProfile = async (profileData) => {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(profileData),
  });
  return handleResponse(response);
};

export const changePassword = async (currentPassword, newPassword) => {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/users/change-password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return handleResponse(response);
};

export const toggleTwoFactorAuth = async (enable) => {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/users/2fa`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({ enable }),
  });
  return handleResponse(response);
};