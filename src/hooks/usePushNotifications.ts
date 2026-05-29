import { useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import messaging, { AuthorizationStatus } from '@react-native-firebase/messaging';
import { useNavigation, NavigationProp } from '@react-navigation/native';

import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { savePushToken } from '../utils/apiClient';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const usePushNotifications = () => {
  const { isAuthenticated, userRole } = useAuth();
  const { refreshNotifications } = useNotifications();
  const navigation = useNavigation<NavigationProp<any>>();
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
  const [notification, setNotification] = useState<Notifications.Notification | undefined>();

  useEffect(() => {
    const initPush = async () => {
      try {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === AuthorizationStatus.AUTHORIZED ||
          authStatus === AuthorizationStatus.PROVISIONAL;

        if (!enabled) {
          if (__DEV__) console.warn('[Push] Notification permission denied');
          return;
        }

        if (__DEV__) {
          console.log('[Push] Notification permission granted');
        }

        if (Platform.OS === 'ios') {
          let apnsToken: string | null = null;
          for (let i = 0; i < 10; i++) {
            try {
              apnsToken = await messaging().getAPNSToken();
            } catch {}
            if (apnsToken) {
              if (__DEV__) {
                console.log('[Push] APNS token acquired:', apnsToken.substring(0, 20) + '...');
              }
              break;
            }
            await new Promise(r => setTimeout(r, 500));
          }
          if (!apnsToken) {
            if (__DEV__) {
              console.warn('[Push] APNS token not available — common on iOS Simulators. Push notifications will work on real devices.');
            }
            return;
          }
        }

        const fcmToken = await messaging().getToken();
        if (__DEV__) {
          console.log('[Push] FCM token:', fcmToken?.substring(0, 20) + '...');
        }
        setExpoPushToken(fcmToken);
      } catch (err: any) {
        console.error('[Push] Init error:', err?.message || err);
      }
    };

    initPush();
  }, []);

  useEffect(() => {
    if (isAuthenticated && expoPushToken) {
      savePushToken(expoPushToken).catch((err: any) => {
        console.error('[Push] Failed to save token:', err?.message || err);
      });
    }
  }, [isAuthenticated, expoPushToken]);

  useEffect(() => {
    const unsubscribe = messaging().onTokenRefresh(token => {
      if (__DEV__) {
        console.log('[Push] FCM token refreshed:', token?.substring(0, 20) + '...');
      }
      setExpoPushToken(token);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      const data = remoteMessage.data || {};
      if (__DEV__) {
        console.log('[Push] Foreground message:', remoteMessage);
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          title: String(data.title || remoteMessage.notification?.title || 'New Notification'),
          body: String(data.body || remoteMessage.notification?.body || 'You have a new message.'),
          data: data as Record<string, string>,
        },
        trigger: null,
      });
      refreshNotifications().catch(() => {});
    });

    const receivedListener = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    return () => {
      unsubscribe();
      receivedListener.remove();
    };
  }, [refreshNotifications]);

  useEffect(() => {
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      if (!isAuthenticated) return;
      const data = response.notification.request.content.data;
      if ((data?.type === 'new_message' || data?.type === 'quote_request') && data?.conversationId) {
        navigation.navigate('ChatScreen', {
          conversationId: String(data.conversationId),
          recipientId: data.senderId != null ? String(data.senderId) : undefined,
          recipientName: data.senderName != null ? String(data.senderName) : undefined,
        });
      } else if (data?.type === 'new_review') {
        navigation.navigate('Profile');
      } else if (data?.type === 'new_lead') {
        if (userRole === 'contractor' || userRole === 'admin') {
          navigation.navigate('ContractorDashboard');
        } else {
          navigation.navigate('Profile');
        }
      }
    });

    const checkInitialNotification = async () => {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (!response || !isAuthenticated) return;
      const data = response.notification.request.content.data;
      if ((data?.type === 'new_message' || data?.type === 'quote_request') && data?.conversationId) {
        navigation.navigate('ChatScreen', {
          conversationId: String(data.conversationId),
          recipientId: data.senderId != null ? String(data.senderId) : undefined,
          recipientName: data.senderName != null ? String(data.senderName) : undefined,
        });
      } else if (data?.type === 'new_review') {
        navigation.navigate('Profile');
      } else if (data?.type === 'new_lead') {
        if (userRole === 'contractor' || userRole === 'admin') {
          navigation.navigate('ContractorDashboard');
        } else {
          navigation.navigate('Profile');
        }
      }
    };

    checkInitialNotification();

    return () => { responseListener.remove(); };
  }, [navigation, isAuthenticated, userRole]);

  return { expoPushToken, notification };
};