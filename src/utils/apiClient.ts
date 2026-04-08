import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import {
  Contractor,
  Post,
  Review,
  User,
  PortfolioItem,
  StripeConnectStatus,
  Quote,
  Lead,
  Job,
  Earnings,
  Notification,
  UsersResponse,
  ContractorsResponse,
  FlaggedItem,
  PlatformStats,
  UserQueryParams,
  ContractorQueryParams,
  PostComment,
} from '../types/index';

const API_BASE = API_BASE_URL;

export interface CreatePostData {
  caption: string;
  images?: string[];
  [key: string]: any;
}

export interface CreateQuoteData {
  contractorId: string;
  clientId: string;
  clientName?: string;
  lineItems: Array<{ description: string; quantity: number; unitPrice: number }>;
  [key: string]: any;
}

/**
 * Helper function to get authorization headers with JWT token.
 * @param {string} [externalToken] - Optional external token to use instead of stored token.
 * @returns {Promise<Record<string, string>>} Headers object with Authorization if token exists.
 */
export const getAuthHeaders = async (externalToken?: string): Promise<Record<string, string>> => {
  if (externalToken) {
    return { 'Authorization': `Bearer ${externalToken}` };
  }
  const userInfo = await AsyncStorage.getItem('userInfo');
  const token = userInfo ? JSON.parse(userInfo).token : null;
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
export const handleResponse = async (response: Response): Promise<any> => {
  if (!response.ok) {
    const errorText = await response.text();
    let errorData: any = {};
    try {
      errorData = JSON.parse(errorText);
    } catch (e) {
      errorData = { message: errorText || response.statusText };
    }
    const error: any = new Error(errorData.message || `API Error: ${response.status}`);
    error.response = response;
    error.data = errorData;
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
 */
export const get = async (url: string, headers: Record<string, string> = {}): Promise<any> => {
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
 */
export const post = async (url: string, data: any, headers: Record<string, string> = {}): Promise<any> => {
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
    console.error('apiClient.ts: Network or Fetch Error during POST to', url, ':', error);
    throw error;
  }
};

/**
 * Generic PUT request.
 */
export const put = async (url: string, data: any, headers: Record<string, string> = {}): Promise<any> => {
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
 * Generic DELETE request.
 */
export const del = async (url: string, headers: Record<string, string> = {}): Promise<any> => {
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      ...headers,
    },
  });
  return handleResponse(response);
};

// ==========================================
// Existing Contractor API implementations
// ==========================================

export const browseContractors = async (queryParams: Record<string, any> = {}): Promise<ContractorsResponse> => {
  const queryString = new URLSearchParams(queryParams as Record<string, string>).toString();
  const url = `${API_BASE}/api/contractors?${queryString}`;
  const authHeaders = await getAuthHeaders();
  return get(url, authHeaders);
};

export const createContractor = async (contractorData: Partial<Contractor>): Promise<Contractor> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/api/contractors`, contractorData, authHeaders);
};

export const getMyContractorProfile = async (token?: string): Promise<Contractor> => {
  const authHeaders = await getAuthHeaders(token);
  return get(`${API_BASE}/api/contractors/profile`, authHeaders);
};

export const updateContractorProfile = async (profileData: Partial<Contractor>, token?: string): Promise<Contractor> => {
  const authHeaders = await getAuthHeaders(token);
  return put(`${API_BASE}/api/contractors/profile`, profileData, authHeaders);
};

export const getContractorDetails = async (contractorId: string, token?: string): Promise<Contractor> => {
  const authHeaders = await getAuthHeaders(token);
  if (contractorId === 'profile') {
    return get(`${API_BASE}/api/contractors/profile`, authHeaders);
  }
  return get(`${API_BASE}/api/contractors/${contractorId}`, authHeaders);
};

// ==========================================
// Messaging API
// ==========================================

export const sendMessage = async (messageData: any): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/api/messages`, messageData, authHeaders);
};

export const listConversations = async (): Promise<any[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/messages/conversations`, authHeaders);
};

export const getConversationWithUser = async (otherUserId: string): Promise<any[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/messages/conversation/${otherUserId}`, authHeaders);
};

export const markMessageRead = async (messageId: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/api/messages/read/${messageId}`, {}, authHeaders);
};

// ==========================================
// Existing Posts & Reviews APIs
// ==========================================

export const createPost = async (postData: CreatePostData): Promise<Post> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/api/posts`, postData, authHeaders);
};

export const listPosts = async (queryParams: Record<string, any> = {}): Promise<{ posts: Post[] }> => {
  const queryString = new URLSearchParams(queryParams as Record<string, string>).toString();
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/posts?${queryString}`, authHeaders);
};

export const listContractorPosts = async (contractorId: string, queryParams: Record<string, any> = {}): Promise<Post[]> => {
  const queryString = new URLSearchParams(queryParams as Record<string, string>).toString();
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/posts/contractor/${contractorId}?${queryString}`, authHeaders);
};

export const likePost = async (postId: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/api/posts/${postId}/like`, {}, authHeaders);
};

export const commentOnPost = async (postId: string, commentData: any): Promise<PostComment> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/api/posts/${postId}/comments`, commentData, authHeaders);
};

export const listContractorReviews = async (contractorId: string, queryParams: Record<string, any> = {}): Promise<{ reviews: Review[], page: number, total: number }> => {
  const queryString = new URLSearchParams(queryParams as Record<string, string>).toString();
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/contractors/${contractorId}/reviews?${queryString}`, authHeaders);
};

export const submitReview = async (contractorId: string, reviewData: Partial<Review>): Promise<Review> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/api/contractors/${contractorId}/reviews`, reviewData, authHeaders);
};

