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

export const handleResponse = async (response) => {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} - ${errorText || response.statusText}`);
  }
  // Check if the response has content before parsing as JSON
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return response.json();
  } else {
    return response.text(); // Or handle as appropriate for non-JSON responses
  }
};

/**
 * Fetches a list of contractors based on search criteria.
 * @param {Object} queryParams - Object containing query parameters (e.g., { zip: '12345', type: 'plumber', name: 'Acme', isFeatured: true }).
 * @returns {Promise<Array>} A list of contractors.
 */
export const browseContractors = async (queryParams = {}) => {
  const queryString = new URLSearchParams(queryParams).toString();
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/contractors?${queryString}`, {
    method: 'GET',
    headers: authHeaders,
  });
  return handleResponse(response);
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
  const response = await fetch(`${API_BASE}/api/contractors`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(contractorData),
  });
  return handleResponse(response);
};

/**
 * Fetches the current user's contractor profile.
 * @returns {Promise<Object>} The contractor profile of the authenticated user.
 */
export const getMyContractorProfile = async () => {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/contractors/profile`, {
    method: 'GET',
    headers: authHeaders,
  });
  return handleResponse(response);
};

/**
 * Updates the current user's contractor profile.
 * @param {Object} profileData - Data to update the contractor profile (e.g., { companyName, category, ... }).
 * @returns {Promise<Object>} The updated contractor object.
 */
export const updateContractorProfile = async (profileData) => {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/contractors/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(profileData),
  });
  return handleResponse(response);
};

/**
 * Fetches details for a specific contractor by ID.
 * @param {string} contractorId - The ID of the contractor.
 * @returns {Promise<Object>} The contractor details object.
 */
export const getContractorDetails = async (contractorId) => {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/contractors/${contractorId}`, {
    method: 'GET',
    headers: authHeaders,
  });
  return handleResponse(response);
};

/**
 * Sends a message to another user.
 * @param {Object} messageData - Data for the message (e.g., { recipientId, messageText }).
 * @returns {Promise<Object>} The sent message object.
 */
export const sendMessage = async (messageData) => {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(messageData),
  });
  return handleResponse(response);
};

/**
 * Lists all conversations for the authenticated user.
 * @returns {Promise<Array>} A list of conversation objects.
 */
export const listConversations = async () => {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/messages/conversations`, {
    method: 'GET',
    headers: authHeaders,
  });
  return handleResponse(response);
};

/**
 * Fetches messages within a conversation with a specific user.
 * @param {string} otherUserId - The ID of the other user in the conversation.
 * @returns {Promise<Array>} A list of message objects in the conversation.
 */
export const getConversationWithUser = async (otherUserId) => {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/messages/conversation/${otherUserId}`, {
    method: 'GET',
    headers: authHeaders,
  });
  return handleResponse(response);
};

/**
 * Marks a specific message as read.
 * @param {string} messageId - The ID of the message to mark as read.
 * @returns {Promise<void>}
 */
export const markMessageRead = async (messageId) => {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/messages/read/${messageId}`, {
    method: 'PUT',
    headers: authHeaders,
  });
  return handleResponse(response);
};

/**
 * Creates a new community post.
 * @param {Object} postData - Data for the new post (e.g., { caption, tags, location, imageFiles }).
 * @returns {Promise<Object>} The created post object.
 */
export const createPost = async (postData) => {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(postData),
  });
  return handleResponse(response);
};

/**
 * Fetches a list of community posts.
 * @param {Object} queryParams - Object containing query parameters (e.g., { limit: 10, page: 1, zipCode: '12345', onePerContractor: false }).
 * @returns {Promise<Array>} A list of post objects.
 */
export const listPosts = async (queryParams = {}) => {
  const queryString = new URLSearchParams(queryParams).toString();
  const authHeaders = await getAuthHeaders(); // optional if public
  const url = `${API_BASE}/api/posts?${queryString}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: authHeaders,
  });
  return handleResponse(response);
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
  const url = `${API_BASE}/api/posts/contractor/${contractorId}?${queryString}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: authHeaders,
  });
  return handleResponse(response);
};

/**
 * Likes a specific community post.
 * @param {string} postId - The ID of the post to like.
 * @returns {Promise<void>}
 */
export const likePost = async (postId) => {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/posts/${postId}/like`, {
    method: 'PUT',
    headers: authHeaders,
  });
  return handleResponse(response);
};

/**
 * Comments on a specific community post.
 * @param {string} postId - The ID of the post to comment on.
 * @param {Object} commentData - Data for the comment (e.g., { text }).
 * @returns {Promise<Object>} The created comment object.
 */
export const commentOnPost = async (postId, commentData) => {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(commentData),
  });
  return handleResponse(response);
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
  const url = `${API_BASE}/api/contractors/${contractorId}/reviews?${queryString}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: authHeaders,
  });
  return handleResponse(response);
};
/**
 * Submits a review for a specific contractor.
 * @param {string} contractorId - The ID of the contractor to review.
 * @param {Object} reviewData - Data for the review (e.g., { rating, title, comment }).
 * @returns {Promise<Object>} The submitted review object.
 */
export const submitReview = async (contractorId, reviewData) => {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/contractors/${contractorId}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(reviewData),
  });
  return handleResponse(response);
};