import { get, post, getAuthHeaders } from '../utils/apiClient';
import { API_BASE_URL } from '../config';

export const getContractorReviews = async (contractorId, page = 1, limit = 10) => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE_URL}/api/contractors/${contractorId}/reviews?page=${page}&limit=${limit}`, authHeaders);
};

export const leaveReview = async (contractorId, rating, title, comment) => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE_URL}/api/contractors/${contractorId}/reviews`, { rating, title, comment }, authHeaders);
};

export const reportReview = async (reviewId, reason) => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE_URL}/api/reports`, {
    reportedItem: reviewId,
    onModel: 'Review',
    reason,
  }, authHeaders);
};

export const getUserReviews = async (userId) => {
  const authHeaders = await getAuthHeaders();
  const data = await get(`${API_BASE_URL}/api/reviews/user/${userId}`, authHeaders);
  return data.reviews || data;
};

export const fetchContractorReviews = async (contractorId) => {
  return getContractorReviews(contractorId).then(data => data.reviews || []);
};
