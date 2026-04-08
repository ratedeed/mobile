import { get, post, put, del, browseContractors as apiClientBrowse, getContractorDetails as apiClientGetContractorDetails, updateContractorProfile as apiClientUpdateContractorProfile, submitReview as apiClientSubmitReview, listContractorReviews as apiClientListContractorReviews, listContractorPosts as apiClientListContractorPosts, getAuthHeaders } from '../utils/apiClient';
import { API_BASE_URL } from '../config';

export const fetchContractorDetails = async (contractorId, token) => {
  return apiClientGetContractorDetails(contractorId, token);
};

export const fetchFeaturedContractors = async (zipCode = null) => {
  const filters = { isFeatured: true };
  if (zipCode) {
    filters.zipCode = zipCode;
  }
  return browseContractors(filters);
};

export const searchContractors = async (filters) => {
  return browseContractors(filters);
};

export const browseContractors = async (queryParams = {}) => {
  return apiClientBrowse(queryParams);
};

export const submitReview = async (contractorId, reviewData) => {
  return apiClientSubmitReview(contractorId, reviewData);
};

export const fetchContractorReviews = async (contractorId, queryParams = {}) => {
  return apiClientListContractorReviews(contractorId, queryParams);
};

export const updateContractorProfile = async (profileData, token) => {
  return apiClientUpdateContractorProfile(profileData, token);
};

// Additional functions that HomeScreen and other screens may need
export const getTopRatedContractors = async (zipCode, limit = 6) => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE_URL}/api/contractors?zipCode=${zipCode}&limit=${limit}&sortBy=rating`, authHeaders);
};

export const getNearbyTopRatedContractors = async (zipCode, excludeId) => {
  const authHeaders = await getAuthHeaders();
  let url = `${API_BASE_URL}/api/contractors?zipCode=${zipCode}&limit=6&sortBy=rating`;
  if (excludeId) {
    url += `&excludeId=${excludeId}`;
  }
  return get(url, authHeaders);
};

export const getContractorBySlug = async (slug) => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE_URL}/api/contractors/slug/${slug}`, authHeaders);
};

export const getContractorById = async (id) => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE_URL}/api/contractors/${id}`, authHeaders);
};

export const followContractor = async (contractorId) => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE_URL}/api/contractors/${contractorId}/follow`, {}, authHeaders);
};

export const unfollowContractor = async (contractorId) => {
  const authHeaders = await getAuthHeaders();
  return del(`${API_BASE_URL}/api/contractors/${contractorId}/follow`, authHeaders);
};

export const getPortfolio = async (contractorId) => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE_URL}/api/contractors/${contractorId}/portfolio`, authHeaders);
};

export const addPortfolioItem = async (item) => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE_URL}/api/contractors/portfolio`, item, authHeaders);
};

export const updatePortfolioItem = async (itemId, item) => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE_URL}/api/contractors/portfolio/${itemId}`, item, authHeaders);
};

export const deletePortfolioItem = async (itemId) => {
  const authHeaders = await getAuthHeaders();
  return del(`${API_BASE_URL}/api/contractors/portfolio/${itemId}`, authHeaders);
};

export const getContractorLeads = async () => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE_URL}/api/contractors/leads`, authHeaders);
};

export const getContractorEarnings = async () => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE_URL}/api/contractors/earnings`, authHeaders);
};
