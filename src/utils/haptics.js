import { Platform } from 'react-native';

const HapticFeedback = {
  light: () => {
    if (Platform.OS === 'ios') {
      try {
        const { UIImpactFeedbackGenerator } = require('react-native').UIManager;
        const generator = new UIImpactFeedbackGenerator('light');
        generator.prepare();
        generator.impact();
      } catch (e) {
        // Haptics not available
      }
    }
  },

  medium: () => {
    if (Platform.OS === 'ios') {
      try {
        const { UIImpactFeedbackGenerator } = require('react-native').UIManager;
        const generator = new UIImpactFeedbackGenerator('medium');
        generator.prepare();
        generator.impact();
      } catch (e) {
        // Haptics not available
      }
    }
  },

  heavy: () => {
    if (Platform.OS === 'ios') {
      try {
        const { UIImpactFeedbackGenerator } = require('react-native').UIManager;
        const generator = new UIImpactFeedbackGenerator('heavy');
        generator.prepare();
        generator.impact();
      } catch (e) {
        // Haptics not available
      }
    }
  },

  selection: () => {
    if (Platform.OS === 'ios') {
      try {
        const { UISelectionFeedbackGenerator } = require('react-native').UIManager;
        const generator = new UISelectionFeedbackGenerator();
        generator.prepare();
        generator.selectionChanged();
      } catch (e) {
        // Haptics not available
      }
    }
  },

  success: () => {
    if (Platform.OS === 'ios') {
      try {
        const { UINotificationFeedbackGenerator } = require('react-native').UIManager;
        const generator = new UINotificationFeedbackGenerator();
        generator.prepare();
        generator.notificationOccurred('success');
      } catch (e) {
        // Haptics not available
      }
    }
  },

  warning: () => {
    if (Platform.OS === 'ios') {
      try {
        const { UINotificationFeedbackGenerator } = require('react-native').UIManager;
        const generator = new UINotificationFeedbackGenerator();
        generator.prepare();
        generator.notificationOccurred('warning');
      } catch (e) {
        // Haptics not available
      }
    }
  },

  error: () => {
    if (Platform.OS === 'ios') {
      try {
        const { UINotificationFeedbackGenerator } = require('react-native').UIManager;
        const generator = new UINotificationFeedbackGenerator();
        generator.prepare();
        generator.notificationOccurred('error');
      } catch (e) {
        // Haptics not available
      }
    }
  },
};

export default HapticFeedback;