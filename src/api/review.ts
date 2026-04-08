import { get, post, getAuthHeaders } from '../utils/apiClient';
import { API_BASE_URL } from '../config';
import { Review } from '../types';

export const getContractorReviews = async (
  contractorId: string,
  page = 1,
  limit = 10
): Promise<{ reviews: Review[]; page: number; pages: number; total: number }> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE_URL}/api/contractors/${contractorId}/reviews?page=${page}&limit=${limit}`, authHeaders);
};

export const leaveReview = async (
  contractorId: string,
  rating: number,
  title: string,
  comment: string
): Promise<Review> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE_URL}/api/contractors/${contractorId}/reviews`, { rating, title, comment }, authHeaders);
};

export const reportReview = async (reviewId: string, reason: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE_URL}/api/reports`, {
    reportedItem: reviewId,
    onModel: 'Review',
    reason,
  }, authHeaders);
};

export const getUserReviews = async (userId: string): Promise<Review[]> => {
  const authHeaders = await getAuthHeaders();
  const data = await get(`${API_BASE_URL}/api/reviews/user/${userId}`, authHeaders);
  return data.reviews || data;
};

export const fetchContractorReviews = async (contractorId: string): Promise<Review[]> => {
  return getContractorReviews(contractorId).then(data => data.reviews || []);
};
