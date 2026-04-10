import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import io, { Socket } from 'socket.io-client';
import { auth as firebaseAuth } from '../firebaseConfig';
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
  QuoteLineItem,
} from '../types/index';

const API_BASE = API_BASE_URL;

// ==========================================
// Base API Client Functions
// ==========================================

export const getAuthHeaders = async (externalToken?: string): Promise<Record<string, string>> => {
  if (externalToken) {
    return { 'Authorization': `Bearer ${externalToken}` };
  }
  const userInfo = await AsyncStorage.getItem('userInfo');
  const token = userInfo ? JSON.parse(userInfo).token : null;
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

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

export const get = async (url: string, headers: Record<string, string> = {}): Promise<any> => {
  const response = await fetch(url, {
    method: 'GET',
    headers: { ...headers },
  });
  return handleResponse(response);
};

export const post = async (url: string, data: any, headers: Record<string, string> = {}): Promise<any> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

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

export const del = async (url: string, headers: Record<string, string> = {}): Promise<any> => {
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { ...headers },
  });
  return handleResponse(response);
};

// ==========================================
// Auth API
// ==========================================

export const login = async (email: string, password: string): Promise<any> => {
  const data = await post(`${API_BASE}/api/users/login`, { email, password });
  if (data && data.token) {
    await AsyncStorage.setItem('userInfo', JSON.stringify({ token: data.token, ...data.user }));
  }
  return data;
};

export const logout = async (): Promise<void> => {
  await AsyncStorage.removeItem('userInfo');
};

export const register = async (data: any): Promise<any> => {
  return post(`${API_BASE}/api/users/signup`, data);
};

export const verifyEmailBackend = async (email: string): Promise<any> => {
  return post(`${API_BASE}/api/users/verify-email`, { email });
};

export const forgotPassword = async (email: string): Promise<any> => {
  return post(`${API_BASE}/api/auth/forgot-password`, { email });
};

export const contractorSignup = async (data: any): Promise<any> => {
  return post(`${API_BASE}/api/auth/contractor-signup`, data);
};

export const backendLoginFirebase = async (idToken: string, email: string): Promise<any> => {
  const headers = { 'Authorization': `Bearer ${idToken}` };
  const data = await post(`${API_BASE}/api/users/login`, { email, firebaseUid: firebaseAuth.currentUser?.uid }, headers);
  if (data && data.token) {
    await AsyncStorage.setItem('userInfo', JSON.stringify({ token: data.token, ...data.user }));
  }
  return data;
};

export const syncEmailVerificationStatus = async (idToken: string, email: string, isVerified: boolean): Promise<any> => {
  const headers = { 'Authorization': `Bearer ${idToken}` };
  return post(`${API_BASE}/api/users/verify-email`, { email, isVerified, firebaseUid: firebaseAuth.currentUser?.uid }, headers);
};

// ==========================================
// Contractor API
// ==========================================

export const browseContractors = async (queryParams: ContractorQueryParams = {}): Promise<ContractorsResponse> => {
  const queryString = new URLSearchParams(queryParams as any).toString();
  return get(`${API_BASE}/api/contractors?${queryString}`);
};

export const getTopRatedContractors = async (zipCode: string, limit: number = 6): Promise<Contractor[]> => {
  return get(`${API_BASE}/api/contractors/top-rated?zipCode=${zipCode}&limit=${limit}`);
};

export const getNearbyTopRatedContractors = async (zipCode: string, excludeId?: string): Promise<Contractor[]> => {
  let url = `${API_BASE}/api/contractors/nearby?zipCode=${zipCode}`;
  if (excludeId) url += `&excludeId=${excludeId}`;
  return get(url);
};

export const getContractorBySlug = async (slug: string): Promise<Contractor> => {
  return get(`${API_BASE}/api/contractors/slug/${slug}`);
};

export const getContractorDetails = async (contractorId: string): Promise<Contractor> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/contractors/${contractorId}`, authHeaders);
};

export const fetchContractorDetails = getContractorDetails;

export const updateContractorProfile = async (data: Partial<Contractor>): Promise<Contractor> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/api/contractors/profile`, data, authHeaders);
};

// ==========================================
// Messaging & Socket API
// ==========================================

let socket: Socket | null = null;

