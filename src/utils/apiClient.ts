/* eslint-disable @typescript-eslint/no-explicit-any */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import io, { Socket } from 'socket.io-client';
// @ts-expect-error firebaseConfig is a JS module
import { auth } from '../firebaseConfig';
import { Auth } from 'firebase/auth';
import { jwtDecode } from 'jwt-decode';
import { AppState } from 'react-native';

// @ts-ignore - firebaseConfig is a JS module
const firebaseAuth: Auth = auth as unknown as Auth;
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

const USER_DATA_KEY = 'ratedeed-user-data';

// ==========================================
// Base API Client Functions
// ==========================================

export const getAuthHeaders = async (externalToken?: string): Promise<Record<string, string>> => {
  if (externalToken) {
    return { 'Authorization': `Bearer ${externalToken}` };
  }
  const token = await AsyncStorage.getItem('auth_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

let isRefreshing = false;
let refreshPromise: Promise<any> | null = null;

const refreshTokenIfNeeded = async (): Promise<void> => {
  const rt = await AsyncStorage.getItem('refresh_token');
  if (!rt) return;

  if (isRefreshing && refreshPromise) {
    await refreshPromise;
    return;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      if (!rt) return;
      const response = await fetch(`${API_BASE}/users/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.token) await AsyncStorage.setItem('auth_token', data.token);
        if (data.refreshToken) await AsyncStorage.setItem('refresh_token', data.refreshToken);
      } else {
        await AsyncStorage.removeItem('auth_token');
        await AsyncStorage.removeItem('refresh_token');
        await AsyncStorage.removeItem(USER_DATA_KEY);
        firebaseAuth.signOut();
      }
    } catch {
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('refresh_token');
      await AsyncStorage.removeItem(USER_DATA_KEY);
      firebaseAuth.signOut();
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  await refreshPromise;
};

export const handleResponse = async (response: Response, retryFn?: () => Promise<Response>, retried = false): Promise<any> => {
  if (response.status === 401 && retryFn && !retried) {
    await refreshTokenIfNeeded();
    const retryResponse = await retryFn();
    return handleResponse(retryResponse, undefined, true);
  }
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
  const makeRequest = async () => {
    const currentHeaders = { ...headers };
    if (!currentHeaders['Authorization']) {
      const authH = await getAuthHeaders();
      Object.assign(currentHeaders, authH);
    }
    return fetch(url, { method: 'GET', headers: currentHeaders });
  };
  const response = await makeRequest();
  return handleResponse(response, makeRequest);
};

export const post = async (url: string, data: any, headers: Record<string, string> = {}): Promise<any> => {
  const makeRequest = async () => {
    const currentHeaders: Record<string, string> = { 'Content-Type': 'application/json', ...headers };
    if (!currentHeaders['Authorization']) {
      const authH = await getAuthHeaders();
      Object.assign(currentHeaders, authH);
    }
    return fetch(url, {
      method: 'POST',
      headers: currentHeaders,
      body: JSON.stringify(data),
    });
  };
  const response = await makeRequest();
  return handleResponse(response, makeRequest);
};

export const put = async (url: string, data: any, headers: Record<string, string> = {}): Promise<any> => {
  const makeRequest = async () => {
    const currentHeaders: Record<string, string> = { 'Content-Type': 'application/json', ...headers };
    if (!currentHeaders['Authorization']) {
      const authH = await getAuthHeaders();
      Object.assign(currentHeaders, authH);
    }
    return fetch(url, { method: 'PUT', headers: currentHeaders, body: JSON.stringify(data) });
  };
  const response = await makeRequest();
  return handleResponse(response, makeRequest);
};

export const del = async (url: string, headers: Record<string, string> = {}): Promise<any> => {
  const makeRequest = async () => {
    const currentHeaders = { ...headers };
    if (!currentHeaders['Authorization']) {
      const authH = await getAuthHeaders();
      Object.assign(currentHeaders, authH);
    }
    return fetch(url, { method: 'DELETE', headers: currentHeaders });
  };
  const response = await makeRequest();
  return handleResponse(response, makeRequest);
};

// ---- Normalization Helpers (Ported from web version) ----
/**
 * Robust normalization of API contractor data to match the Frontend Contractor interface.
 * Handles differences between Mongoose/MongoDB data and what the UI expects.
 */
export const normalizeApiContractor = (c: any): Contractor => {
  if (!c) return c;

  try {
    // Some API responses might wrap the contractor object
    const data = c.contractor || c;

    const id = data._id || data.id || '';
    const userId = data.userId?._id || data.userId || data.user?._id || data.user || '';
    const companyName = data.companyName || data.businessName || data.name || 'Company';
    const category = data.category || data.type || '';
    const slug = data.slug || '';

    // Normalize services
    const rawServices = (Array.isArray(data.servicesOffered) && data.servicesOffered.length > 0)
      ? data.servicesOffered
      : (Array.isArray(data.services) ? data.services : []);

    const services = rawServices.map((s: any) => ({
      name: typeof s === "string" ? s : s?.name || '',
      description: s?.description || s?.desc || '',
      priceRange: s?.priceEstimate || s?.priceRange || data.priceRange || ''
    }));

    // Normalize portfolio
    const rawPortfolio = (Array.isArray(data.portfolio) && data.portfolio.length > 0)
      ? data.portfolio
      : (Array.isArray(data.projects) ? data.projects : []);

    const portfolio = rawPortfolio.map((p: any, i: number) => ({
      id: p?._id || p?.id || `p-${i}`,
      name: p?.name || p?.title || p?.caption || 'Project',
      description: p?.description || p?.caption || '',
      imageUrl: p?.imageUrl || (Array.isArray(p?.images) ? p.images[0] : '') || '',
      images: Array.isArray(p?.images) ? p.images : (p?.imageUrl ? [p.imageUrl] : []),
      category: p?.category || (Array.isArray(p?.tags) ? p.tags[0] : null) || 'General',
    }));

    // Contact info - read the SAME way the web does
    const contact = data.contactInfo || data.contact || {};
    const phone = contact.phoneNumber || contact.phone || data.phone || data.phoneNumber || data.contactPhone || data.user?.phone || '';
    const contactEmail = contact.email || data.email || data.user?.email || '';
    const website = contact.website || data.website || '';
    // Use contactInfo.streetAddress first (matches web), then contactInfo.address, then top-level businessAddress
    const fullAddress = contact.streetAddress || contact.address || data.businessAddress || data.address || '';

    // Pricing & Certifications
    const pricing = data.pricing || data.pricingInfo || data.priceRange || '';
    const certsRaw = data.certifications || data.certs || [];
    const certifications = Array.isArray(certsRaw) ? certsRaw : (typeof certsRaw === 'string' ? certsRaw.split(',').map((s: string) => s.trim()) : []);

    const normalized: any = {
      ...data,
      _id: id,
      id,
      userId,
      companyName,
      businessName: companyName,
      category,
      description: data.description || data.bio || '',
      isVerified: data.isVerified || data.isTopRated || data.licenseStatus === 'Verified' || data.licenseStatus === 'approved' || false,
      averageRating: data.averageRating || data.rating || 0,
      reviewCount: data.numReviews || data.reviewCount || data.reviews || 0,
      pricing: pricing,
      pricingInfo: pricing,
      priceRange: pricing,
      businessHours: data.businessHours || {},
      // Contact - faithful to the raw API data, matching web's reading pattern
      contactInfo: {
        phoneNumber: phone,
        email: contactEmail,
        website,
        streetAddress: fullAddress,
        address: fullAddress,
        city: contact.city || '',
        state: contact.state || '',
        zipCode: contact.zipCode || data.zipCode || data.user?.zipCode || '',
      },
      phone,
      email: contactEmail,
      website,
      businessAddress: fullAddress,
      address: fullAddress,
      serviceArea: typeof data.serviceArea === 'string' ? data.serviceArea : '',
      serviceZipCodes: data.zipCodesCovered || data.serviceZipCodes || [],
      zipCodesCovered: data.zipCodesCovered || [],
      licenseNumber: data.licenseNumber || '',
      servicesOffered: services,
      portfolio,
      certifications,
      profilePicture: data.profilePicture || data.imageUrl || '',
      bannerImage: data.bannerImage || data.bannerUrl || data.coverImage || '',
    };

    return normalized as Contractor;
  } catch (err) {
    return c;
  }
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
    await AsyncStorage.setItem('auth_token', data.token);
    if (data.refreshToken) await AsyncStorage.setItem('refresh_token', data.refreshToken);
    const userData = { ...data.user };
    delete userData.token;
    delete userData.refreshToken;
    await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
  }
  return data;
};

export const logout = async (): Promise<void> => {
  await AsyncStorage.removeItem('auth_token');
  await AsyncStorage.removeItem('refresh_token');
  await AsyncStorage.removeItem(USER_DATA_KEY);
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
  return post(`${API_BASE}/contractors`, data);
};

export const backendLoginFirebase = async (idToken: string, email: string): Promise<any> => {
  const headers = { 'Authorization': `Bearer ${idToken}` };
  const data = await post(`${API_BASE}/users/login`, { email, firebaseUid: firebaseAuth.currentUser?.uid }, headers);
  if (data && data.token) {
    await AsyncStorage.setItem('auth_token', data.token);
    if (data.refreshToken) await AsyncStorage.setItem('refresh_token', data.refreshToken);
    const { token, refreshToken, ...userData } = data;
    await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
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

export const requestVerification = async (data: { licenseNumber: string; licenseDocumentUrl?: string; licenseDocumentFile?: string }): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  
  // Create a copy of the data and rename url to file if needed to match backend
  const payload = { ...data };
  if (payload.licenseDocumentUrl && !payload.licenseDocumentFile) {
    payload.licenseDocumentFile = payload.licenseDocumentUrl;
  }
  
  return post(`${API_BASE}/contractors/request-verification`, payload, authHeaders);
};


// ==========================================
// Messaging & Socket API
// ==========================================

let socket: Socket | null = null;
let isInitializingSocket = false;
let currentSocketUserId: string | null = null;
let pendingListeners: Array<{ event: string; callback: Function }> = [];

let appStateSubscription: any = null;

export const startAppStateListener = () => {
  if (appStateSubscription) return;
  appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
    if (nextAppState === 'background') {
      if (socket?.connected) {
        socket.disconnect();
      }
    } else if (nextAppState === 'active') {
      if (socket?.disconnected && currentSocketUserId) {
        socket.connect();
        socket.emit('register', currentSocketUserId);
      }
    }
  });
};

export const stopAppStateListener = () => {
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
};

export const initializeSocket = async () => {
  if (socket?.connected || isInitializingSocket) return;
  isInitializingSocket = true;

  try {
    const token = await AsyncStorage.getItem('auth_token');

    socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    socket.on('connect', () => {
      isInitializingSocket = false;
      const listeners = [...pendingListeners];
      pendingListeners = [];
      listeners.forEach(({ event, callback }) => {
        socket?.off(event, callback as any);
        socket?.on(event, callback as any);
      });
    });

    socket.on('connect_error', () => {
      isInitializingSocket = false;
    });

    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        socket?.connect();
      }
    });

    // Safety: reset init flag if connection hangs without any event
    setTimeout(() => {
      if (isInitializingSocket) {
        isInitializingSocket = false;
      }
    }, 25000);
  } catch {
    isInitializingSocket = false;
  }
};

export const registerSocket = async (userId: string) => {
  if (!userId) return;
  await initializeSocket();

  // Prevent redundant registrations
  if (currentSocketUserId === userId && socket?.connected) {
    return;
  }

  currentSocketUserId = userId;

  const emitRegister = () => {
    if (userId && socket?.connected) {
      socket.emit("register", userId);
    }
  };

  if (socket?.connected) {
    emitRegister();
  } else {
    socket?.once('connect', emitRegister);
  }
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
  if (!callback) {
    socket?.removeAllListeners("newMessage");
    return;
  }
  if (socket?.connected) {
    socket.off("newMessage", callback);
    socket.on("newMessage", callback);
  } else {
    pendingListeners.push({ event: "newMessage", callback });
  }
};

export const offNewMessage = (callback?: (message: any) => void) => {
  if (callback) {
    socket?.off("newMessage", callback);
    pendingListeners = pendingListeners.filter(p => p.callback !== callback);
  } else {
    socket?.removeAllListeners("newMessage");
    pendingListeners = pendingListeners.filter(p => p.event !== "newMessage");
  }
};


export const onMessageRead = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.off("messageRead", callback);
  socket.on("messageRead", callback);
};

export const offMessageRead = (callback?: (data: any) => void) => {
  if (callback) {
    socket?.off("messageRead", callback);
  } else {
    socket?.removeAllListeners("messageRead");
  }
};


export const onTyping = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.off("typing", callback);
  socket.on("typing", callback);
};

export const offTyping = (callback?: (data: any) => void) => {
  if (callback) {
    socket?.off("typing", callback);
  } else {
    socket?.removeAllListeners("typing");
  }
};


export const onUserOnlineStatus = (callback: (data: any) => void) => {
  if (!socket) return;
  socket.off("userOnlineStatus", callback);
  socket.on("userOnlineStatus", callback);
};

export const offUserOnlineStatus = (callback?: (data: any) => void) => {
  if (callback) {
    socket?.off("userOnlineStatus", callback);
  } else {
    socket?.removeAllListeners("userOnlineStatus");
  }
};

export const onNewNotification = (callback: (notification: any) => void) => {
  if (!callback) {
    socket?.removeAllListeners("newNotification");
    return;
  }
  if (socket?.connected) {
    socket.off("newNotification", callback);
    socket.on("newNotification", callback);
  } else {
    pendingListeners.push({ event: "newNotification", callback });
  }
};

export const offNewNotification = (callback?: (notification: any) => void) => {
  if (callback) {
    socket?.off("newNotification", callback);
    pendingListeners = pendingListeners.filter(p => p.callback !== callback);
  } else {
    socket?.removeAllListeners("newNotification");
    pendingListeners = pendingListeners.filter(p => p.event !== "newNotification");
  }
};


export const emitTyping = (conversationId: string, userId: string, isTyping: boolean) => {
  if (socket?.connected) {
    socket.emit('typing', { conversationId, userId, isTyping });
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  currentSocketUserId = null;
  pendingListeners = [];
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

export const markConversationAsRead = async (conversationId: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/messages/read-conversation/${conversationId}`, {}, authHeaders);
};

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
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.reviews && Array.isArray(data.reviews)) return data.reviews;
  if (data.data && Array.isArray(data.data)) return data.data;
  return [];
};

export const submitReview = async (contractorId: string, reviewData: Partial<Review> & { jobId: string }): Promise<Review> => {
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

export const markNotificationUnread = async (notificationId: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/notifications/${notificationId}/unread`, {}, authHeaders);
};

// ==========================================
// User API
// ==========================================

export const getUserProfile = async (): Promise<User> => {
  const authHeaders = await getAuthHeaders();
  const user = await get(`${API_BASE}/users/profile`, authHeaders);
  if (!user.createdAt) {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        const decoded: any = jwtDecode(token);
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

export const savePushToken = async (token: string): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  // Production Render backend expects POST /api/users/push-token with { token: "..." }
  return post(`${API_BASE}/users/push-token`, { token }, authHeaders);
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
  return post(`${API_BASE}/stripe/connect`, { platform: 'mobile' }, authHeaders);
};

export const getStripeAccountStatus = async (): Promise<StripeConnectStatus> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/stripe/status`, authHeaders);
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
  return get(`${API_BASE}/quotes`, authHeaders);
};

export const getUserQuotes = async (): Promise<Quote[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/quotes`, authHeaders);
};

export const createCheckoutSession = async (quoteId: string): Promise<{ url: string }> => { 
  const authHeaders = await getAuthHeaders(); 
  return post(`${API_BASE}/jobs/checkout`, { quoteId, platform: 'mobile' }, authHeaders); 
}; 

export const getContractorJobs = async (): Promise<Job[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/jobs`, authHeaders);
};

