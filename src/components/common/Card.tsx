import React, { useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ViewStyle,
} from 'react-native';
import { Spacing, Radii, Colors, Shadows } from '../../constants/designTokens';

type CardVariant = 'elevated' | 'outlined' | 'filled';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  pressable?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
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

  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'outlined':
        return {
          backgroundColor: Colors.neutral50,
          borderWidth: 1,
          borderColor: Colors.neutral200,
          ...Shadows.xs,
        };
      case 'filled':
        return {
          backgroundColor: Colors.neutral100,
          borderWidth: 0,
          ...Shadows.none,
        };
      default:
        return {
          backgroundColor: Colors.neutral50,
          borderWidth: 1,
          borderColor: Colors.neutral100,
          ...Shadows.sm,
        };
    }
  };

  const cardStyles = [
    styles.card,
    getVariantStyles(),
    { transform: [{ scale: animatedScale }] },
    style,
  ];

  const contentStyles = [
    styles.content,
    contentStyle,
  ];

  if (pressable && onPress) {
    return (
      <TouchableOpacity
        style={cardStyles}
        onPress={onPress}
        activeOpacity={0.95}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={contentStyles}>{children}</View>
      </TouchableOpacity>
    );
  }

  return (
    <Animated.View style={cardStyles}>
      <View style={contentStyles}>{children}</View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
  },
  content: {},
});

export default Card;