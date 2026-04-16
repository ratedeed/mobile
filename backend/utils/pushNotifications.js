const admin = require('firebase-admin');

/**
 * Send a push notification to a specific user using the production Firebase instance.
 * Synchronized with Render "Work" implementation.
 * 
 * @param {string} pushToken - The user's stored FCM token
 * @param {object} payload - { title, body, data }
 */
const sendPushNotification = async (pushToken, { title, body, data = {} }) => {
  if (!pushToken) {
    console.log('Push notification skipped: No token provided');
    return;
  }

  try {
    // SYNC: Use the specifically named app instance as defined in production server.js
    let app;
    try {
      app = admin.app('ratedeedAdminApp');
    } catch (e) {
      // Fallback to default app if the specific one isn't initialized locally
      app = admin.app();
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

    const response = await app.messaging().send(message);
    console.log('Successfully sent push notification:', response);
    return response;
  } catch (error) {
    console.error('Error sending push notification:', error);
    if (error.code === 'messaging/registration-token-not-registered' || error.code === 'messaging/invalid-registration-token') {
      console.log('Token expired or invalid');
    }
  }
};

module.exports = { sendPushNotification };
