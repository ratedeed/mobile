import { get, put, del, getAuthHeaders } from '../utils/apiClient';
import { API_BASE_URL } from '../config';

export const getNotifications = async () => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE_URL}/api/notifications`, authHeaders);
};

export const markNotificationRead = async (notificationId) => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {}, authHeaders);
};

export const markAllNotificationsRead = async () => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE_URL}/api/notifications/read-all`, {}, authHeaders);
};

export const deleteNotification = async (notificationId) => {
  const authHeaders = await getAuthHeaders();
  return del(`${API_BASE_URL}/api/notifications/${notificationId}`, authHeaders);
};
