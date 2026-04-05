import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../config';
import { Review } from '../../types';

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

export const getContractorReviews = async (
  contractorId: string,
  page = 1,
  limit = 10
): Promise<{ reviews: Review[]; page: number; pages: number; total: number }> => {
  const res = await fetch(`${API_BASE_URL}/api/reviews/contractor/${contractorId}?page=${page}&limit=${limit}`);
  return handleResponse(res);
};

export const leaveReview = async (
  contractorId: string,
  rating: number,
  title: string,
  comment: string
): Promise<Review> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/reviews`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ contractorId, rating, title, comment }),
  });
  return handleResponse(res);
};

export const reportReview = async (reviewId: string, reason: string): Promise<void> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/reviews/${reviewId}/report`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason }),
  });
  handleResponse(res);
};

export const getUserReviews = async (userId: string): Promise<Review[]> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/reviews/user/${userId}`, {
    headers,
  });
  const data = await handleResponse(res);
  return data.reviews || data;
};

export const fetchContractorReviews = async (contractorId: string): Promise<Review[]> => {
  return getContractorReviews(contractorId).then(data => data.reviews || []);
};
