import { useEffect, useState, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import {
  getMessaging,
  getToken,
  onMessage,
  requestPermission,
  AuthorizationStatus
} from '@react-native-firebase/messaging';
import { useNavigation } from '@react-navigation/native';
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

  // Effect 1: Request permission and get FCM token (runs once)
  useEffect(() => {
    const messaging = getMessaging();
    const requestUserPermission = async () => {
      try {
        const authStatus = await requestPermission(messaging);
        const enabled =
          authStatus === AuthorizationStatus.AUTHORIZED ||
          authStatus === AuthorizationStatus.PROVISIONAL;
        if (enabled) {
          const fcmToken = await getToken(messaging);
          console.log('FCM Token acquired:', fcmToken);
          setExpoPushToken(fcmToken);
        }
      } catch (error) {
        console.warn('Failed to get push token', error);
      }
    };
    requestUserPermission();
  }, []);

  // Effect 2: Save token to backend whenever we have both token and auth
  useEffect(() => {
    if (isAuthenticated && expoPushToken) {
      savePushToken(expoPushToken).catch(err =>
        console.error('Error saving push token to backend:', err)
      );
    }
  }, [isAuthenticated, expoPushToken]);

  // Effect 3: Foreground FCM message listener
  useEffect(() => {
    const messaging = getMessaging();
    const unsubscribe = onMessage(messaging, async remoteMessage => {
      console.log('A new FCM message arrived!');
      await Notifications.scheduleNotificationAsync({
        content: {
          title: remoteMessage.notification?.title || 'New Notification',
          body: remoteMessage.notification?.body || 'You have a new message.',
          data: remoteMessage.data,
        },
        trigger: null,
      });
      refreshNotifications().catch(e => console.error('Failed to refresh after FCM:', e));
    });

    const receivedListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Foreground notification received!');
      setNotification(notification);
    });

    return () => {
      unsubscribe();
      receivedListener.remove();
    };
  }, [refreshNotifications]);

  // Effect 4: Notification response (tap) listener
  useEffect(() => {
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped!');
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
    return () => { responseListener.remove(); };
  }, [navigation]);

  return { expoPushToken, notification };
};
