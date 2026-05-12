import './global.css';
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';

setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
  const data = remoteMessage.data || {};
  const title = remoteMessage.notification?.title || data.title || 'New Message';
  const body = remoteMessage.notification?.body || data.body || 'You have a new message.';

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: 'default',
    },
    trigger: null,
  });

  return Promise.resolve();
});

import App from './App';

registerRootComponent(App);