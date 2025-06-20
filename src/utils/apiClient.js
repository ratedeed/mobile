import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL } from '../config';

const API_BASE = API_BASE_URL;

/**
 * Helper function to get authorization headers with JWT token.
 * @returns {Promise<Object>} Headers object with Authorization if token exists.
 */
export const getAuthHeaders = async () => {
  const token = await AsyncStorage.getItem('userToken');
  if (!token) {
    console.warn("Authentication token not found in AsyncStorage. API requests may fail.");
  }
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

/**
 * Handles API responses, checking for errors and parsing JSON.
 * @param {Response} response - The fetch API response object.
 * @returns {Promise<any>} The parsed JSON data or text.
 * @throws {Error} If the response is not OK.
 */
export const handleResponse = async (response) => {
  if (!response.ok) {
    const errorText = await response.text();
    let errorData = {};
    try {
      errorData = JSON.parse(errorText);
    } catch (e) {
      // If not JSON, use the raw text
      errorData = { message: errorText || response.statusText };
    }
    const error = new Error(errorData.message || `API Error: ${response.status}`);
    error.response = response; // Attach the original response object
    error.data = errorData; // Attach parsed error data
    throw error;
  }
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  } else {
    return response.text();
  }
};

/**
 * Generic GET request.
 * @param {string} url - The API endpoint URL.
 * @param {Object} headers - Additional headers for the request.
 * @returns {Promise<any>} The response data.
 */
export const get = async (url, headers = {}) => {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...headers,
    },
  });
  return handleResponse(response);
};

/**
 * Generic POST request.
 * @param {string} url - The API endpoint URL.
 * @param {Object} data - The data to send in the request body.
 * @param {Object} headers - Additional headers for the request.
 * @returns {Promise<any>} The response data.
 */
export const post = async (url, data, headers = {}) => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  } catch (error) {
    console.error('apiClient.js: Network or Fetch Error during POST to', url, ':', error);
    // Re-throw the original error to preserve its properties (e.g., error.response)
    throw error;
  }
};

/**
 * Generic PUT request.
 * @param {string} url - The API endpoint URL.
 * @param {Object} data - The data to send in the request body.
 * @param {Object} headers - Additional headers for the request.
 * @returns {Promise<any>} The response data.
 */
export const put = async (url, data, headers = {}) => {
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

/**
 * Fetches a list of contractors based on search criteria.
 * @param {Object} queryParams - Object containing query parameters (e.g., { zip: '12345', type: 'plumber', name: 'Acme', isFeatured: true }).
 * @returns {Promise<Array>} A list of contractors.
 */
export const browseContractors = async (queryParams = {}) => {
  const queryString = new URLSearchParams(queryParams).toString();
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/contractors?${queryString}`, authHeaders);
};

/**
 * Fetches a list of featured contractors.
 * @returns {Promise<Array>} A list of featured contractors.
 */

/**
 * Creates a new contractor profile.
 * @param {Object} contractorData - Data for the new contractor (e.g., { firstName, lastName, email, password, companyName, category, zipCodesCovered }).
 * @returns {Promise<Object>} The created contractor object.
 */
export const createContractor = async (contractorData) => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/api/contractors`, contractorData, authHeaders);
};

/**
 * Fetches the current user's contractor profile.
 * @returns {Promise<Object>} The contractor profile of the authenticated user.
 */
export const getMyContractorProfile = async () => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/contractors/profile`, authHeaders);
};

/**
 * Updates the current user's contractor profile.
 * @param {Object} profileData - Data to update the contractor profile (e.g., { companyName, category, ... }).
 * @returns {Promise<Object>} The updated contractor object.
 */
export const updateContractorProfile = async (profileData) => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/api/contractors/profile`, profileData, authHeaders);
};

/**
 * Fetches details for a specific contractor by ID.
 * @param {string} contractorId - The ID of the contractor.
 * @returns {Promise<Object>} The contractor details object.
 */
