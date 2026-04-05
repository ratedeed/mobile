import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../config';
import { Notification } from '../../types';

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

export const getNotifications = async (): Promise<Notification[]> => {
  const res = await fetch(`${API_BASE_URL}/api/notifications`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};

export const markNotificationRead = async (notificationId: string): Promise<void> => {
  const res = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
  });
  handleResponse(res);
};

export const markAllNotificationsRead = async (): Promise<void> => {
  const res = await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
  });
  handleResponse(res);
};

export const deleteNotification = async (notificationId: string): Promise<void> => {
  const res = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  handleResponse(res);
};