export const submitReport = async (reportData: any): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/api/reports`, reportData, authHeaders);
};

export const getReports = async (): Promise<any[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/reports`, authHeaders);
};

export const getNotifications = async (): Promise<Notification[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/notifications`, authHeaders);
};

export const markNotificationRead = async (notificationId: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/api/notifications/${notificationId}/read`, {}, authHeaders);
};

export const markAllNotificationsRead = async (): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/api/notifications/read-all`, {}, authHeaders);
};

export const deleteNotification = async (notificationId: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return del(`${API_BASE}/api/notifications/${notificationId}`, authHeaders);
};

// ==========================================
// NEW Contractor APIs
// ==========================================

export const getTopRatedContractors = async (zipCode: string, limit?: number): Promise<Contractor[]> => {
  const queryString = new URLSearchParams();
  queryString.append('zipCode', zipCode);
  if (limit) queryString.append('limit', limit.toString());
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/contractors/top-rated?${queryString.toString()}`, authHeaders);
};

export const getNearbyTopRatedContractors = async (zipCode: string, excludeId?: string): Promise<Contractor[]> => {
  const queryString = new URLSearchParams();
  queryString.append('zipCode', zipCode);
  if (excludeId) queryString.append('excludeId', excludeId);
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/contractors/nearby?${queryString.toString()}`, authHeaders);
};

export const getContractorBySlug = async (slug: string): Promise<Contractor> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/contractors/slug/${slug}`, authHeaders);
};

// ==========================================
// NEW Post APIs
// ==========================================

export const getFeedPosts = async (zipCode?: string): Promise<{ posts: Post[] }> => {
  const queryString = zipCode ? `?zipCode=${zipCode}` : '';
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/posts/feed${queryString}`, authHeaders);
};

export const getContractorPosts = async (contractorId: string): Promise<Post[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/posts/contractor/${contractorId}`, authHeaders);
};

export const getUserPosts = async (userId: string): Promise<{ posts: Post[] }> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/posts/user/${userId}`, authHeaders);
};

export const unlikePost = async (postId: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/api/posts/${postId}/unlike`, {}, authHeaders);
};

export const deletePost = async (postId: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return del(`${API_BASE}/api/posts/${postId}`, authHeaders);
};

export const reportPost = async (postId: string, reason: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/api/reports`, { type: 'post', itemId: postId, reason }, authHeaders);
};

// ==========================================
// NEW Portfolio APIs
// ==========================================

export const addPortfolioItem = async (item: PortfolioItem): Promise<PortfolioItem> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/api/contractors/portfolio`, item, authHeaders);
};

export const updatePortfolioItem = async (itemId: string, item: Partial<PortfolioItem>): Promise<PortfolioItem> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/api/contractors/portfolio/${itemId}`, item, authHeaders);
};

export const deletePortfolioItem = async (itemId: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return del(`${API_BASE}/api/contractors/portfolio/${itemId}`, authHeaders);
};

// ==========================================
// NEW User APIs
// ==========================================

export const updateProfilePicture = async (pictureUrl: string): Promise<User> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/api/users/profile-picture`, { pictureUrl }, authHeaders);
};

export const updateBannerImage = async (imageUrl: string): Promise<User> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/api/users/banner-image`, { imageUrl }, authHeaders);
};

export const getUserReviews = async (userId: string): Promise<Review[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/users/${userId}/reviews`, authHeaders);
};

export const getUserProjects = async (userId: string): Promise<Post[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/users/${userId}/projects`, authHeaders);
};

// ==========================================
// NEW Stripe/Payment APIs
// ==========================================

export const getStripeConnectUrl = async (): Promise<{ url: string }> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/stripe/connect-url`, authHeaders);
};

export const getStripeAccountStatus = async (): Promise<StripeConnectStatus> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/stripe/account-status`, authHeaders);
};

export const createQuote = async (quoteData: CreateQuoteData): Promise<Quote> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/api/quotes`, quoteData, authHeaders);
};

export const getContractorLeads = async (): Promise<Lead[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/leads/contractor`, authHeaders);
};

export const getContractorQuotes = async (): Promise<Quote[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/quotes/contractor`, authHeaders);
};

export const getContractorJobs = async (): Promise<Job[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/jobs/contractor`, authHeaders);
};

export const getContractorEarnings = async (): Promise<Earnings> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/stripe/earnings`, authHeaders);
};

// ==========================================
// NEW Admin APIs
// ==========================================

export const getAllUsers = async (params: UserQueryParams): Promise<UsersResponse> => {
  const queryString = new URLSearchParams(params as Record<string, string>).toString();
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/admin/users?${queryString}`, authHeaders);
};

export const updateUserStatus = async (userId: string, status: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/api/admin/users/${userId}/status`, { status }, authHeaders);
};

export const deleteUser = async (userId: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return del(`${API_BASE}/api/admin/users/${userId}`, authHeaders);
};

export const getAllContractors = async (params: ContractorQueryParams): Promise<ContractorsResponse> => {
  const queryString = new URLSearchParams(params as Record<string, string>).toString();
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/admin/contractors?${queryString}`, authHeaders);
};

export const approveContractor = async (contractorId: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/api/admin/contractors/${contractorId}/approve`, {}, authHeaders);
};

export const rejectContractor = async (contractorId: string, reason: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/api/admin/contractors/${contractorId}/reject`, { reason }, authHeaders);
};

export const getFlaggedContent = async (type: 'reviews' | 'posts'): Promise<FlaggedItem[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/admin/flagged?type=${type}`, authHeaders);
};

export const moderateContent = async (type: string, id: string, action: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/api/admin/moderate`, { type, id, action }, authHeaders);
};

export const getPlatformStats = async (): Promise<PlatformStats> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/admin/stats`, authHeaders);
};