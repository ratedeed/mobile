
import { API_BASE_URL } from '../config';
import { getAuthHeaders, handleResponse } from '../utils/apiClient'; // Import getAuthHeaders and handleResponse

export const fetchConversations = async () => {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/messages/conversations`, {
    method: 'GET',
    headers: authHeaders,
  });
  return handleResponse(response);
};

export const fetchMessages = async (otherUserId) => {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/messages/conversation/${otherUserId}`, {
    method: 'GET',
    headers: authHeaders,
  });
  return handleResponse(response);
};

export const sendMessage = async (recipientId, messageText) => {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({ recipientId, messageText }),
  });
  return handleResponse(response);
};