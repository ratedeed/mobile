import { useEffect, useState, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
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
  const navigation = useNavigation();
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
  const [notification, setNotification] = useState<Notifications.Notification | undefined>();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    const requestUserPermission = async () => {
      try {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (enabled) {
          console.log('Push Authorization status:', authStatus);
          const fcmToken = await messaging().getToken();
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

    // Foreground message handler
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      console.log('A new FCM message arrived!', JSON.stringify(remoteMessage));
      await Notifications.scheduleNotificationAsync({
        content: {
          title: remoteMessage.notification?.title || 'New Notification',
          body: remoteMessage.notification?.body || 'You have a new message.',
          data: remoteMessage.data,
        },
        trigger: null,
      });
    });

    // Notification tap handler
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
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
  }, [isAuthenticated]);

  return { expoPushToken, notification };
};
