import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

let hapticsEnabled = true;

AsyncStorage.getItem('haptics_enabled').then(val => {
  hapticsEnabled = val !== 'false';
}).catch(() => {});

const triggerIfEnabled = (type: Haptics.ImpactFeedbackStyle | 'notification' | 'selection', notificationType?: Haptics.NotificationFeedbackType) => {
  if (!hapticsEnabled) return;
  try {
    if (type === 'selection') {
      Haptics.selectionAsync();
    } else if (type === 'notification' && notificationType) {
      Haptics.notificationAsync(notificationType);
    } else {
      Haptics.impactAsync(type as Haptics.ImpactFeedbackStyle);
    }
  } catch {}
};

const HapticFeedback = {
  light: () => triggerIfEnabled(Haptics.ImpactFeedbackStyle.Light),
  medium: () => triggerIfEnabled(Haptics.ImpactFeedbackStyle.Medium),
  heavy: () => triggerIfEnabled(Haptics.ImpactFeedbackStyle.Heavy),
  selection: () => triggerIfEnabled('selection'),
  success: () => triggerIfEnabled('notification', Haptics.NotificationFeedbackType.Success),
  warning: () => triggerIfEnabled('notification', Haptics.NotificationFeedbackType.Warning),
  error: () => triggerIfEnabled('notification', Haptics.NotificationFeedbackType.Error),
};

export default HapticFeedback;