import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Animated,
  ViewStyle,
  TextStyle,
  View,
  TouchableOpacityProps,
  StyleSheet,
  StyleProp
} from 'react-native';
import { Colors, Spacing, Radii } from '../../constants/designTokens';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  textStyle,
  leftIcon,
  rightIcon,
  ...props
}) => {
  const animatedScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = (e: any) => {
    Animated.spring(animatedScale, {
      toValue: 0.98,
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start();
    props.onPressIn?.(e);
  };

  const handlePressOut = (e: any) => {
    Animated.spring(animatedScale, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
    props.onPressOut?.(e);
  };

  const getVariantStyle = (): StyleProp<ViewStyle> => {
    switch (variant) {
      case 'secondary': return styles.secondary;
      case 'outline': return styles.outline;
      case 'ghost': return styles.ghost;
      case 'danger': return styles.danger;
      case 'primary':
      default: return styles.primary;
    }
  };

  const getTextColorStyle = (): StyleProp<TextStyle> => {
    switch (variant) {
      case 'secondary': return styles.textSecondary;
      case 'outline':
      case 'ghost': return styles.textGhost;
      case 'danger': return styles.textDanger;
      case 'primary':
      default: return styles.textPrimary;
    }
  };

  const getSizeStyle = (): StyleProp<ViewStyle> => {
    switch (size) {
      case 'sm': return styles.sizeSm;
      case 'lg': return styles.sizeLg;
      case 'md':
      default: return styles.sizeMd;
    }
  };

  const getTextSizeStyle = (): StyleProp<TextStyle> => {
    switch (size) {
      case 'sm': return styles.textSizeSm;
      case 'lg': return styles.textSizeLg;
      case 'md':
      default: return styles.textSizeMd;
    }
  };

  const isDisabled = disabled || loading;

  const getSpinnerColor = () => {
    switch (variant) {
      case 'secondary':
      case 'outline':
      case 'ghost': return Colors.neutral900;
      case 'danger':
      case 'primary':
      default: return Colors.neutral50;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.base,
        getVariantStyle(),
        getSizeStyle(),
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        { transform: [{ scale: animatedScale }] } as any,
        style
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.9}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={getSpinnerColor()} size="small" />
      ) : (
        <>
          {leftIcon && <View style={styles.leftIconContainer}>{leftIcon}</View>}
          <Text
            style={[
              styles.textBase,
              getTextColorStyle(),
              getTextSizeStyle(),
              textStyle
            ]}
          >
            {title}
          </Text>
          {rightIcon && <View style={styles.rightIconContainer}>{rightIcon}</View>}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.md,
  },
  primary: {
    backgroundColor: Colors.primary600,
  },
  secondary: {
    backgroundColor: Colors.neutral200,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.neutral300,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: Colors.error600,
  },
  textPrimary: {
    color: Colors.neutral50,
  },
  textSecondary: {
    color: Colors.neutral900,
  },
  textGhost: {
    color: Colors.neutral900,
  },
  textDanger: {
    color: Colors.neutral50,
  },
  sizeSm: {
    height: 36,
    paddingHorizontal: Spacing.md,
  },
  sizeMd: {
    height: 48,
    paddingHorizontal: Spacing.lg,
  },
  sizeLg: {
    height: 56,
    paddingHorizontal: Spacing.xl,
  },
  textBase: {
    fontWeight: '600',
    textAlign: 'center',
  },
  textSizeSm: {
    fontSize: 14,
  },
  textSizeMd: {
    fontSize: 16,
  },
  textSizeLg: {
    fontSize: 18,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  leftIconContainer: {
    marginRight: Spacing.sm,
  },
  rightIconContainer: {
    marginLeft: Spacing.sm,
  },
});

export default Button;
