import React, { useState, useRef } from 'react';
import {
  TextInput,
  Text,
  View,
  Animated,
  TouchableOpacity,
  TextInputProps,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle
} from 'react-native';
import { Colors, Spacing, Radii } from '../../constants/designTokens';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  success?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<TextStyle>;
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

  // Focus tracking for animation
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

  const labelTop = labelAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });

  const labelFontSize = labelAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [15, 12],
  });

  const getBorderColor = () => {
    if (error) return Colors.error500;
    if (success) return Colors.success500;
    if (isFocused) return Colors.primary600;
    return Colors.neutral200;
  };

  const getLabelColor = () => {
    if (error) return Colors.error600;
    if (isFocused) return Colors.neutral900;
    return Colors.neutral500;
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Animated.Text
          style={[
            styles.label,
            {
              transform: [{ translateY: labelTop }],
              fontSize: labelFontSize,
              color: getLabelColor(),
            }
          ]}
        >
          {label}
        </Animated.Text>
      )}
      <View
        style={[
          styles.inputWrapper,
          { borderColor: getBorderColor() },
          isFocused && styles.inputWrapperFocused
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          style={[
            styles.textInput,
            leftIcon ? styles.textInputWithLeftIcon : null,
            rightIcon ? styles.textInputWithRightIcon : null,
            style
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
  container: {
    width: '100%',
    marginBottom: Spacing.md,
    paddingTop: Spacing.md,
  },
  label: {
    position: 'absolute',
    left: 16,
    top: 20,
    fontWeight: '600',
    zIndex: 1,
    backgroundColor: Colors.neutral50,
    paddingHorizontal: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radii.md,
    backgroundColor: Colors.neutral50,
  },
  inputWrapperFocused: {
    borderWidth: 1,
  },
  leftIcon: {
    paddingLeft: Spacing.md,
  },
  rightIcon: {
    paddingRight: Spacing.md,
  },
  textInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    color: Colors.neutral900,
  },
  textInputWithLeftIcon: {
    paddingLeft: Spacing.xs,
  },
  textInputWithRightIcon: {
    paddingRight: Spacing.xs,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.error500,
    marginTop: 4,
    marginLeft: 4,
  },
  successText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.success500,
    marginTop: 4,
    marginLeft: 4,
  },
});

export default Input;
