
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

export const login = async (email, password) => {
  const res = await fetch(`${API_BASE_URL}/api/users/login`, { // Login is now under /api/users
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error: ${res.status} - ${text}`);
  }
  const data = await res.json();
  await AsyncStorage.setItem('userToken', data.token);
  return data;
};

export const register = async (firstName, lastName, email, password, zipCode) => {
  const res = await fetch(`${API_BASE_URL}/api/users/signup`, { // Signup is now under /api/users
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ firstName, lastName, email, password, zipCode }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error: ${res.status} - ${text}`);
  }
  return await res.json();
};

export const forgotPassword = async (email) => {
  const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error: ${res.status} - ${text}`);
  }
  return await res.json();
};

export const contractorSignup = async (businessName, contactPerson, email, phone, password, zipCode, category) => {
  const res = await fetch(`${API_BASE_URL}/api/auth/contractor-signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ businessName, contactPerson, email, phone, password, zipCode, category }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error: ${res.status} - ${text}`);
  }
  return await res.json();
};