export const releaseFunds = async (jobId: string): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/jobs/${jobId}/release`, {}, authHeaders);
};

export const markJobComplete = async (jobId: string, completionNotes?: string): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/jobs/${jobId}/complete`, { completionNotes }, authHeaders);
};

export const raiseDispute = async (jobId: string, reason: string, milestoneId?: string, evidence?: string[]): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/jobs/${jobId}/dispute`, { reason, milestoneId, evidence }, authHeaders);
};

export const cancelJob = async (jobId: string, reason?: string): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/jobs/${jobId}/cancel`, { reason }, authHeaders);
};

export const refundJob = async (jobId: string, amount?: number, reason?: string): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/jobs/${jobId}/refund`, { amount, reason }, authHeaders);
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
  return get(`${API_BASE}/jobs`, authHeaders);
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
  return post(`${API_BASE}/users/cloudinary-sign`, { folder }, authHeaders);
};

export const createLead = async (leadData: any): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/leads`, leadData, authHeaders);
};

export const requestEmailChange = async (newEmail: string, currentPassword: string): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/users/request-email-change`, { newEmail, currentPassword }, authHeaders);
};

export const changePassword = async (currentPassword: string, newPassword: string): Promise<any> => {
  return put(`${API_BASE}/users/change-password`, { currentPassword, newPassword });
};

export const deleteAccount = async (): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return del(`${API_BASE}/users/profile`, authHeaders);
};

// ==========================================
// Reset Password (token-based)
// ==========================================

export const resetPassword = async (token: string, newPassword: string): Promise<any> => {
  return post(`${API_BASE}/users/reset-password`, { token, newPassword });
};

// ==========================================
// Verify Email Change
// ==========================================

export const verifyEmailChange = async (token: string): Promise<any> => {
  return post(`${API_BASE}/users/verify-email-change`, { token });
};

// ==========================================
// Block / Unblock Users
// ==========================================

export const blockUser = async (userId: string): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/users/block/${userId}`, {}, authHeaders);
};

