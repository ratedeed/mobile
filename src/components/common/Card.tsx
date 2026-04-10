import React, { useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  ViewStyle,
  StyleSheet,
  StyleProp
} from 'react-native';
import { Colors, Spacing, Radii, Shadows } from '../../constants/designTokens';

type CardVariant = 'elevated' | 'outlined' | 'filled';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  pressable?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

const Card: React.FC<CardProps> = ({
  children,
  variant = 'elevated',
  pressable = false,
  onPress,
  style,
  contentStyle,
}) => {
  const animatedScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (pressable) {
      Animated.spring(animatedScale, {
        toValue: 0.98,
        useNativeDriver: true,
        friction: 8,
        tension: 100,
      }).start();
    }
  };

  const handlePressOut = () => {
    if (pressable) {
      Animated.spring(animatedScale, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }
  };

  const getVariantStyle = (): StyleProp<ViewStyle> => {
    switch (variant) {
      case 'outlined':
        return styles.outlined;
      case 'filled':
        return styles.filled;
      case 'elevated':
      default:
        return styles.elevated;
    }
  };

  const containerStyle = [
    styles.base,
    getVariantStyle(),
    style,
    { transform: [{ scale: animatedScale }] } as any
  ];

  if (pressable && onPress) {
    return (
      <TouchableOpacity
        style={containerStyle}
        onPress={onPress}
        activeOpacity={0.95}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={contentStyle}>{children}</View>
      </TouchableOpacity>
    );
  }

  return (
    <Animated.View style={containerStyle}>
      <View style={contentStyle}>{children}</View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: Radii.xl,
    padding: Spacing.md,
    marginVertical: Spacing.xs,
    backgroundColor: Colors.neutral50,
  },
  elevated: {
    borderWidth: 1,
    borderColor: Colors.neutral200,
    ...Shadows.xs,
  },
  outlined: {
    borderWidth: 1,
    borderColor: Colors.neutral200,
  },
  filled: {
    backgroundColor: Colors.neutral100,
    borderWidth: 0,
  },
});

export default Card;
