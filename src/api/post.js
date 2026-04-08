import { get, post, put, del, getAuthHeaders } from '../utils/apiClient';
import { API_BASE_URL } from '../config';

export const getFeedPosts = async (zipCode = null, queryParams = {}) => {
  const params = { ...queryParams };
  if (zipCode) {
    params.zipCode = zipCode;
  }
  const queryString = new URLSearchParams(params).toString();
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE_URL}/api/posts?${queryString}`, authHeaders);
};

export const getContractorPosts = async (contractorId, queryParams = {}) => {
  const queryString = new URLSearchParams(queryParams).toString();
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE_URL}/api/posts/contractor/${contractorId}?${queryString}`, authHeaders);
};

export const createPost = async (postData) => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE_URL}/api/posts`, postData, authHeaders);
};

export const likePost = async (postId) => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE_URL}/api/posts/${postId}/like`, {}, authHeaders);
};

export const unlikePost = async (postId) => {
  // Backend uses same endpoint for both like and unlike (toggle)
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE_URL}/api/posts/${postId}/like`, {}, authHeaders);
};

export const commentOnPost = async (postId, text) => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE_URL}/api/posts/${postId}/comments`, { text }, authHeaders);
};

export const deletePost = async (postId) => {
  const authHeaders = await getAuthHeaders();
  return del(`${API_BASE_URL}/api/posts/${postId}`, authHeaders);
};

export const getUserPosts = async (userId, queryParams = {}) => {
  // This would need a backend endpoint for user posts
  console.warn('getUserPosts: No backend endpoint available for user posts');
  return { posts: [], page: 1, pages: 0, total: 0 };
};
