import './global.css';
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';

// SYNC: Set background handler BEFORE importing App to ensure early registration
setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
  console.log('Message handled in the background!', JSON.stringify(remoteMessage, null, 2));
  return Promise.resolve();
});

import App from './App';

registerRootComponent(App);
