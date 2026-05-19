import { useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
} from '@react-native-firebase/messaging';
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
  const { isAuthenticated } = useAuth();
  const { refreshNotifications } = useNotifications();
  const navigation = useNavigation<NavigationProp<any>>();
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
  const [notification, setNotification] = useState<Notifications.Notification | undefined>();
  const apnsReadyRef = useRef(false);

  // ─── Permissions + APNS registration ──────────────────────────────────────
  // On iOS, FCM needs an APNS token first. When expo-notifications is also
  // installed it can interfere with Firebase's delegate swizzling. We request
  // permissions through expo-notifications (which calls registerForRemoteNotifications)
  // and then poll for the APNS token before asking Firebase for an FCM token.
  useEffect(() => {
    const messaging = getMessaging();

    const initPush = async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
            },
          });
          finalStatus = status;
        }

        if (__DEV__) {
          console.log('[Push] Notification permission status:', finalStatus);
        }

        if (finalStatus !== 'granted') {
          console.warn('[Push] Notification permission denied');
          return;
        }

        // iOS: wait up to 5s for APNS token to propagate to Firebase
        if (Platform.OS === 'ios') {
          let apnsToken: string | null = null;
          for (let i = 0; i < 10; i++) {
            try {
              const { getAPNSToken } = require('@react-native-firebase/messaging');
              apnsToken = await getAPNSToken(messaging);
            } catch {}
            if (apnsToken) {
              apnsReadyRef.current = true;
              if (__DEV__) {
                console.log('[Push] APNS token acquired:', apnsToken.substring(0, 20) + '...');
              }
              break;
            }
            await new Promise(r => setTimeout(r, 500));
          }
          if (!apnsToken) {
            console.error('[Push] APNS token never arrived — iOS remote notifications will not work. ' +
              'Make sure Push Notifications capability is enabled in Xcode and the provisioning profile includes it.');
          }
        }

        const fcmToken = await getToken(messaging);
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

  // ─── Save token to backend ────────────────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated && expoPushToken) {
      savePushToken(expoPushToken).catch((err: any) => {
        console.error('[Push] Failed to save token:', err?.message || err);
      });
    }
  }, [isAuthenticated, expoPushToken]);

  // ─── Token refresh ────────────────────────────────────────────────────────
  useEffect(() => {
    const messaging = getMessaging();
    const unsubscribe = onTokenRefresh(messaging, token => {
      if (__DEV__) {
        console.log('[Push] FCM token refreshed:', token?.substring(0, 20) + '...');
      }
      setExpoPushToken(token);
    });
    return unsubscribe;
  }, []);

  // ─── Foreground message handler ───────────────────────────────────────────
  useEffect(() => {
    const messaging = getMessaging();
    const unsubscribe = onMessage(messaging, async remoteMessage => {
      const data = remoteMessage.data || {};
      if (__DEV__) {
        console.log('[Push] Foreground message:', remoteMessage);
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          title: String(data.title || 'New Notification'),
          body: String(data.body || 'You have a new message.'),
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

  // ─── Notification tap handler ─────────────────────────────────────────────
  useEffect(() => {
    // Handle taps when app is in background (not killed)
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
        navigation.navigate('ContractorDashboard');
      }
    });

    // Handle taps when app was killed (iOS / Android)
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
        navigation.navigate('ContractorDashboard');
      }
    };

    checkInitialNotification();

    return () => { responseListener.remove(); };
  }, [navigation, isAuthenticated]);

  return { expoPushToken, notification };
};
