import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const triggerIfEnabled = async (callback) => {
  try {
    const val = await AsyncStorage.getItem('haptics_enabled');
    if (val === 'false') return; // Explicitly disabled
    callback();
  } catch (e) {
    callback(); // Default to on if error
  }
};

const HapticFeedback = {
  light: () => {
    triggerIfEnabled(() => {
      if (Platform.OS === 'ios') {
        try {
          const { UIImpactFeedbackGenerator } = require('react-native').UIManager;
          const generator = new UIImpactFeedbackGenerator('light');
          generator.prepare();
          generator.impact();
        } catch (e) {}
      }
    });
  },

  medium: () => {
    triggerIfEnabled(() => {
      if (Platform.OS === 'ios') {
        try {
          const { UIImpactFeedbackGenerator } = require('react-native').UIManager;
          const generator = new UIImpactFeedbackGenerator('medium');
          generator.prepare();
          generator.impact();
        } catch (e) {}
      }
    });
  },

  heavy: () => {
    triggerIfEnabled(() => {
      if (Platform.OS === 'ios') {
        try {
          const { UIImpactFeedbackGenerator } = require('react-native').UIManager;
          const generator = new UIImpactFeedbackGenerator('heavy');
          generator.prepare();
          generator.impact();
        } catch (e) {}
      }
    });
  },

  selection: () => {
    triggerIfEnabled(() => {
      if (Platform.OS === 'ios') {
        try {
          const { UISelectionFeedbackGenerator } = require('react-native').UIManager;
          const generator = new UISelectionFeedbackGenerator();
          generator.prepare();
          generator.selectionChanged();
        } catch (e) {}
      }
    });
  },

  success: () => {
    triggerIfEnabled(() => {
      if (Platform.OS === 'ios') {
        try {
          const { UINotificationFeedbackGenerator } = require('react-native').UIManager;
          const generator = new UINotificationFeedbackGenerator();
          generator.prepare();
          generator.notificationOccurred('success');
        } catch (e) {}
      }
    });
  },

  warning: () => {
    triggerIfEnabled(() => {
      if (Platform.OS === 'ios') {
        try {
          const { UINotificationFeedbackGenerator } = require('react-native').UIManager;
          const generator = new UINotificationFeedbackGenerator();
          generator.prepare();
          generator.notificationOccurred('warning');
        } catch (e) {}
      }
    });
  },

  error: () => {
    triggerIfEnabled(() => {
      if (Platform.OS === 'ios') {
        try {
          const { UINotificationFeedbackGenerator } = require('react-native').UIManager;
          const generator = new UINotificationFeedbackGenerator();
          generator.prepare();
          generator.notificationOccurred('error');
        } catch (e) {}
      }
    });
  },
};

export default HapticFeedback;