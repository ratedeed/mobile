import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import io, { Socket } from 'socket.io-client';
import { auth as firebaseAuth } from '../firebaseConfig';
import { jwtDecode } from 'jwt-decode';
import { AppState } from 'react-native';
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

let isRefreshing = false;
let refreshPromise: Promise<any> | null = null;

const refreshTokenIfNeeded = async (): Promise<void> => {
  const userInfo = await AsyncStorage.getItem('userInfo');
  if (!userInfo) return;
  const parsed = JSON.parse(userInfo);
  if (!parsed.refreshToken) return;

  if (isRefreshing && refreshPromise) {
    await refreshPromise;
    return;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/users/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: parsed.refreshToken }),
      });
      if (response.ok) {
        const data = await response.json();
        await AsyncStorage.setItem('userInfo', JSON.stringify({ ...parsed, token: data.token, refreshToken: data.refreshToken }));
      }
    } catch {} finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  await refreshPromise;
};

export const handleResponse = async (response: Response, retryFn?: () => Promise<any>): Promise<any> => {
  if (response.status === 401 && retryFn) {
    await refreshTokenIfNeeded();
    return retryFn();
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
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(data),
    });
  };
  const response = await makeRequest();
  return handleResponse(response, Object.keys(headers).length > 0 ? undefined : makeRequest);
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
      // console.error('Failed to normalize contractor:', err);
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
  return post(`${API_BASE}/contractors`, data);
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

export const requestVerification = async (data: { licenseNumber: string; licenseDocumentUrl: string }): Promise<any> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/contractors/request-verification`, data, authHeaders);
};


// ==========================================
// Messaging & Socket API
// ==========================================

let socket: Socket | null = null;
let isInitializingSocket = false;
let currentSocketUserId: string | null = null;
let pendingListeners: Array<{ event: string; callback: Function }> = [];

// Handle AppState changes
AppState.addEventListener('change', (nextAppState) => {
  if (nextAppState === 'background') {
    if (socket?.connected) {
      // console.log('App in background: disconnecting socket for FCM pushes');
      socket.disconnect();
    }
  } else if (nextAppState === 'active') {
    if (socket?.disconnected && currentSocketUserId) {
      // console.log('App in foreground: reconnecting socket');
      socket.connect();
    }
  }
});

export const initializeSocket = async () => {
  if (socket?.connected || isInitializingSocket) return;
  isInitializingSocket = true;

  try {
    const userInfo = await AsyncStorage.getItem('userInfo');
    const token = userInfo ? JSON.parse(userInfo).token : null;

    // SYNC with web version: use standard transports and auth object
    // Also remove withCredentials which can cause handshake errors in some environments
      // console.log('Socket: Connecting to:', API_BASE_URL);
    socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    socket.on('connect', () => {
      // console.log('Socket connected:', socket?.id);
      isInitializingSocket = false;
      // Flush any listeners that were registered before socket was ready
      pendingListeners.forEach(({ event, callback }) => {
        socket?.off(event, callback as any);
        socket?.on(event, callback as any);
      });
      pendingListeners = [];
    });

    socket.on('connect_error', (error) => {
      // console.error('Socket connection error:', error);
      isInitializingSocket = false;
    });

    socket.on('disconnect', (reason) => {
      // console.log('Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // the disconnection was initiated by the server, you need to reconnect manually
        socket?.connect();
      }
    });
  } catch (error) {
      // console.error('Error initializing socket:', error);
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
      // console.log(`Registering socket for user ${userId}`);
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

export const createCheckoutSession = async (quoteId: string): Promise<{ url: string }> => { 
  const authHeaders = await getAuthHeaders(); 
  return post(`${API_BASE}/jobs/checkout`, { quoteId }, authHeaders); 
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
