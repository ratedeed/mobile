import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
  Pressable,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors, Spacing, Radii } from '../../constants/designTokens';

interface ActionSheetOption {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  icon?: string;
}

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  options: ActionSheetOption[];
  cancelLabel?: string;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const ActionSheet: React.FC<ActionSheetProps> = ({
  visible,
  onClose,
  title,
  message,
  options,
  cancelLabel = 'Cancel',
}) => {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 150,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateY, backdropOpacity]);

  const handleOptionPress = (option: ActionSheetOption) => {
    onClose();
    setTimeout(() => option.onPress(), 300);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={styles.backdropPressable} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY }] },
          ]}
        >
          <View style={styles.optionsContainer}>
            {(title || message) && (
              <View style={styles.header}>
                {title && <Text style={styles.title}>{title}</Text>}
                {message && <Text style={styles.message}>{message}</Text>}
              </View>
            )}

            {options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.option,
                  index === 0 && styles.firstOption,
                  index === options.length - 1 && styles.lastOption,
                ]}
                onPress={() => handleOptionPress(option)}
                activeOpacity={0.7}
              >
                {option.icon && (
                  <View style={styles.iconContainer}>
                    <FontAwesome5
                      name={option.icon}
                      size={18}
                      color={option.destructive ? Colors.error500 : Colors.primary500}
                      solid
                    />
                  </View>
                )}
                <Text
                  style={[
                    styles.optionText,
                    option.destructive && styles.destructiveText,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  backdropPressable: {
    flex: 1,
  },
  sheet: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  optionsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: Radii.lg,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  header: {
    padding: Spacing.md,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral200,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.neutral600,
    textAlign: 'center',
  },
  message: {
    fontSize: 12,
    color: Colors.neutral500,
    textAlign: 'center',
    marginTop: Spacing.xxs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral100,
    position: 'relative',
  },
  firstOption: {
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
  },
  lastOption: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: Radii.lg,
    borderBottomRightRadius: Radii.lg,
  },
  iconContainer: {
    position: 'absolute',
    left: Spacing.md,
    width: 32,
    height: 32,
    borderRadius: Radii.md,
    backgroundColor: Colors.neutral50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 17,
    fontWeight: '400',
    color: Colors.primary500,
    textAlign: 'center',
  },
  destructiveText: {
    color: Colors.error500,
  },
  cancelButton: {
    backgroundColor: Colors.neutral50,
    borderRadius: Radii.lg,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    marginBottom: 0,
  },
  cancelText: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.primary500,
  },
});

export default ActionSheet;