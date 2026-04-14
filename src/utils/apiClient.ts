import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import io, { Socket } from 'socket.io-client';
import { auth as firebaseAuth } from '../firebaseConfig';
import { jwtDecode } from 'jwt-decode';
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

const API_BASE = `${API_BASE_URL}/api`;

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

// ---- Normalization Helpers (Ported from web version) ----
export const normalizeApiContractor = (c: any): Contractor => {
  if (!c) return c;
  const contractor = { ...c };
  
  // Ensure ID is normalized
  contractor._id = contractor._id || contractor.id;

  // Prioritize explicit city/state from signup/contact info over generic location string
  let derivedCity = '';
  let derivedState = '';

  if (c.contactInfo?.city && c.contactInfo?.state) {
    derivedCity = c.contactInfo.city;
    derivedState = c.contactInfo.state;
  } else if ((c.contactInfo?.city || c.city) && (c.contactInfo?.state || c.state || c.contactInfo?.parsedState)) {
    derivedCity = c.contactInfo?.city || c.city || '';
    derivedState = c.contactInfo?.state || c.contactInfo?.parsedState?.toUpperCase() || c.state || '';
  } else if (c.city && c.state) {
    derivedCity = c.city;
    derivedState = c.state;
  } else {
    // Fallback: try to parse from raw address string if explicit fields are missing
    const address = c.contact?.address || c.address || c.businessAddress;
    if (address && typeof address === 'string') {
      const match = address.match(/([^,]+),\s*([A-Z]{2}|[a-zA-Z\s]+?)(?:\s+\d{5})?$/);
      if (match) {
        derivedCity = match[1].trim();
        derivedState = match[2].trim();
      } else if (address.includes(',')) {
        const parts = address.split(',');
        if (parts.length >= 2) {
          derivedCity = parts[parts.length - 2].trim();
          derivedState = parts[parts.length - 1].trim().split(' ')[0];
        }
      }
    }
  }

  // Final fallback: use location string or businessAddress directly
  if (!derivedCity && !derivedState) {
    const loc = c.location;
    if (typeof loc === 'string' && loc.trim() && !loc.includes('{')) {
      const locParts = loc.split(',');
      if (locParts.length >= 2) {
        derivedCity = locParts[0].trim();
        derivedState = locParts[1].trim();
      }
    }
    if (!derivedCity && c.businessAddress && typeof c.businessAddress === 'string') {
      const match = c.businessAddress.match(/([^,]+),\s*([A-Z]{2})(?:\s+\d{5})?$/);
      if (match) {
        derivedCity = match[1].trim();
        derivedState = match[2].trim();
      }
    }
  }

  // Update contactInfo with normalized data
  if (!contractor.contactInfo) contractor.contactInfo = {};
  if (derivedCity) contractor.contactInfo.city = derivedCity;
  if (derivedState) contractor.contactInfo.state = derivedState;

  return contractor;
};

export const adaptApiContractor = normalizeApiContractor;

export const extractId = (obj: any): string => {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return (obj._id || obj.id || "").toString();
}; // Alias used in web version

const normalizeContractors = (list: any[]): Contractor[] => {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeApiContractor);
};

// ==========================================
// Auth API
// ==========================================

export const login = async (email: string, password: string): Promise<any> => {
  const data = await post(`${API_BASE}/users/login`, { email, password });
  if (data && data.token) {
    await AsyncStorage.setItem('userInfo', JSON.stringify({ token: data.token, ...data.user }));
  }
  return data;
};

export const logout = async (): Promise<void> => {
  await AsyncStorage.removeItem('userInfo');
};

export const register = async (data: any): Promise<any> => {
  return post(`${API_BASE}/users/signup/`, data);
};

export const verifyEmailBackend = async (email: string): Promise<any> => {
  return post(`${API_BASE}/users/verify-email/`, { email });
};

export const forgotPassword = async (email: string): Promise<any> => {
  return post(`${API_BASE}/auth/forgot-password/`, { email });
};

export const contractorSignup = async (data: any): Promise<any> => {
  return post(`${API_BASE}/contractors/`, data);
};

export const backendLoginFirebase = async (idToken: string, email: string): Promise<any> => {
  const headers = { 'Authorization': `Bearer ${idToken}` };
  const data = await post(`${API_BASE}/users/login`, { email, firebaseUid: firebaseAuth.currentUser?.uid }, headers);
  if (data && data.token) {
    await AsyncStorage.setItem('userInfo', JSON.stringify({ token: data.token, ...data.user }));
  }
  return data;
};