export const initializeSocket = async () => {
  if (socket?.connected) return;

  const userInfo = await AsyncStorage.getItem('userInfo');
  const token = userInfo ? JSON.parse(userInfo).token : null;

  socket = io(API_BASE, {
    transports: ['websocket'],
    withCredentials: true,
    auth: token ? { token } : undefined,
  });

  socket.on('connect', () => console.log('Socket connected:', socket?.id));
};

export const registerSocket = async (userId: string) => {
  await initializeSocket();
  socket?.emit('register', userId);
};

export const sendMessage = async (conversationId: string, recipientId: string, messageText: string): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/api/messages`, { conversationId, recipientId, messageText }, authHeaders);
};

export const listConversations = async (): Promise<any[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/messages/conversations`, authHeaders);
};

export const fetchConversations = listConversations;

export const fetchMessages = async (conversationId: string): Promise<any[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/messages/conversation/${conversationId}`, authHeaders);
};

export const findOrCreateConversation = async (participantIds: string[]): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/api/messages/find-or-create-conversation`, { participantIds }, authHeaders);
};

export const createConversation = findOrCreateConversation;

// ==========================================
// Posts & Reviews API
// ==========================================

export const listPosts = async (queryParams: any = {}): Promise<{ posts: Post[] }> => {
  const queryString = new URLSearchParams(queryParams).toString();
  return get(`${API_BASE}/api/posts?${queryString}`);
};

export const getFeedPosts = listPosts;

export const fetchContractorPosts = async (contractorId: string): Promise<{ posts: Post[] }> => {
  const posts = await get(`${API_BASE}/api/posts/contractor/${contractorId}`);
  return { posts: Array.isArray(posts) ? posts : (posts.posts || []) };
};

export const createPost = async (postData: any): Promise<Post> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/api/posts`, postData, authHeaders);
};

export const likePost = async (postId: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/api/posts/${postId}/like`, {}, authHeaders);
};

export const unlikePost = async (postId: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/api/posts/${postId}/unlike`, {}, authHeaders);
};

export const commentOnPost = async (postId: string, commentData: any): Promise<PostComment> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/api/posts/${postId}/comments`, commentData, authHeaders);
};

export const deletePost = async (postId: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return del(`${API_BASE}/api/posts/${postId}`, authHeaders);
};

export const listContractorReviews = async (contractorId: string, params: any = {}): Promise<any> => {
  const queryString = new URLSearchParams(params).toString();
  return get(`${API_BASE}/api/contractors/${contractorId}/reviews?${queryString}`);
};

export const fetchContractorReviews = async (contractorId: string): Promise<Review[]> => {
  const data = await listContractorReviews(contractorId);
  return data.reviews || data || [];
};

export const submitReview = async (contractorId: string, reviewData: Partial<Review>): Promise<Review> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/api/contractors/${contractorId}/reviews`, reviewData, authHeaders);
};

// ==========================================
// Notifications API
// ==========================================

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
// User API
// ==========================================

export const getUserProfile = async (): Promise<User> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/users/profile`, authHeaders);
};

export const fetchUserProfile = getUserProfile;

export const updateUserProfile = async (data: Partial<User>): Promise<User> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/api/users/profile`, data, authHeaders);
};

export const updateProfilePicture = async (pictureUrl: string): Promise<User> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/api/users/profile-picture`, { pictureUrl }, authHeaders);
};

export const updateBannerImage = async (imageUrl: string): Promise<User> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/api/users/banner-image`, { imageUrl }, authHeaders);
};

// ==========================================
// Payments & Stripe API
// ==========================================

export const getStripeConnectUrl = async (): Promise<{ url: string }> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/stripe/connect-url`, authHeaders);
};

export const getStripeAccountStatus = async (): Promise<StripeConnectStatus> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/stripe/account-status`, authHeaders);
};

export const createQuote = async (quoteData: any): Promise<Quote> => {
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
// Admin API
// ==========================================

export const getAllUsers = async (params: UserQueryParams): Promise<UsersResponse> => {
  const queryString = new URLSearchParams(params as any).toString();
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/admin/users?${queryString}`, authHeaders);
};

export const getAllContractors = async (params: ContractorQueryParams): Promise<ContractorsResponse> => {
  const queryString = new URLSearchParams(params as any).toString();
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/admin/contractors?${queryString}`, authHeaders);
};

export const getPlatformStats = async (): Promise<PlatformStats> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/api/admin/stats`, authHeaders);
};

export const createLead = async (leadData: any): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/api/leads`, leadData, authHeaders);
};
