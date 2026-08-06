import { LogBox } from 'react-native';
import { isDemoMode } from './demoMode';

let applied = false;

export const silenceWarnings = () => {
  if (applied) return;
  applied = true;

  LogBox.ignoreAllLogs(true);

  if (!isDemoMode()) return;

  const noop = () => {};
  const origWarn = console.warn;
  const origError = console.error;
  const origLog = console.log;

  const isNoise = (args: any[]) => {
    if (!args || args.length === 0) return false;
    const first = args[0];
    if (typeof first !== 'string') return false;
    const blocked = [
      'AsyncStorage',
      'new NativeEventEmitter',
      'EventEmitter.removeListener',
      'Sending',
      'Require cycle',
      'useNativeDriver',
      'Possible Unhandled Promise Rejection',
      'Module RCTImageLoader',
      'Module RCTNetworking',
      'stripe',
      'Stripe',
      'firebase',
      'Firebase',
      'Sentry',
      'Warning:',
      'openclaw',
      'Possible memory leak',
      'componentWillReceiveProps',
      'componentWillMount',
      'componentWillUpdate',
      'DEMO:',
      'opencode',
      'antigravity',
      '.kilo',
      '.claude',
      '.roo',
      'opencode.json',
      '[Push]',
      '[FCM]',
      'messaging()',
      'getExpoPushToken',
      'getDevicePushToken',
      'notification',
      'Notification',
      'expo-notifications',
      'expo-tracking-transparency',
      'expo-tracking',
      'registerForPushNotifications',
      'AppleAuthentication',
      'AppleAuth',
      'Linking',
      'tracking-transparency',
      'NetInfo',
      'Network',
      'EXPO_PUBLIC',
      'reanimated',
      'Reanimated',
      'SplashScreen',
      'splash',
      'app.json',
      'expo-updates',
      'Updates',
      'hasBeenLoaded',
      'EAS',
      'eas',
      'expo-constants',
      'expo-modules',
      'Constants',
      'expo-secure-store',
      'expo-clipboard',
      'DocumentPicker',
      'ImagePicker',
      'Permissions',
      'hasMediaLibraryPermission',
      'Native splash',
      'expo-splash-screen',
      'free.freeipapi',
      'i.pravatar',
      'images.unsplash',
      'picsum',
      'AxiosError',
      'getaddrinfo',
      'Network request failed',
      'ENETUNREACH',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'socket hang up',
      'timeout exceeded',
      'aborted',
      'Aborted',
      'cancelled',
      'Canceled',
      'DEMO_MODE',
      'rate-limit',
      'RateDeed',
      'Demo mode',
      'demo mode',
      'JWT',
      'jwt',
      'secureStore',
      'SecureStore',
      'keychain',
      'Keychain',
    ];
    return blocked.some((s) => first.includes(s));
  };

  console.warn = (...args: any[]) => { if (!isNoise(args)) origWarn(...args); };
  console.error = (...args: any[]) => { if (!isNoise(args)) origError(...args); };
  console.log = (...args: any[]) => { if (!isNoise(args)) origLog(...args); };
};