export const syncEmailVerificationStatus = async (idToken: string, email: string, isVerified: boolean): Promise<any> => {
  const headers = { 'Authorization': `Bearer ${idToken}` };
  return post(`${API_BASE}/users/verify-email`, { email, isVerified, firebaseUid: firebaseAuth.currentUser?.uid }, headers);
};

// ==========================================
// Contractor API
// ==========================================

export const browseContractors = async (queryParams: ContractorQueryParams = {}): Promise<ContractorsResponse> => {
  const queryString = new URLSearchParams(queryParams as any).toString();
  const data = await get(`${API_BASE}/contractors?${queryString}`);
  if (data?.contractors) data.contractors = normalizeContractors(data.contractors);
  else if (Array.isArray(data)) return { contractors: normalizeContractors(data), total: data.length, page: 1, pages: 1, limit: data.length };
  return data;
};

export const getTopRatedContractors = async (zipCode: string, limit: number = 6): Promise<Contractor[]> => {
  const data = await get(`${API_BASE}/contractors/top-rated?zipCode=${zipCode}&limit=${limit}`);
  return normalizeContractors(data);
};

export const getNearbyTopRatedContractors = async (zipCode: string, excludeId?: string): Promise<Contractor[]> => {
  let url = `${API_BASE}/contractors/nearby?zipCode=${zipCode}`;
  if (excludeId) url += `&excludeId=${excludeId}`;
  const data = await get(url);
  return normalizeContractors(data);
};

export const getContractorBySlug = async (slug: string): Promise<Contractor> => {
  const data = await get(`${API_BASE}/contractors/slug/${slug}`);
  return normalizeApiContractor(data);
};

export const getContractorProfile = async (): Promise<Contractor> => {
  const authHeaders = await getAuthHeaders();
  const data = await get(`${API_BASE}/contractors/profile`, authHeaders);
  return normalizeApiContractor(data);
};

export const getContractorDetails = async (contractorId: string): Promise<Contractor> => {
  const authHeaders = await getAuthHeaders();
  const data = await get(`${API_BASE}/contractors/${contractorId}`, authHeaders);
  return normalizeApiContractor(data);
};

export const fetchContractorDetails = getContractorDetails;

export const updateContractorProfile = async (data: Partial<Contractor>): Promise<Contractor> => {
  const authHeaders = await getAuthHeaders();
  const result = await put(`${API_BASE}/contractors/profile`, data, authHeaders);
  return normalizeApiContractor(result);
};

// ==========================================
// Messaging & Socket API
// ==========================================

let socket: Socket | null = null;
let isInitializingSocket = false;

export const initializeSocket = async () => {
  if (socket?.connected || isInitializingSocket) return;
  isInitializingSocket = true;

  try {
    const userInfo = await AsyncStorage.getItem('userInfo');
    const token = userInfo ? JSON.parse(userInfo).token : null;

    // Use API_BASE_URL instead of API_BASE because Socket.io usually mounts at the root /socket.io
    // Also add 'polling' transport as fallback for environments where WebSocket upgrade might fail
    console.log('Socket: Attempting to connect to:', API_BASE_URL);
    socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket?.id);
      isInitializingSocket = false;
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      isInitializingSocket = false;
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // the disconnection was initiated by the server, you need to reconnect manually
        socket?.connect();
      }
    });
  } catch (error) {
    console.error('Error initializing socket:', error);
    isInitializingSocket = false;
  }
};

export const registerSocket = async (userId: string) => {
  await initializeSocket();
  
  const emitRegister = () => {
    if (userId) {
      console.log(`Registering socket for user ${userId}`);
      socket?.emit("register", userId);
    }
  };

  if (socket?.connected) {
    emitRegister();
  } else {
    socket?.once('connect', emitRegister);
  }

  // Handle re-registration on reconnection
  socket?.on('connect', () => {
    console.log('Socket reconnected, re-registering user');
    emitRegister();
  });

  return socket;
};
export const joinConversationSocket = async (conversationId: string) => {
  await initializeSocket();
  if (socket?.connected) {
    socket.emit("joinConversation", conversationId);
  } else {
    socket?.once('connect', () => socket?.emit("joinConversation", conversationId));
  }
};

