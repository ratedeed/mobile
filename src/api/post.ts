import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../config';
import { Post, PostComment } from '../../types';

const getAuthHeaders = async () => {
  const token = await AsyncStorage.getItem('userToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handleResponse = async (response: Response) => {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'An error occurred');
  }
  return data;
};

export const getFeedPosts = async (zipCode?: string): Promise<{ posts: Post[] }> => {
  let url = `${API_BASE_URL}/api/posts`;
  if (zipCode) url += `?zip=${zipCode}`;
  const res = await fetch(url);
  const data = await handleResponse(res);
  return { posts: data.posts || data };
};

export const getContractorPosts = async (contractorId: string): Promise<Post[]> => {
  const res = await fetch(`${API_BASE_URL}/api/posts/contractor/${contractorId}`);
  const data = await handleResponse(res);
  return Array.isArray(data) ? data : (data.posts || []);
};

export const getUserPosts = async (userId: string): Promise<{ posts: Post[] }> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/posts/user/${userId}`, {
    headers,
  });
  return handleResponse(res);
};

export const createPost = async (postData: {
  caption: string;
  images?: string[];
  tags?: string[];
  location?: string;
}): Promise<Post> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/posts`, {
    method: 'POST',
    headers,
    body: JSON.stringify(postData),
  });
  return handleResponse(res);
};

export const likePost = async (postId: string): Promise<void> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/posts/${postId}/like`, {
    method: 'POST',
    headers,
  });
  handleResponse(res);
};

export const unlikePost = async (postId: string): Promise<void> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/posts/${postId}/like`, {
    method: 'DELETE',
    headers,
  });
  handleResponse(res);
};

export const commentOnPost = async (postId: string, text: string): Promise<{ comment: PostComment }> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/posts/${postId}/comments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text }),
  });
  return handleResponse(res);
};

export const deletePost = async (postId: string): Promise<void> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
    method: 'DELETE',
    headers,
  });
  handleResponse(res);
};

export const reportPost = async (postId: string, reason: string): Promise<void> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/posts/${postId}/report`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason }),
  });
  handleResponse(res);
};

export const fetchContractorPosts = async (contractorId: string): Promise<{ posts: Post[] }> => {
  return getContractorPosts(contractorId).then(posts => ({ posts }));
};
