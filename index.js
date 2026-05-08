import './global.css';
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';

// SYNC: Set background handler BEFORE importing App
setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
  if (!remoteMessage.notification) {
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
    await Promise.resolve();
  }

  return Promise.resolve();
});
import App from './App';

registerRootComponent(App);