export const leaveConversationSocket = (conversationId: string) => {
  socket?.emit("leaveConversation", conversationId);
};
export const onNewMessage = (callback: (message: any) => void) => {
  if (!socket) return;
  // If no callback is provided, remove all listeners for this event
  if (!callback) {
    socket.removeAllListeners("newMessage");
    return;
  }
  socket.off("newMessage"); // Remove all previous listeners for this event
  socket.on("newMessage", callback);
};

export const offNewMessage = (callback?: (message: any) => void) => {
  if (callback) {
    socket?.off("newMessage", callback);
  } else {
    socket?.off("newMessage");
  }
};


export const onMessageRead = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.off("messageRead");
  socket.on("messageRead", callback);
};

export const offMessageRead = (callback?: (data: any) => void) => {
  if (callback) {
    socket?.off("messageRead", callback);
  } else {
    socket?.off("messageRead");
  }
};


export const onTyping = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.off("typing");
  socket.on("typing", callback);
};

export const offTyping = (callback?: (data: any) => void) => {
  if (callback) {
    socket?.off("typing", callback);
  } else {
    socket?.off("typing");
  }
};


export const onUserOnlineStatus = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.off("userOnlineStatus");
  socket.on("userOnlineStatus", callback);
};

export const offUserOnlineStatus = (callback?: (data: any) => void) => {
  if (callback) {
    socket?.off("userOnlineStatus", callback);
  } else {
    socket?.off("userOnlineStatus");
  }
};

export const onNewNotification = (callback: (notification: any) => void) => {
  if (!socket) return;
  socket.off("newNotification");
  socket.on("newNotification", callback);
};

export const offNewNotification = (callback?: (notification: any) => void) => {
  if (callback) {
    socket?.off("newNotification", callback);
  } else {
    socket?.off("newNotification");
  }
};


export const emitTyping = (conversationId: string, userId: string, isTyping: boolean) => {
  if (socket?.connected) {
    socket.emit('typing', { conversationId, userId, isTyping });
  }
};

export const emitMessageRead = (messageId: string, readerId: string, conversationId: string) => {
  if (socket?.connected) {
    socket.emit('messageRead', { messageId, readerId, conversationId });
  }
};

export const sendMessage = async (conversationId: string, recipientId: string, messageText: string, attachmentUrl?: string): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/messages/`, { conversationId, recipientId, messageText, attachmentUrl }, authHeaders);
};

export const listConversations = async (): Promise<any[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/messages/conversations`, authHeaders);
};

export const fetchConversations = listConversations;

export const fetchMessages = async (conversationId: string): Promise<any[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/messages/conversation/${conversationId}`, authHeaders);
};

export const findOrCreateConversation = async (participantIds: string[]): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/messages/find-or-create-conversation`, { participantIds }, authHeaders);
};

export const createConversation = findOrCreateConversation;

export const createQuoteFromChat = async (data: any): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/quotes/from-chat`, data, authHeaders);
};

// ==========================================
// Posts & Reviews API
// ==========================================

export const listPosts = async (queryParams: any = {}): Promise<{ posts: Post[] }> => {
  const queryString = new URLSearchParams(queryParams).toString();
  return get(`${API_BASE}/posts?${queryString}`);
};

export const getFeedPosts = listPosts;

export const fetchContractorPosts = async (contractorId: string): Promise<{ posts: Post[] }> => {
  const posts = await get(`${API_BASE}/posts/contractor/${contractorId}`);
  return { posts: Array.isArray(posts) ? posts : (posts.posts || []) };
};

export const createPost = async (postData: any): Promise<Post> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/posts`, postData, authHeaders);
};

export const likePost = async (postId: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/posts/${postId}/like`, {}, authHeaders);
};

export const unlikePost = async (postId: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/posts/${postId}/unlike`, {}, authHeaders);
};

export const commentOnPost = async (postId: string, commentData: any): Promise<PostComment> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/posts/${postId}/comments`, commentData, authHeaders);
};

export const deletePost = async (postId: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return del(`${API_BASE}/posts/${postId}`, authHeaders);
};

export const listContractorReviews = async (contractorId: string, params: any = {}): Promise<any> => {
  const queryString = new URLSearchParams(params).toString();
  return get(`${API_BASE}/contractors/${contractorId}/reviews?${queryString}`);
};

export const fetchContractorReviews = async (contractorId: string): Promise<Review[]> => {
  const data = await listContractorReviews(contractorId);
  return data.reviews || data || [];
};

export const submitReview = async (contractorId: string, reviewData: Partial<Review>): Promise<Review> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/contractors/${contractorId}/reviews`, reviewData, authHeaders);
};

