import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, ASSET_BASE_URL } from '../config';

const getAuthHeaders = async () => {
  const userInfo = JSON.parse(await AsyncStorage.getItem('userInfo') || '{}');
  return {
    'Content-Type': 'application/json',
    ...(userInfo.token ? { Authorization: `Bearer ${userInfo.token}` } : {}),
  };
};

const handleResponse = async (response: Response) => {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'An error occurred');
  }
  return data;
};

// ==================== CONTRACTOR APIS ====================

export const getTopRatedContractors = async (zipCode: string, limit = 3) => {
  const res = await fetch(`${API_BASE_URL}/api/contractors/top-rated?zip=${zipCode}&limit=${limit}`);
  return handleResponse(res);
};

export const getNearbyTopRatedContractors = async (zipCode: string, excludeId?: string) => {
  let url = `${API_BASE_URL}/api/contractors/nearby-top-rated?zip=${zipCode}`;
  if (excludeId) url += `&excludeId=${excludeId}`;
  const res = await fetch(url);
  return handleResponse(res);
};

export const getContractorBySlug = async (slug: string) => {
  const res = await fetch(`${API_BASE_URL}/api/contractors/slug/${slug}`);
  return handleResponse(res);
};

export const getContractorById = async (id: string) => {
  const res = await fetch(`${API_BASE_URL}/api/contractors/${id}`);
  return handleResponse(res);
};

export const browseContractors = async (params: {
  page?: number;
  limit?: number;
  zip?: string;
  category?: string;
  search?: string;
  minRating?: number;
  isVerified?: boolean;
  sortBy?: string;
}) => {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, String(value));
    }
  });
  const res = await fetch(`${API_BASE_URL}/api/contractors?${queryParams}`);
  return handleResponse(res);
};

