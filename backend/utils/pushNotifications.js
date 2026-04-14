const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
// Note: You must download your service account key from Firebase Console
// Settings -> Service Accounts -> Generate New Private Key
try {
  const serviceAccount = require('../serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin initialized for Push Notifications');
} catch (error) {
  console.warn('Firebase Admin could not be initialized. Push notifications will be disabled.');
  console.warn('To enable, place serviceAccountKey.json in the backend folder.');
}

/**
 * Send a push notification to a specific user
 * @param {string} pushToken - The user's stored FCM token
 * @param {object} payload - { title, body, data }
 */
const sendPushNotification = async (pushToken, { title, body, data = {} }) => {
  if (!pushToken) return;

  const message = {
    notification: {
      title,
      body,
    },
    data: {
      ...data,
      // Ensure all data values are strings for FCM
      click_action: 'FLUTTER_NOTIFICATION_CLICK', // For background handling
    },
    token: pushToken,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Successfully sent push notification:', response);
    return response;
  } catch (error) {
    console.error('Error sending push notification:', error);
    if (error.code === 'messaging/registration-token-not-registered') {
      // Token is no longer valid, you should probably remove it from the user model
      console.log('Token expired or unregistered');
    }
  }
};

module.exports = { sendPushNotification };
