import { useEffect, useState, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import {
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
  requestPermission,
  AuthorizationStatus
} from '@react-native-firebase/messaging';
import { useNavigation, NavigationProp } from '@react-navigation/native';

type RootStackParamList = {
  ChatScreen: { conversationId: string; recipientId?: string; recipientName?: string };
  Profile: undefined;
  ContractorDashboard: undefined;
};
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
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
  const [notification, setNotification] = useState<Notifications.Notification | undefined>();

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
          setExpoPushToken(fcmToken);
        }
      } catch {}
    };
    requestUserPermission();
  }, []);

  useEffect(() => {
    if (isAuthenticated && expoPushToken) {
      savePushToken(expoPushToken).catch(() => {});
    }
  }, [isAuthenticated, expoPushToken]);

  useEffect(() => {
    const messaging = getMessaging();
    const unsubscribe = onTokenRefresh(messaging, token => {
      setExpoPushToken(token);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const messaging = getMessaging();
    const unsubscribe = onMessage(messaging, async remoteMessage => {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: String(remoteMessage.notification?.title || remoteMessage.data?.title || 'New Notification'),
          body: String(remoteMessage.notification?.body || remoteMessage.data?.body || 'You have a new message.'),
          data: remoteMessage.data as Record<string, string>,
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
          conversationId: data.conversationId,
          recipientId: data.senderId,
          recipientName: data.senderName,
        });
      } else if (data?.type === 'new_review') {
        navigation.navigate('Profile');
      } else if (data?.type === 'new_lead') {
        navigation.navigate('ContractorDashboard');
      }
    });
    return () => { responseListener.remove(); };
  }, [navigation, isAuthenticated]);

  return { expoPushToken, notification };
};