// ==========================================
// Notifications API
// ==========================================

export const getNotifications = async (): Promise<Notification[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/notifications`, authHeaders);
};

export const markNotificationRead = async (notificationId: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/notifications/${notificationId}/read`, {}, authHeaders);
};

export const markAllNotificationsRead = async (): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/notifications/read-all`, {}, authHeaders);
};

export const deleteNotification = async (notificationId: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return del(`${API_BASE}/notifications/${notificationId}`, authHeaders);
};

// ==========================================
// User API
// ==========================================

export const getUserProfile = async (): Promise<User> => {
  const authHeaders = await getAuthHeaders();
  const user = await get(`${API_BASE}/users/profile`, authHeaders);
  // Backend doesn't return createdAt — use JWT iat as fallback
  if (!user.createdAt) {
    try {
      const userInfo = await AsyncStorage.getItem('userInfo');
      const parsed = userInfo ? JSON.parse(userInfo) : {};
      if (parsed.token) {
        const decoded: any = jwtDecode(parsed.token);
        if (decoded.iat) {
          user.createdAt = new Date(decoded.iat * 1000).toISOString();
        }
      }
    } catch {}
  }
  return user;
};

export const fetchUserProfile = getUserProfile;

export const updateUserProfile = async (data: Partial<User>): Promise<User> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/users/profile`, data, authHeaders);
};

export const savePushToken = async (pushToken: string): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/users/push-token`, { pushToken }, authHeaders);
};

export const updateProfilePicture = async (pictureUrl: string): Promise<User> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/users/profile-picture`, { pictureUrl }, authHeaders);
};

export const updateBannerImage = async (imageUrl: string): Promise<User> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/users/banner-image`, { imageUrl }, authHeaders);
};

// ==========================================
// Payments & Stripe API
// ==========================================

export const getStripeConnectUrl = async (): Promise<{ url: string }> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/stripe/connect-url`, authHeaders);
};

export const getStripeAccountStatus = async (): Promise<StripeConnectStatus> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/stripe/account-status`, authHeaders);
};

export const createQuote = async (quoteData: any): Promise<Quote> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/quotes`, quoteData, authHeaders);
};

export const getContractorLeads = async (): Promise<Lead[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/leads/contractor`, authHeaders);
};

export const getContractorQuotes = async (): Promise<Quote[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/quotes/contractor`, authHeaders);
};

export const getUserQuotes = async (): Promise<Quote[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/quotes/client`, authHeaders);
};

export const getContractorJobs = async (): Promise<Job[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/jobs/contractor`, authHeaders);
};

export const releaseFunds = async (jobId: string): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/jobs/${jobId}/release`, {}, authHeaders);
};

export const markJobComplete = async (jobId: string): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/jobs/${jobId}/complete`, {}, authHeaders);
};

export const raiseDispute = async (jobId: string, reason: string, milestoneId?: string): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/jobs/${jobId}/dispute`, { reason, milestoneId }, authHeaders);
};

export const createChangeOrder = async (jobId: string, data: { title: string; description: string; amount: number }): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/jobs/${jobId}/change-order`, data, authHeaders);
};

export const acceptChangeOrder = async (jobId: string, changeOrderId: string): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/jobs/${jobId}/change-order/${changeOrderId}/accept`, {}, authHeaders);
};

export const declineChangeOrder = async (jobId: string, changeOrderId: string): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/jobs/${jobId}/change-order/${changeOrderId}/decline`, {}, authHeaders);
};

export const getUserJobs = async (): Promise<Job[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/jobs/client`, authHeaders);
};


export const getContractorEarnings = async (): Promise<Earnings> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/stripe/earnings`, authHeaders);
};

// ==========================================
// Admin API
// ==========================================

export const getAllUsers = async (params: UserQueryParams): Promise<UsersResponse> => {
  const queryString = new URLSearchParams(params as any).toString();
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/admin/users?${queryString}`, authHeaders);
};

export const getAllContractors = async (params: ContractorQueryParams): Promise<ContractorsResponse> => {
  const queryString = new URLSearchParams(params as any).toString();
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/admin/contractors?${queryString}`, authHeaders);
};

export const getPlatformStats = async (): Promise<PlatformStats> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/admin/stats`, authHeaders);
};

export const getCloudinarySignature = async (folder: string): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/admin/cloudinary-sign`, { folder }, authHeaders);
};

export const createLead = async (leadData: any): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/leads`, leadData, authHeaders);
};
