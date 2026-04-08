import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config';
import { Contractor, ContractorsResponse } from '../types';

const getAuthHeaders = async () => {
  const token = await SecureStore.getItemAsync('userToken');
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

export const getTopRatedContractors = async (zipCode: string, limit = 6): Promise<Contractor[]> => {
  const res = await fetch(`${API_BASE_URL}/api/contractors/top-rated?zip=${zipCode}&limit=${limit}`);
  return handleResponse(res);
};

export const getNearbyTopRatedContractors = async (zipCode: string, excludeId?: string): Promise<Contractor[]> => {
  let url = `${API_BASE_URL}/api/contractors/nearby-top-rated?zip=${zipCode}`;
  if (excludeId) url += `&excludeId=${excludeId}`;
  const res = await fetch(url);
  return handleResponse(res);
};

export const getContractorBySlug = async (slug: string): Promise<Contractor> => {
  const res = await fetch(`${API_BASE_URL}/api/contractors/slug/${slug}`);
  return handleResponse(res);
};

export const getContractorById = async (id: string): Promise<Contractor> => {
  const res = await fetch(`${API_BASE_URL}/api/contractors/${id}`);
  return handleResponse(res);
};

export const browseContractors = async (params: {
  page?: number;
  limit?: number;
  zip?: string;
  category?: string;
  search?: string;
  minRating?: number;
  isVerified?: boolean;
  sortBy?: string;
}): Promise<ContractorsResponse> => {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, String(value));
    }
  });
  const res = await fetch(`${API_BASE_URL}/api/contractors?${queryParams}`);
  return handleResponse(res);
};

export const updateContractorProfile = async (data: Partial<Contractor>): Promise<Contractor> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/contractors/profile`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  return handleResponse(res);
};

export const followContractor = async (contractorId: string): Promise<void> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/contractors/${contractorId}/follow`, {
    method: 'POST',
    headers,
  });
  handleResponse(res);
};

export const unfollowContractor = async (contractorId: string): Promise<void> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/contractors/${contractorId}/follow`, {
    method: 'DELETE',
    headers,
  });
  handleResponse(res);
};

export const getPortfolio = async (contractorId: string): Promise<any[]> => {
  const res = await fetch(`${API_BASE_URL}/api/contractors/${contractorId}/portfolio`);
  return handleResponse(res);
};

export const addPortfolioItem = async (item: any): Promise<any> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/contractors/portfolio`, {
    method: 'POST',
    headers,
    body: JSON.stringify(item),
  });
  return handleResponse(res);
};

export const updatePortfolioItem = async (itemId: string, item: Partial<any>): Promise<any> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/contractors/portfolio/${itemId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(item),
  });
  return handleResponse(res);
};

export const deletePortfolioItem = async (itemId: string): Promise<void> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/contractors/portfolio/${itemId}`, {
    method: 'DELETE',
    headers,
  });
  handleResponse(res);
};

export const fetchContractorDetails = async (contractorId: string): Promise<Contractor> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/contractors/${contractorId}`, {
    headers,
  });
  return handleResponse(res);
};

export const submitReview = async (contractorId: string, reviewData: { rating: number; title: string; comment: string }): Promise<any> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/reviews`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ contractorId, ...reviewData }),
  });
  return handleResponse(res);
};