export const updateContractorProfile = async (data: any) => {
  const res = await fetch(`${API_BASE_URL}/api/contractors/profile`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
};

export const followContractor = async (contractorId: string) => {
  const res = await fetch(`${API_BASE_URL}/api/contractors/${contractorId}/follow`, {
    method: 'POST',
    headers: await getAuthHeaders(),
  });
  handleResponse(res);
};

export const unfollowContractor = async (contractorId: string) => {
  const res = await fetch(`${API_BASE_URL}/api/contractors/${contractorId}/follow`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  handleResponse(res);
};

// ==================== POST APIS ====================

export const getFeedPosts = async (zipCode?: string) => {
  let url = `${API_BASE_URL}/api/posts`;
  if (zipCode) url += `?zip=${zipCode}`;
  const res = await fetch(url);
  return handleResponse(res);
};

export const getContractorPosts = async (contractorId: string) => {
  const res = await fetch(`${API_BASE_URL}/api/posts/contractor/${contractorId}`);
  const data = await handleResponse(res);
  return Array.isArray(data) ? data : data.posts || [];
};

export const getUserPosts = async (userId: string) => {
  const res = await fetch(`${API_BASE_URL}/api/posts/user/${userId}`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};

export const createPost = async (postData: {
  caption: string;
  images?: string[];
  tags?: string[];
  location?: string;
}) => {
  const res = await fetch(`${API_BASE_URL}/api/posts`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(postData),
  });
  return handleResponse(res);
};

export const likePost = async (postId: string) => {
  const res = await fetch(`${API_BASE_URL}/api/posts/${postId}/like`, {
    method: 'POST',
    headers: await getAuthHeaders(),
  });
  handleResponse(res);
};

export const unlikePost = async (postId: string) => {
  const res = await fetch(`${API_BASE_URL}/api/posts/${postId}/like`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  handleResponse(res);
};

export const commentOnPost = async (postId: string, text: string) => {
  const res = await fetch(`${API_BASE_URL}/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ text }),
  });
  return handleResponse(res);
};

export const deletePost = async (postId: string) => {
  const res = await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  handleResponse(res);
};

export const reportPost = async (postId: string, reason: string) => {
  const res = await fetch(`${API_BASE_URL}/api/posts/${postId}/report`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ reason }),
  });
  handleResponse(res);
};

// ==================== PORTFOLIO APIS ====================

export const getPortfolio = async (contractorId: string) => {
  const res = await fetch(`${API_BASE_URL}/api/contractors/${contractorId}/portfolio`);
  return handleResponse(res);
};

export const addPortfolioItem = async (item: any) => {
  const res = await fetch(`${API_BASE_URL}/api/contractors/portfolio`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(item),
  });
  return handleResponse(res);
};

export const updatePortfolioItem = async (itemId: string, item: Partial<any>) => {
  const res = await fetch(`${API_BASE_URL}/api/contractors/portfolio/${itemId}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(item),
  });
  return handleResponse(res);
};

export const deletePortfolioItem = async (itemId: string) => {
  const res = await fetch(`${API_BASE_URL}/api/contractors/portfolio/${itemId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  handleResponse(res);
};

// ==================== REVIEW APIS ====================

export const getContractorReviews = async (contractorId: string, page = 1, limit = 10) => {
  const res = await fetch(`${API_BASE_URL}/api/reviews/contractor/${contractorId}?page=${page}&limit=${limit}`);
  return handleResponse(res);
};

export const leaveReview = async (contractorId: string, rating: number, title: string, comment: string) => {
  const res = await fetch(`${API_BASE_URL}/api/reviews`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ contractorId, rating, title, comment }),
  });
  return handleResponse(res);
};

export const reportReview = async (reviewId: string, reason: string) => {
  const res = await fetch(`${API_BASE_URL}/api/reviews/${reviewId}/report`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ reason }),
  });
  handleResponse(res);
};

// ==================== USER APIS ====================

export const getUserProfile = async () => {
  const res = await fetch(`${API_BASE_URL}/api/users/profile`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};

export const updateUserProfile = async (data: any) => {
  const res = await fetch(`${API_BASE_URL}/api/users/profile`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
};

export const updateProfilePicture = async (pictureUrl: string) => {
  const res = await fetch(`${API_BASE_URL}/api/users/profile`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ profilePicture: pictureUrl }),
  });
  return handleResponse(res);
};

export const updateBannerImage = async (imageUrl: string) => {
  const res = await fetch(`${API_BASE_URL}/api/users/profile`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ bannerImage: imageUrl }),
  });
  return handleResponse(res);
};

export const getUserReviews = async (userId: string) => {
  const res = await fetch(`${API_BASE_URL}/api/reviews/user/${userId}`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};

export const getUserProjects = async (userId: string) => {
  const res = await fetch(`${API_BASE_URL}/api/posts/user/${userId}`, {
    headers: await getAuthHeaders(),
  });
  const data = await handleResponse(res);
  return data.posts || [];
};

// ==================== STRIPE/PAYMENT APIS ====================

export const getStripeConnectUrl = async () => {
  const res = await fetch(`${API_BASE_URL}/api/stripe/connect`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};

export const getStripeAccountStatus = async () => {
  const res = await fetch(`${API_BASE_URL}/api/stripe/status`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};

export const createQuote = async (quoteData: any) => {
  const res = await fetch(`${API_BASE_URL}/api/quotes`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(quoteData),
  });
  return handleResponse(res);
};

export const getContractorLeads = async () => {
  const res = await fetch(`${API_BASE_URL}/api/contractors/leads`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};

export const getContractorQuotes = async () => {
  const res = await fetch(`${API_BASE_URL}/api/quotes/contractor`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};

export const getContractorJobs = async () => {
  const res = await fetch(`${API_BASE_URL}/api/jobs/contractor`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};

export const getContractorEarnings = async () => {
  const res = await fetch(`${API_BASE_URL}/api/contractors/earnings`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};

// ==================== NOTIFICATION APIS ====================

export const getNotifications = async () => {
  const res = await fetch(`${API_BASE_URL}/api/notifications`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};

export const markNotificationRead = async (notificationId: string) => {
  const res = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
  });
  handleResponse(res);
};

export const markAllNotificationsRead = async () => {
  const res = await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
  });
  handleResponse(res);
};

// ==================== ADMIN APIS ====================

export const getAllUsers = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
}) => {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, String(value));
    }
  });
  const res = await fetch(`${API_BASE_URL}/api/admin/users?${queryParams}`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};

export const updateUserStatus = async (userId: string, status: string) => {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ status }),
  });
  handleResponse(res);
};

export const deleteUser = async (userId: string) => {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  handleResponse(res);
};

export const getAllContractors = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  isVerified?: boolean;
}) => {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, String(value));
    }
  });
  const res = await fetch(`${API_BASE_URL}/api/admin/contractors?${queryParams}`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};

export const approveContractor = async (contractorId: string) => {
  const res = await fetch(`${API_BASE_URL}/api/admin/contractors/${contractorId}/approve`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
  });
  handleResponse(res);
};

export const rejectContractor = async (contractorId: string, reason: string) => {
  const res = await fetch(`${API_BASE_URL}/api/admin/contractors/${contractorId}/reject`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ reason }),
  });
  handleResponse(res);
};

export const getFlaggedContent = async (type: 'reviews' | 'posts') => {
  const res = await fetch(`${API_BASE_URL}/api/admin/flagged/${type}`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};

export const moderateContent = async (type: string, id: string, action: string) => {
  const res = await fetch(`${API_BASE_URL}/api/admin/moderate/${type}/${id}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ action }),
  });
  handleResponse(res);
};

export const getPlatformStats = async () => {
  const res = await fetch(`${API_BASE_URL}/api/admin/stats`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};

// ==================== IMAGE UPLOAD ====================

export const getCloudinarySignature = async (folder: string) => {
  const res = await fetch(`${API_BASE_URL}/api/admin/cloudinary-sign`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ folder }),
  });
  return handleResponse(res);
};