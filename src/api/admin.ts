import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import {
  User,
  UsersResponse,
  Contractor,
  ContractorsResponse,
  Review,
  Post,
  FlaggedItem,
  PlatformStats,
} from '../types';

const getAuthHeaders = async () => {
  const userInfo = JSON.parse(await AsyncStorage.getItem('userInfo') || '{}');
  return {
    'Content-Type': 'application/json',
    ...(userInfo.token ? { Authorization: `Bearer ${userInfo.token}` } : {}),
  };
};

const handleResponse = async (response: Response) => {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'An error occurred');
  }
  return data;
};

export const getAllUsers = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
}): Promise<UsersResponse> => {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, String(value));
    }
  });
  const res = await fetch(`${API_BASE_URL}/api/admin/users?${queryParams}`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};

export const updateUserStatus = async (userId: string, status: string): Promise<void> => {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ status }),
  });
  handleResponse(res);
};

export const deleteUser = async (userId: string): Promise<void> => {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  handleResponse(res);
};

export const getAllContractors = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  isVerified?: boolean;
}): Promise<ContractorsResponse> => {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, String(value));
    }
  });
  const res = await fetch(`${API_BASE_URL}/api/admin/contractors?${queryParams}`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};

export const approveContractor = async (contractorId: string): Promise<void> => {
  const res = await fetch(`${API_BASE_URL}/api/admin/contractors/${contractorId}/approve`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
  });
  handleResponse(res);
};

export const rejectContractor = async (contractorId: string, reason: string): Promise<void> => {
  const res = await fetch(`${API_BASE_URL}/api/admin/contractors/${contractorId}/reject`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ reason }),
  });
  handleResponse(res);
};

export const getFlaggedReviews = async (): Promise<FlaggedItem[]> => {
  const res = await fetch(`${API_BASE_URL}/api/admin/flagged/reviews`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};

export const getFlaggedPosts = async (): Promise<FlaggedItem[]> => {
  const res = await fetch(`${API_BASE_URL}/api/admin/flagged/posts`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};

export const moderateContent = async (
  type: string,
  id: string,
  action: 'approve' | 'reject'
): Promise<void> => {
  const res = await fetch(`${API_BASE_URL}/api/admin/moderate/${type}/${id}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ action }),
  });
  handleResponse(res);
};

export const getPlatformStats = async (): Promise<PlatformStats> => {
  const res = await fetch(`${API_BASE_URL}/api/admin/stats`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};

export const getCloudinarySignature = async (folder: string): Promise<{
  signature: string;
  api_key: string;
  cloud_name: string;
  timestamp: number;
}> => {
  const res = await fetch(`${API_BASE_URL}/api/admin/cloudinary-sign`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ folder }),
  });
  return handleResponse(res);
};

export const updatePlatformSettings = async (settings: any): Promise<void> => {
  const res = await fetch(`${API_BASE_URL}/api/admin/settings`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(settings),
  });
  handleResponse(res);
};

export const getCategories = async (): Promise<any[]> => {
  const res = await fetch(`${API_BASE_URL}/api/categories`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};

export const createCategory = async (category: any): Promise<any> => {
  const res = await fetch(`${API_BASE_URL}/api/admin/categories`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(category),
  });
  return handleResponse(res);
};

export const updateCategory = async (categoryId: string, category: any): Promise<any> => {
  const res = await fetch(`${API_BASE_URL}/api/admin/categories/${categoryId}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(category),
  });
  return handleResponse(res);
};

export const deleteCategory = async (categoryId: string): Promise<void> => {
  const res = await fetch(`${API_BASE_URL}/api/admin/categories/${categoryId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  handleResponse(res);
};

export const uploadToCloudinary = async (file: File | Blob, folder: string): Promise<string> => {
  // Mock upload implementation
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve('https://res.cloudinary.com/demo/image/upload/sample.jpg');
    }, 1000);
  });
};
