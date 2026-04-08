import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import { post } from '../utils/apiClient';
import { auth } from '../firebaseConfig';

export const login = async (email, password) => {
  const data = await post(`${API_BASE_URL}/api/users/login`, { email, password });
  if (data && data.token) {
    await AsyncStorage.setItem('userInfo', JSON.stringify({ token: data.token, ...data.user }));
  }
  return data;
};

export const logout = async () => {
  try {
    await AsyncStorage.removeItem('userInfo');
  } catch (error) {
    throw new Error('Failed to clear local session: ' + error.message);
  }
};

export const register = async (firstName, lastName, email, password, zipCode, firebaseUid) => {
  return post(`${API_BASE_URL}/api/users/signup`, { firstName, lastName, email, password, zipCode, firebaseUid });
};

export const verifyEmailBackend = async (email) => {
  return post(`${API_BASE_URL}/api/users/verify-email`, { email });
};

export const forgotPassword = async (email) => {
  return post(`${API_BASE_URL}/api/auth/forgot-password`, { email });
};

export const contractorSignup = async (businessName, contactPerson, email, phone, password, zipCode, category) => {
  return post(`${API_BASE_URL}/api/auth/contractor-signup`, { businessName, contactPerson, email, phone, password, zipCode, category });
};

export const backendLoginFirebase = async (idToken, email) => {
  const headers = { 'Authorization': `Bearer ${idToken}` };
  const data = await post(`${API_BASE_URL}/api/users/login`, { email, firebaseUid: auth.currentUser?.uid }, headers);
  if (data && data.token) {
    await AsyncStorage.setItem('userInfo', JSON.stringify({ token: data.token, ...data.user }));
  }
  return data;
};

export const syncEmailVerificationStatus = async (idToken, email, isVerified) => {
  const headers = { 'Authorization': `Bearer ${idToken}` };
  return post(`${API_BASE_URL}/api/users/verify-email`, { email, isVerified, firebaseUid: auth.currentUser?.uid }, headers);
};
