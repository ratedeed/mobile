const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
try {
  // Try to find the service account key in various locations
  let serviceAccount;
  try {
    serviceAccount = require('../serviceAccountKey.json');
  } catch (e) {
    try {
      // Check if it's in the root directory (one level up from backend)
      serviceAccount = require('../../serviceAccountKey.json');
    } catch (e2) {
      // Check if it's in the config folder
      serviceAccount = require('../config/serviceAccountKey.json');
    }
  }

  if (serviceAccount && !admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized for Push Notifications');
  }
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
  if (!pushToken || !admin.apps.length) {
    console.log('Push notification skipped: Token or Firebase Admin missing');
    return;
  }

  // Ensure all data values are strings for FCM
  const stringData = {};
  Object.keys(data).forEach(key => {
    stringData[key] = String(data[key]);
  });

  const message = {
    notification: {
      title,
      body,
    },
    data: stringData,
    token: pushToken,
    // Android specific configuration
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'default',
      },
    },
    // iOS specific configuration
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
          contentAvailable: true, // Crucial for background tasks
        },
      },
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Successfully sent push notification:', response);
    return response;
  } catch (error) {
    console.error('Error sending push notification:', error);
    if (error.code === 'messaging/registration-token-not-registered') {
      console.log('Token expired or unregistered');
    }
  }
};

module.exports = { sendPushNotification };