export const unblockUser = async (userId: string): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/users/unblock/${userId}`, {}, authHeaders);
};

export const getBlockedUsers = async (): Promise<any[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/users/blocked`, authHeaders);
};

// ==========================================
// Apple Pay / Native Payment
// ==========================================

export const createPaymentIntent = async (quoteId: string): Promise<{ clientSecret: string }> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/stripe/payment-intent`, { quoteId }, authHeaders);
};

export const appleSignIn = async (data: { identityToken: string; appleUserIdentifier: string; fullName?: { givenName?: string; familyName?: string }; email?: string }): Promise<any> => {
  const result = await post(`${API_BASE}/users/apple-signin`, data);
  if (result && result.token) {
    await AsyncStorage.setItem('auth_token', result.token);
    if (result.refreshToken) await AsyncStorage.setItem('refresh_token', result.refreshToken);
    const userData = { ...result.user };
    delete userData.token;
    delete userData.refreshToken;
    await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
  }
  return result;
};

// ==========================================
// Quote Detail & Status
// ==========================================

export const getQuote = async (quoteId: string): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/quotes/${quoteId}`, authHeaders);
};

export const updateQuoteStatus = async (quoteId: string, status: 'accepted' | 'rejected'): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE}/quotes/${quoteId}/status`, { status }, authHeaders);
};

// ==========================================
// Dispute Resolution
// ==========================================

export const resolveDispute = async (jobId: string, action: 'release_all' | 'refund_all' | 'split' | 'resume', notes?: string): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/jobs/${jobId}/dispute/resolve`, { action, notes }, authHeaders);
};

export const cancelDispute = async (jobId: string): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/jobs/${jobId}/dispute/cancel`, {}, authHeaders);
};

// ==========================================
// Job Detail
// ==========================================

export const getJobById = async (jobId: string): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/jobs/${jobId}`, authHeaders);
};

export const uploadProgressPhoto = async (jobId: string, url: string): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/jobs/${jobId}/progress-photo`, { url }, authHeaders);
};

// ==========================================
// Contractor Claim Profile
// ==========================================

export const submitClaim = async (contractorId: string, businessDocumentFile: string): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/contractors/${contractorId}/claim`, { businessDocumentFile }, authHeaders);
};

// ==========================================
// Reports
// ==========================================

export const reportConversation = async (reportedUserId: string, conversationId: string, category: string, reason: string): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/reports/conversation`, { reportedUserId, conversationId, category, reason }, authHeaders);
};
