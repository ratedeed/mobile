import React, { useState, useRef } from 'react';
import {
  TextInput,
  StyleSheet,
  Text,
  View,
  Animated,
  TouchableOpacity,
  TextInputProps,
} from 'react-native';
import { Spacing, Radii, Colors, Shadows } from '../../constants/designTokens';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  success?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  containerStyle?: any;
  style?: any;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  success,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  style,
  onFocus,
  onBlur,
  value,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const labelAnimation = useRef(new Animated.Value(value ? 1 : 0)).current;

  const handleFocus = (e: any) => {
    setIsFocused(true);
    Animated.timing(labelAnimation, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (!value) {
      Animated.timing(labelAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
    onBlur?.(e);
  };

  const getBorderColor = () => {
    if (error) return Colors.error;
    if (success) return Colors.success;
    if (isFocused) return Colors.primary500;
    return Colors.neutral200;
  };

  const labelTop = labelAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -Spacing.xs],
  });

  const labelFontSize = labelAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [15, 12],
  });

  const labelColor = error
    ? Colors.error
    : isFocused
    ? Colors.primary500
    : Colors.neutral700;

  return (
    <View style={[styles.inputGroup, containerStyle]}>
      {label && (
        <Animated.Text
          style={[
            styles.label,
            {
              top: labelTop,
              fontSize: labelFontSize,
              color: labelColor,
            },
          ]}
        >
          {label}
        </Animated.Text>
      )}
      <View
        style={[
          styles.inputWrapper,
          { borderColor: getBorderColor() },
          isFocused && styles.inputFocused,
          error && styles.inputError,
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          style={[
            styles.input,
            leftIcon && styles.inputWithLeftIcon,
            rightIcon && styles.inputWithRightIcon,
            style,
          ]}
          placeholderTextColor={Colors.neutral400}
          onFocus={handleFocus}
          onBlur={handleBlur}
          value={value}
          {...props}
        />
        {rightIcon && (
          <TouchableOpacity
            style={styles.rightIcon}
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
          >
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {success && !error && (
        <Text style={styles.successText}>Looks good!</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  inputGroup: {
    width: '100%',
    marginBottom: Spacing.md,
    paddingTop: Spacing.md,
  },
  label: {
    position: 'absolute',
    left: Spacing.md,
    top: Spacing.md + 4,
    fontWeight: '600',
    zIndex: 1,
    backgroundColor: Colors.neutral50,
    paddingHorizontal: Spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Radii.lg,
    backgroundColor: Colors.neutral50,
    ...Shadows.xs,
  },
  inputFocused: {
    shadowColor: Colors.primary500,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  inputError: {
    borderColor: Colors.error,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    fontSize: 18,
    color: Colors.neutral800,
  },
  inputWithLeftIcon: {
    paddingLeft: Spacing.xs,
  },
  inputWithRightIcon: {
    paddingRight: Spacing.xs,
  },
  leftIcon: {
    paddingLeft: Spacing.md,
  },
  rightIcon: {
    paddingRight: Spacing.md,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: Spacing.xs,
    marginLeft: Spacing.md,
  },
  successText: {
    fontSize: 12,
    color: Colors.success,
    marginTop: Spacing.xs,
    marginLeft: Spacing.md,
  },
});

export default Input;