export const getContractorDetails = async (contractorId) => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/contractors/${contractorId}`, authHeaders);
};

/**
 * Sends a message to another user.
 * @param {Object} messageData - Data for the message (e.g., { recipientId, messageText }).
 * @returns {Promise<Object>} The sent message object.
 */
export const sendMessage = async (messageData) => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/api/messages`, messageData, authHeaders);
};

/**
 * Lists all conversations for the authenticated user.
 * @returns {Promise<Array>} A list of conversation objects.
 */
export const listConversations = async () => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/messages/conversations`, authHeaders);
};

/**
 * Fetches messages within a conversation with a specific user.
 * @param {string} otherUserId - The ID of the other user in the conversation.
 * @returns {Promise<Array>} A list of message objects in the conversation.
 */
export const getConversationWithUser = async (otherUserId) => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/messages/conversation/${otherUserId}`, authHeaders);
};

/**
 * Marks a specific message as read.
 * @param {string} messageId - The ID of the message to mark as read.
 * @returns {Promise<void>}
 */
export const markMessageRead = async (messageId) => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/api/messages/read/${messageId}`, {}, authHeaders);
};

/**
 * Creates a new community post.
 * @param {Object} postData - Data for the new post (e.g., { caption, tags, location, imageFiles }).
 * @returns {Promise<Object>} The created post object.
 */
export const createPost = async (postData) => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/api/posts`, postData, authHeaders);
};

/**
 * Fetches a list of community posts.
 * @param {Object} queryParams - Object containing query parameters (e.g., { limit: 10, page: 1, zipCode: '12345', onePerContractor: false }).
 * @returns {Promise<Array>} A list of post objects.
 */
export const listPosts = async (queryParams = {}) => {
  const queryString = new URLSearchParams(queryParams).toString();
  const authHeaders = await getAuthHeaders(); // optional if public
  return get(`${API_BASE}/api/posts?${queryString}`, authHeaders);
};

/**
 * Fetches a list of community posts for a specific contractor.
 * @param {string} contractorId - The ID of the contractor.
 * @param {Object} queryParams - Object containing query parameters (e.g., { limit: 10, page: 1 }).
 * @returns {Promise<Array>} A list of post objects.
 */
export const listContractorPosts = async (contractorId, queryParams = {}) => {
  const queryString = new URLSearchParams(queryParams).toString();
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/posts/contractor/${contractorId}?${queryString}`, authHeaders);
};

/**
 * Likes a specific community post.
 * @param {string} postId - The ID of the post to like.
 * @returns {Promise<void>}
 */
export const likePost = async (postId) => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/api/posts/${postId}/like`, {}, authHeaders);
};

/**
 * Comments on a specific community post.
 * @param {string} postId - The ID of the post to comment on.
 * @param {Object} commentData - Data for the comment (e.g., { text }).
 * @returns {Promise<Object>} The created comment object.
 */
export const commentOnPost = async (postId, commentData) => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/api/posts/${postId}/comments`, commentData, authHeaders);
};

/**
 * Fetches a list of reviews for a specific contractor.
 * @param {string} contractorId - The ID of the contractor.
 * @param {Object} queryParams - Object containing query parameters (e.g., { limit: 10, page: 1 }).
 * @returns {Promise<Object>} An object containing a list of review objects, page info, and total.
 */
export const listContractorReviews = async (contractorId, queryParams = {}) => {
  const queryString = new URLSearchParams(queryParams).toString();
  const authHeaders = await getAuthHeaders(); // Reviews are public, but good to include auth if available
  return get(`${API_BASE}/api/contractors/${contractorId}/reviews?${queryString}`, authHeaders);
};

/**
 * Submits a review for a specific contractor.
 * @param {string} contractorId - The ID of the contractor to review.
 * @param {Object} reviewData - Data for the review (e.g., { rating, title, comment }).
 * @returns {Promise<Object>} The submitted review object.
 */
export const submitReview = async (contractorId, reviewData) => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/api/contractors/${contractorId}/reviews`, reviewData, authHeaders);
};