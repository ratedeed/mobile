import './global.css';
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';

// SYNC: Set background handler BEFORE importing App
setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
  console.log('Background message received:', remoteMessage.messageId);
  
  // DUP FIX: Only manually show a notification IF the FCM message doesn't have a 'notification' object.
  // If 'remoteMessage.notification' exists, the OS (Android/iOS) will automatically show the banner.
  // If we call scheduleNotificationAsync here as well, the user gets two banners.
  if (!remoteMessage.notification) {
    console.log('FCM: Data-only message detected, scheduling manual notification');
    await Notifications.scheduleNotificationAsync({
      content: {
        title: remoteMessage.data?.title || 'New Message',
        body: remoteMessage.data?.body || 'You have a new message.',
        data: remoteMessage.data,
        sound: 'default',
      },
      trigger: null,
    });
  } else {
    console.log('FCM: Notification object present, letting OS handle the banner to avoid doubles');
  }
  
  return Promise.resolve();
});

import App from './App';

registerRootComponent(App);
