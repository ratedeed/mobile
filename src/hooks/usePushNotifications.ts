import { useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import messaging, { AuthorizationStatus } from '@react-native-firebase/messaging';
import { useNavigation, NavigationProp } from '@react-navigation/native';

import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { savePushToken } from '../utils/apiClient';
import { isDemoMode } from '../utils/demoMode';

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
  const pendingNotificationRef = useRef<any>(null);
  const hasHandledInitialNotificationRef = useRef<boolean>(false);

  useEffect(() => {
    if (isDemoMode()) return;
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
    if (isDemoMode()) return;
    if (isAuthenticated && expoPushToken) {
      savePushToken(expoPushToken).catch((err: any) => {
        console.error('[Push] Failed to save token:', err?.message || err);
      });
    }
  }, [isAuthenticated, expoPushToken]);

  useEffect(() => {
    if (isDemoMode()) return;
    if (!isAuthenticated) return;
    const unsubscribe = messaging().onTokenRefresh(token => {
      if (__DEV__) {
        console.log('[Push] FCM token refreshed:', token?.substring(0, 20) + '...');
      }
      setExpoPushToken(token);
    });
    return unsubscribe;
  }, [isAuthenticated]);

  useEffect(() => {
    if (isDemoMode()) return;
    if (!isAuthenticated) return;
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      if (__DEV__) {
        console.log('[Push] Foreground message received:', remoteMessage);
      }
      refreshNotifications().catch(() => {});
    });

    const receivedListener = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    return () => {
      unsubscribe();
      receivedListener.remove();
    };
  }, [refreshNotifications, isAuthenticated]);

  useEffect(() => {
    const navigateByLink = (link: string | undefined, userRole: string | null) => {
      if (!link) return false;
      let path = link;
      if (path.startsWith('http')) {
        try {
          const urlObj = new URL(path);
          path = urlObj.pathname + urlObj.search;
        } catch (e) {
          path = path.replace(/^https?:\/\/[^\/]+/, '');
        }
      }

      if (path.startsWith('/messages/')) {
        const conversationId = path.split('/')[2];
        if (conversationId) {
          navigation.navigate('ChatScreen', { conversationId });
          return true;
        }
      } else if (path.startsWith('/chat')) {
        const cid = path.match(/[?&]conversationId=([^&]+)/)?.[1];
        if (cid) {
          navigation.navigate('ChatScreen', { conversationId: cid });
        } else {
          navigation.navigate('Main', { screen: 'Messages' });
        }
        return true;
      } else if (path.startsWith('/messages')) {
        navigation.navigate('Main', { screen: 'Messages' });
        return true;
      }

      if (path.startsWith('/help') || path.startsWith('/my-tickets')) {
        const ticketIdMatch = path.match(/#?(TIK-[A-Z0-9]+)/i);
        navigation.navigate('MyTickets', { ticketId: ticketIdMatch ? ticketIdMatch[1] : undefined });
        return true;
      }
      
      if (path.startsWith('/leads/')) {
        if (userRole === 'contractor' || userRole === 'admin') {
          navigation.navigate('ContractorDashboard');
        } else {
          navigation.navigate('Main', { screen: 'Profile' });
        }
        return true;
      }
      
      if (path.startsWith('/quotes/')) {
        navigation.navigate('Main', { screen: 'Jobs' });
        return true;
      }
      
      if (path.startsWith('/jobs/')) {
        const jobId = path.split('/')[2];
        if (jobId) {
          navigation.navigate('JobDetail', { jobId });
        } else {
          navigation.navigate('Main', { screen: 'Jobs' });
        }
        return true;
      }
      
      if (path.startsWith('/jobs')) {
        navigation.navigate('Main', { screen: 'Jobs' });
        return true;
      }
      
      if (path.startsWith('/quote-review')) {
        const quoteId = path.split('/')[2] || path.match(/[?&]quoteId=([^&]+)/)?.[1];
        if (quoteId) {
          navigation.navigate('QuoteReview', { quoteId });
          return true;
        }
      }
      
      if (path.startsWith('/contractor-dashboard')) {
        if (userRole === 'contractor' || userRole === 'admin') {
          navigation.navigate('ContractorDashboard');
        } else {
          navigation.navigate('Main', { screen: 'Profile' });
        }
        return true;
      }
      
      if (path.startsWith('/detail/')) {
        const slug = path.split('/')[2];
        if (slug) {
          navigation.navigate('BusinessDetail', { slug });
          return true;
        }
      }
      
      if (path.startsWith('/payment')) {
        const quoteId = path.split('/')[2] || path.match(/[?&]quoteId=([^&]+)/)?.[1];
        if (quoteId) {
          navigation.navigate('QuoteReview', { quoteId });
          return true;
        }
      }
      
      if (path.startsWith('/dispute/')) {
        const jobId = path.split('/')[2];
        if (jobId) {
          navigation.navigate('DisputeScreen', { jobId });
          return true;
        }
      }
      
      if (path.startsWith('/review/')) {
        const jobId = path.split('/')[2];
        if (jobId) {
          navigation.navigate('ReviewScreen', { jobId });
          return true;
        }
      }

      if (path.startsWith('/c/') || path.startsWith('/contractors/')) {
        const slug = path.split('/')[2];
        if (slug) {
          navigation.navigate('BusinessDetail', { slug });
          return true;
        }
      }

      if (path.startsWith('/post/')) {
        const postId = path.split('/')[2];
        if (postId) {
          navigation.navigate('Main', { screen: 'Explore', params: { postId } });
          return true;
        }
      }

      if (path.startsWith('/affiliate')) {
        navigation.navigate('AffiliateScreen');
        return true;
      }
      return false;
    };

    const handleRouteData = (data: any) => {
      if (data?.link && navigateByLink(String(data.link), userRole)) {
        return;
      }

      if ((data?.type === 'new_message' || data?.type === 'quote_request' || data?.type === 'ticket_reply') && data?.conversationId) {
        navigation.navigate('ChatScreen', {
          conversationId: String(data.conversationId),
          recipientId: data.senderId != null ? String(data.senderId) : undefined,
          recipientName: data.senderName != null ? String(data.senderName) : undefined,
        });
      } else if (data?.type === 'ticket_closed' || data?.type === 'ticket_resolved') {
        navigation.navigate('MyTickets');
      } else if (data?.type === 'new_review') {
        navigation.navigate('Main', { screen: 'Profile' });
      } else if (data?.type === 'new_lead') {
        if (userRole === 'contractor' || userRole === 'admin') {
          navigation.navigate('ContractorDashboard');
        } else {
          navigation.navigate('Main', { screen: 'Profile' });
        }
      } else if (data?.type === 'quote_request' && data?.quoteId) {
        navigation.navigate('QuoteReview', { quoteId: String(data.quoteId) });
      } else if (data?.type === 'review_reminder' || data?.type === 'funds_release_reminder') {
        navigation.navigate('Main', { screen: 'Jobs' });
      } else if (data?.type === 'job_update' || data?.type === 'job_cancelled' || data?.type === 'refund_processed' || data?.type === 'dispute') {
        if (userRole === 'contractor' || userRole === 'admin') {
          navigation.navigate('ContractorDashboard');
        } else {
          navigation.navigate('Main', { screen: 'Jobs' });
        }
      } else if (data?.type === 'stripe_approved' || data?.type === 'stripe_action_required') {
        if (userRole === 'contractor' || userRole === 'admin') {
          navigation.navigate('ContractorDashboard');
        } else {
          navigation.navigate('Main', { screen: 'Profile' });
        }
      } else if (
        data?.type === 'affiliate_commission' ||
        data?.type === 'affiliate_payout_approved' ||
        data?.type === 'affiliate_payout_rejected'
      ) {
        navigation.navigate('AffiliateScreen');
      }
    };

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      // Wait for BOTH auth and role to be ready before navigating,
      // otherwise role-dependent routes (e.g. ContractorDashboard) go
      // to the wrong screen when userRole is still null during cold start.
      if (!isAuthenticated || !userRole) {
        pendingNotificationRef.current = data;
      } else {
        handleRouteData(data);
      }
    });

    const checkInitialNotification = async () => {
      if (hasHandledInitialNotificationRef.current) return;
      hasHandledInitialNotificationRef.current = true;
      const response = await Notifications.getLastNotificationResponseAsync();
      if (!response) return;
      const data = response.notification.request.content.data;
      if (!isAuthenticated || !userRole) {
        pendingNotificationRef.current = data;
      } else {
        handleRouteData(data);
      }
    };

    // Process any pending notification once auth AND role are both ready.
    if (isAuthenticated && userRole && pendingNotificationRef.current) {
      handleRouteData(pendingNotificationRef.current);
      pendingNotificationRef.current = null;
    }

    checkInitialNotification();

    return () => { responseListener.remove(); };
  }, [navigation, isAuthenticated, userRole]);

  return { expoPushToken, notification };
};