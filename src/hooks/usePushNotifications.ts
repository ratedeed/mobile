import { useEffect, useState, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { 
  getMessaging, 
  getToken, 
  onMessage, 
  requestPermission, 
  AuthorizationStatus 
} from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { savePushToken } from '../utils/apiClient';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const usePushNotifications = () => {
  const { isAuthenticated } = useAuth();
  const { refreshNotifications } = useNotifications();
  const navigation = useNavigation();
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
  const [notification, setNotification] = useState<Notifications.Notification | undefined>();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    const messaging = getMessaging();

    const requestUserPermission = async () => {
      try {
        const authStatus = await requestPermission(messaging);
        const enabled =
          authStatus === AuthorizationStatus.AUTHORIZED ||
          authStatus === AuthorizationStatus.PROVISIONAL;

        if (enabled) {
          console.log('Push Authorization status:', authStatus);
          const fcmToken = await getToken(messaging);
          console.log('FCM Token acquired:', fcmToken);
          setExpoPushToken(fcmToken);

          if (isAuthenticated && fcmToken) {
            try {
              await savePushToken(fcmToken);
              console.log('FCM Token saved to backend');
            } catch (err) {
              console.error('Error saving push token to backend:', err);
            }
          }
        }
      } catch (error) {
        console.warn('Failed to get push token', error);
      }
    };

    requestUserPermission();

    // Save token if already acquired but auth just happened
    if (isAuthenticated && expoPushToken) {
      savePushToken(expoPushToken).catch(err => console.error('Error saving push token on auth:', err));
    }

    // Foreground message handler
    const unsubscribe = onMessage(messaging, async remoteMessage => {
      console.log('A new FCM message arrived!', JSON.stringify(remoteMessage));
      
      // 1. Show system alert
      await Notifications.scheduleNotificationAsync({
        content: {
          title: remoteMessage.notification?.title || 'New Notification',
          body: remoteMessage.notification?.body || 'You have a new message.',
          data: remoteMessage.data,
        },
        trigger: null,
      });

      // 2. SYNC: Refresh Bell history
      refreshNotifications().catch(e => console.error('Failed to refresh after FCM:', e));
    });

    // Notification tap handler
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Foreground notification received!', JSON.stringify(notification, null, 2));
      setNotification(notification);
      
      // Auto-refresh notifications and unread counts
      AsyncStorage.getItem('unreadNotifications').then(val => {
        const count = val ? parseInt(val, 10) : 0;
        AsyncStorage.setItem('unreadNotifications', (count + 1).toString());
      });
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped!', JSON.stringify(response, null, 2));
      const data = response.notification.request.content.data;
      
      if (data?.type === 'new_message' && data?.conversationId) {
        // @ts-ignore
        navigation.navigate('ChatScreen', { conversationId: data.conversationId });
      } else if (data?.type === 'new_review') {
        // @ts-ignore
        navigation.navigate('Main', { screen: 'Profile' });
      } else if (data?.type === 'new_lead') {
        // @ts-ignore
        navigation.navigate('ContractorDashboard');
      }
    });

    return () => {
      unsubscribe();
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [isAuthenticated, expoPushToken]);

  return { expoPushToken, notification };
};
