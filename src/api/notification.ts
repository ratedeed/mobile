import { get, put, del, getAuthHeaders } from '../utils/apiClient';
import { API_BASE_URL } from '../config';
import { Notification } from '../types';

export const getNotifications = async (): Promise<Notification[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE_URL}/api/notifications`, authHeaders);
};

export const markNotificationRead = async (notificationId: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {}, authHeaders);
};

export const markAllNotificationsRead = async (): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE_URL}/api/notifications/read-all`, {}, authHeaders);
};

export const deleteNotification = async (notificationId: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return del(`${API_BASE_URL}/api/notifications/${notificationId}`, authHeaders);
};
