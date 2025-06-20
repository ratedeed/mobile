
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import { post, getAuthHeaders } from '../utils/apiClient'; // Import post and getAuthHeaders
import { auth } from '../firebaseConfig'; // Import Firebase auth instance

/**
 * Handles user login by authenticating with the backend.
 * @param {string} email - User's email.
 * @param {string} password - User's password.
 * @returns {Promise<Object>} User data including token.
 * @throws {Error} If login fails.
 */
export const login = async (email, password) => {
  console.log(`auth.js: Attempting backend login for email: ${email}`);
  const data = await post(`${API_BASE_URL}/api/users/login`, { email, password });
  console.log('auth.js: Backend login successful. Received data:', JSON.stringify(data, null, 2));
  if (data && data.token) {
    await AsyncStorage.setItem('userToken', data.token);
    console.log('auth.js: userToken stored in AsyncStorage from login:', data.token ? 'Yes' : 'No');
  } else {
    console.warn('auth.js: No token received from backend login.');
  }
  return data;
};

/**
 * Logs out the user by clearing the token from AsyncStorage.
 */
export const logout = async () => {
  console.log('auth.js: Attempting to clear userToken from AsyncStorage.');
  try {
    await AsyncStorage.removeItem('userToken');
    console.log('auth.js: userToken successfully removed from AsyncStorage.');
  } catch (error) {
    console.error('auth.js: Error removing userToken from AsyncStorage:', error);
    throw new Error('Failed to clear local session: ' + error.message);
  }
};

/**
 * Registers a new user with the backend.
 * @param {string} firstName - User's first name.
 * @param {string} lastName - User's last name.
 * @param {string} email - User's email.
 * @param {string} password - User's password.
 * @param {string} zipCode - User's zip code.
 * @param {string} firebaseUid - Firebase User ID.
 * @returns {Promise<Object>} Registration success message.
 * @throws {Error} If registration fails.
 */
export const register = async (firstName, lastName, email, password, zipCode, firebaseUid) => {
  console.log(`auth.js: Attempting backend registration for email: ${email}, Firebase UID: ${firebaseUid}`);
  const data = await post(`${API_BASE_URL}/api/users/signup`, { firstName, lastName, email, password, zipCode, firebaseUid });
  console.log('auth.js: Backend registration successful. Received data:', data);
  return data;
};

/**
 * Verifies user's email with the backend.
 * @param {string} email - User's email to verify.
 * @returns {Promise<Object>} Verification success message.
 * @throws {Error} If verification fails.
 */
export const verifyEmailBackend = async (email) => {
  return await post(`${API_BASE_URL}/api/users/verify-email`, { email });
};

/**
 * Initiates the forgot password process.
 * @param {string} email - User's email for password reset.
 * @returns {Promise<Object>} Success message for password reset email.
 * @throws {Error} If forgot password request fails.
 */
export const forgotPassword = async (email) => {
  return await post(`${API_BASE_URL}/api/auth/forgot-password`, { email });
};

/**
 * Registers a new contractor with the backend.
 * @param {string} businessName - Contractor's business name.
 * @param {string} contactPerson - Contact person's name.
 * @param {string} email - Contractor's email.
 * @param {string} phone - Contractor's phone number.
 * @param {string} password - Contractor's password.
 * @param {string} zipCode - Contractor's zip code.
 * @param {string} category - Contractor's business category.
 * @returns {Promise<Object>} Registration success message.
 * @throws {Error} If contractor signup fails.
 */
export const contractorSignup = async (businessName, contactPerson, email, phone, password, zipCode, category) => {
  return await post(`${API_BASE_URL}/api/auth/contractor-signup`, { businessName, contactPerson, email, phone, password, zipCode, category });
};

/**
 * Logs in a user with Firebase ID token to the backend.
 * @param {string} idToken - Firebase ID token.
 * @param {string} email - User's email.
 * @returns {Promise<Object>} Backend login response.
 * @throws {Error} If backend login fails.
 */
export const backendLoginFirebase = async (idToken, email) => {
  console.log(`auth.js: Attempting backend Firebase login for email: ${email}`);
  const headers = { 'Authorization': `Bearer ${idToken}` };
  try {
    const data = await post(`${API_BASE_URL}/api/users/login`, { email, firebaseUid: auth.currentUser?.uid }, headers); // Pass firebaseUid
    console.log('auth.js: Backend Firebase login successful. Received data:', JSON.stringify(data, null, 2));
    if (data && data.token) {
      await AsyncStorage.setItem('userToken', data.token); // Store the token received from backend
      console.log('auth.js: userToken successfully stored in AsyncStorage from backendLoginFirebase.');
    } else {
      console.warn('auth.js: No token received from backend Firebase login. AsyncStorage not updated.');
    }
    return data;
  } catch (err) {
    console.error('auth.js: Detailed Error during backend Firebase login:', JSON.stringify(err, null, 2));
    console.error('auth.js: Error message:', err.message);
    if (err.response) {
      console.error('auth.js: Error response status:', err.response.status);
      console.error('auth.js: Error response data:', JSON.stringify(err.response.data, null, 2));
    }
    throw new Error('Failed to connect to backend for login: ' + err.message);
  }
};

/**
 * Syncs email verification status with the backend.
 * @param {string} idToken - Firebase ID token.
 * @param {string} email - User's email.
 * @param {boolean} isVerified - Verification status.
 * @returns {Promise<Object>} Backend response.
 * @throws {Error} If sync fails.
 */
export const syncEmailVerificationStatus = async (idToken, email, isVerified) => {
  console.log(`auth.js: Attempting to sync email verification status for ${email}. isVerified: ${isVerified}`);
  const headers = { 'Authorization': `Bearer ${idToken}` };
  try {
    const data = await post(`${API_BASE_URL}/api/users/verify-email`, { email, isVerified, firebaseUid: auth.currentUser?.uid }, headers); // Pass firebaseUid
    console.log('auth.js: Backend verification status synced. Response:', JSON.stringify(data, null, 2));
    return data;
  } catch (err) {
    console.error('Error syncing backend verification status:', err);
    throw new Error('Failed to sync email verification status with backend: ' + err.message);
  }
};